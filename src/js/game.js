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

/* ---- add item directly to POS ---- */

Game.prototype.addToPOS = function (itemId) {
  if (State.phase !== 'playing') return;

  var item = ITEMS[itemId];
  if (!item) return;

  var existing = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === itemId) { existing = State.posItems[i]; break; }
  }

  if (existing) {
    existing.qty++;
  } else {
    var barcodeType = 'normal';
    var discountRate = 0;
    if (item.isSale && getCorrectDiscount) {
      var correct = getCorrectDiscount(itemId);
      if (correct) {
        barcodeType = 'discount';
        discountRate = correct.discountRate;
      }
    }
    State.posItems.push({
      itemId:       itemId,
      qty:          1,
      barcodeType:  barcodeType,
      discountRate: discountRate,
    });
  }

  this.audio.play('item_pickup');
  Bus.emit('posUpdated');
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

Game.prototype.changeQty = function (itemId, delta) {
  var entry = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === itemId) { entry = State.posItems[i]; break; }
  }
  if (!entry) return;
  entry.qty += delta;
  if (entry.qty <= 0) {
    State.posItems = State.posItems.filter(function (p) { return p.itemId !== itemId; });
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
  var i, req, pos;

  for (i = 0; i < required.length; i++) {
    req = required[i];
    pos = State.posItems.find(function (p) { return p.itemId === req.id; });
    if (!pos) return this._checkoutFail('missing', '상품이 부족해!');
  }
  for (i = 0; i < State.posItems.length; i++) {
    pos = State.posItems[i];
    if (!required.find(function (r) { return r.id === pos.itemId; }))
      return this._checkoutFail('excess', '상품이 너무 많아!');
  }
  for (i = 0; i < required.length; i++) {
    req = required[i];
    pos = State.posItems.find(function (p) { return p.itemId === req.id; });
    if (pos.qty !== req.qty) return this._checkoutFail('quantity', '수량이 안 맞아!');
  }
  for (i = 0; i < required.length; i++) {
    req = required[i];
    var item = ITEMS[req.id];
    if (!item.isSale) continue;
    pos = State.posItems.find(function (p) { return p.itemId === req.id; });
    var correct = getCorrectDiscount(req.id);
    if (!correct) continue;
    if (pos.barcodeType !== 'discount' || pos.discountRate !== correct.discountRate)
      return this._checkoutFail('discount', '할인 스티커가 달라!');
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
