/* src/js/game.js — Core game logic */
(function () {
'use strict';
var POS    = window.POS;
var ITEMS  = POS.ITEMS;
var CUSTOMER_TYPES = POS.CUSTOMER_TYPES;
var ROUNDS = POS.ROUNDS;
var PARAMS = POS.PARAMS;
var State  = POS.State;
var Bus    = POS.Bus;
var getCorrectDiscount = POS.getCorrectDiscount;

function Game(audio, scanner) {
  this.audio   = audio;
  this.scanner = scanner;
}

Game.prototype.init = function () {
  var self = this;
  Bus.on('cartItemClick', function (id) { self.addToPOS(id); });
  Bus.on('checkoutClick', function ()   { self.attemptCheckout(); });
  Bus.on('qtyPlus',       function (id) { self.changeQty(id, +1); });
  Bus.on('qtyMinus',      function (id) { self.changeQty(id, -1); });
};

/* ---- lifecycle ---- */

Game.prototype.startGame = function () {
  State.resetGame();
  State.round = 0;
  State.score = 0;
  this.startRound();
};

Game.prototype.startRound = function () {
  State.resetRound();
  State.phase = 'roundIntro';
  State.phaseTimer = PARAMS.roundIntroTime;
  Bus.emit('roundStart', State.round);
};

/* ---- frame update ---- */

Game.prototype.update = function (dt) {
  if (State.phase === 'roundIntro') {
    State.phaseTimer -= dt;
    if (State.phaseTimer <= 0) { State.phase = 'playing'; Bus.emit('roundReady'); }
    return;
  }
  if (State.phase === 'roundClear') {
    State.phaseTimer -= dt;
    if (State.phaseTimer <= 0) { State.round++; this.startRound(); }
    return;
  }
  if (State.phase !== 'playing') return;

  /* satisfaction drain */
  var round = ROUNDS[State.round];
  var cust  = CUSTOMER_TYPES[round.customer];
  State.satisfaction -= round.drainRate * cust.drainMult * dt;
  if (State.satisfaction <= 0) { State.satisfaction = 0; this._gameOver(); return; }

  /* scan hold */
  if (State.scanPhase === 'itemSelected' || State.scanPhase === 'scanning') {
    var hit = State.dragActive ? this.scanner.checkOverlap() : null;
    if (hit) {
      State.holdProgress += PARAMS.scanGainRate * dt;
      State.currentBarcodeHit = hit;
      if (State.scanPhase === 'itemSelected') { State.scanPhase = 'scanning'; Bus.emit('scanStart'); }
      if (State.holdProgress >= PARAMS.scanThreshold) this._completeScan(hit);
    } else {
      State.holdProgress = Math.max(0, State.holdProgress - PARAMS.scanDecayRate * dt);
      if (State.holdProgress <= 0 && State.scanPhase === 'scanning') {
        State.scanPhase = 'itemSelected';
        State.currentBarcodeHit = null;
      }
    }
    Bus.emit('holdProgress', State.holdProgress / PARAMS.scanThreshold);
  }

  /* auto-ready: after scan, return to idle automatically */
  if (State.scanPhase === 'scanned') {
    State.autoBagTimer -= dt;
    if (State.autoBagTimer <= 0) {
      State.scanPhase = 'idle';
      State.selectedItemId = null;
      State.dragActive = false;
      Bus.emit('itemBagged');
    }
  }
};

/* ---- add item to POS with discount validation ---- */

Game.prototype.addToPOS = function (itemId) {
  if (State.phase !== 'playing') return;

  var item = ITEMS[itemId];
  if (!item) return;

  var discRate = State.scanDiscountRate;

  /* validate discount setting vs item */
  if (discRate > 0) {
    /* discount set — item must be sale with a matching discount barcode */
    if (!item.isSale) { this._scanReject(); return; }
    var hasMatch = false;
    for (var j = 0; j < item.barcodes.length; j++) {
      if (item.barcodes[j].type === 'discount' && item.barcodes[j].discountRate === discRate) {
        hasMatch = true; break;
      }
    }
    if (!hasMatch) { this._scanReject(); return; }
  } else {
    /* no discount — sale items must be scanned with discount */
    if (item.isSale) { this._scanReject(); return; }
  }

  var barcodeType = discRate > 0 ? 'discount' : 'normal';

  /* find existing POS entry with same itemId AND same discountRate */
  var existing = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === itemId && State.posItems[i].discountRate === discRate) {
      existing = State.posItems[i]; break;
    }
  }

  if (existing) {
    existing.qty++;
  } else {
    State.posItems.push({
      itemId:       itemId,
      qty:          1,
      barcodeType:  barcodeType,
      discountRate: discRate,
    });
  }

  this.audio.play('item_pickup');
  Bus.emit('posUpdated');
};

Game.prototype._scanReject = function () {
  this.audio.play('checkout_fail');
  Bus.emit('scanFail');
};

/* ---- item selection (legacy scan flow) ---- */

Game.prototype.selectItem = function (itemId) {
  if (State.phase !== 'playing') return;
  if (State.scanPhase !== 'idle') return;
  State.selectedItemId = itemId;
  State.scanPhase = 'itemSelected';
  State.holdProgress = 0;
  State.currentBarcodeHit = null;
  this.audio.play('item_pickup');
  Bus.emit('itemSelected', itemId);
};

/* ---- scan complete ---- */

Game.prototype._completeScan = function (barcode) {
  State.scanPhase = 'scanned';
  State.holdProgress = 0;
  State.autoBagTimer = PARAMS.autoBagDelay;

  var existing = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === State.selectedItemId) { existing = State.posItems[i]; break; }
  }
  if (existing) {
    existing.qty++;
    existing.barcodeType  = barcode.type;
    existing.discountRate = barcode.discountRate || 0;
  } else {
    State.posItems.push({
      itemId:       State.selectedItemId,
      qty:          1,
      barcodeType:  barcode.type,
      discountRate: barcode.discountRate || 0,
    });
  }

  State.combo++;
  if (State.combo > State.maxCombo) State.maxCombo = State.combo;
  State.score += PARAMS.scorePerScan + PARAMS.scoreComboBonus * State.combo;
  State.satisfaction = Math.min(PARAMS.maxSatisfaction, State.satisfaction + PARAMS.scanRecovery);

  this.audio.play('scan_beep');
  if (State.combo >= 3) this.audio.play('combo_up', 0.5);

  Bus.emit('scanComplete', { itemId: State.selectedItemId, barcode: barcode, combo: State.combo });
  Bus.emit('posUpdated');
};

/* ---- POS qty ---- */

Game.prototype.changeQty = function (key, delta) {
  /* key = "itemId_discountRate" */
  var sep = key.lastIndexOf('_');
  var itemId   = key.substring(0, sep);
  var discRate = parseFloat(key.substring(sep + 1));

  var entry = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === itemId && State.posItems[i].discountRate === discRate) {
      entry = State.posItems[i]; break;
    }
  }
  if (!entry) return;
  entry.qty += delta;
  if (entry.qty <= 0) {
    State.posItems = State.posItems.filter(function (p) {
      return !(p.itemId === itemId && p.discountRate === discRate);
    });
  }
  this.audio.play('ui_click');
  Bus.emit('posUpdated');
};

/* ---- checkout ---- */

Game.prototype.attemptCheckout = function () {
  if (State.phase !== 'playing') return;
  if (State.scanPhase !== 'idle') return;

  var round    = ROUNDS[State.round];
  var required = round.items;
  var i, req;

  /* build total qty per itemId across all discount entries */
  var posQty = {};
  for (i = 0; i < State.posItems.length; i++) {
    var p = State.posItems[i];
    posQty[p.itemId] = (posQty[p.itemId] || 0) + p.qty;
  }

  /* all required items present? */
  for (i = 0; i < required.length; i++) {
    req = required[i];
    if (!posQty[req.id]) return this._checkoutFail('missing', '상품이 부족해!');
  }

  /* no excess items? */
  for (var id in posQty) {
    var found = false;
    for (i = 0; i < required.length; i++) {
      if (required[i].id === id) { found = true; break; }
    }
    if (!found) return this._checkoutFail('excess', '상품이 너무 많아!');
  }

  /* quantities match? */
  for (i = 0; i < required.length; i++) {
    req = required[i];
    if ((posQty[req.id] || 0) !== req.qty) return this._checkoutFail('quantity', '수량이 안 맞아!');
  }

  /* sale items have correct discount? */
  for (i = 0; i < required.length; i++) {
    req = required[i];
    var item = ITEMS[req.id];
    if (!item.isSale) continue;
    var correct = getCorrectDiscount(req.id);
    if (!correct) continue;
    /* all entries of this sale item must have the correct discount */
    for (var j = 0; j < State.posItems.length; j++) {
      var entry = State.posItems[j];
      if (entry.itemId !== req.id) continue;
      if (entry.barcodeType !== 'discount' || entry.discountRate !== correct.discountRate)
        return this._checkoutFail('discount', '할인 스티커가 달라!');
    }
  }

  this._checkoutSuccess();
};

Game.prototype._checkoutFail = function (reason, message) {
  State.mistakeCount++;
  var round = ROUNDS[State.round];
  var cust  = CUSTOMER_TYPES[round.customer];
  var penalty = cust.mistakePenalty + PARAMS.mistakeEscalation * (State.mistakeCount - 1);

  State.satisfaction -= penalty;
  State.score += PARAMS.scoreMistake;
  State.combo = 0;

  this.audio.play('checkout_fail');
  Bus.emit('checkoutMistake', { reason: reason, message: message });

  if (State.satisfaction <= 0) { State.satisfaction = 0; this._gameOver(); }
};

Game.prototype._checkoutSuccess = function () {
  var timeBonus = Math.floor(State.satisfaction * PARAMS.scoreTimeBonusMult);
  State.score += PARAMS.scoreCheckout + timeBonus;

  this.audio.play('checkout_success');

  if (State.round >= ROUNDS.length - 1) {
    State.phase = 'gameClear';
    Bus.emit('gameClear');
  } else {
    State.phase = 'roundClear';
    State.phaseTimer = PARAMS.roundClearTime;
    Bus.emit('roundClear');
  }
};

Game.prototype._gameOver = function () {
  State.phase = 'gameOver';
  this.audio.play('warning');
  Bus.emit('gameOver');
};

POS.Game = Game;
})();
