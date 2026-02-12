/* src/js/game.js — Core game logic */
(function () {
'use strict';
var POS    = window.POS;
var ITEMS  = POS.ITEMS;
var NPCS   = POS.NPCS;
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
  if (POS.Loader && POS.Loader.ensureRounds) POS.Loader.ensureRounds(State.round + 1);
  var round = ROUNDS[State.round];
  State.currentNpc = round.npc;
  State.currentMood = 'calm';
  State.prevMood = 'calm';
  State.phase = 'roundIntro';
  State.phaseTimer = PARAMS.roundIntroTime;
  Bus.emit('roundStart', State.round);
};

/* ---- frame update ---- */

Game.prototype.update = function (dt) {
  /* roundIntro → customerEntering */
  if (State.phase === 'roundIntro') {
    State.phaseTimer -= dt;
    if (State.phaseTimer <= 0) {
      State.phase = 'customerEntering';
      State.customerAnimTimer = 0.6;
      Bus.emit('customerSummon');
    }
    return;
  }

  /* customerEntering → playing */
  if (State.phase === 'customerEntering') {
    State.customerAnimTimer -= dt;
    if (State.customerAnimTimer <= 0) {
      State.phase = 'playing';
      Bus.emit('customerArrive');
      Bus.emit('roundReady');
    }
    return;
  }

  /* customerFeedback → customerLeaving */
  if (State.phase === 'customerFeedback') {
    State.customerAnimTimer -= dt;
    if (State.customerAnimTimer <= 0) {
      State.phase = 'customerLeaving';
      State.customerAnimTimer = State.customerFeedback === 'happy' ? 0.6 : 0.4;
      Bus.emit('customerLeave', State.customerFeedback);
    }
    return;
  }

  /* customerLeaving → roundClear / gameOver / gameClear */
  if (State.phase === 'customerLeaving') {
    State.customerAnimTimer -= dt;
    if (State.customerAnimTimer <= 0) {
      Bus.emit('customerGone');
      if (State.customerFeedback === 'happy') {
        State.round++;
        this.startRound();
      } else {
        State.phase = 'gameOver';
        Bus.emit('gameOver');
      }
    }
    return;
  }

  if (State.phase !== 'playing') return;

  /* ---- playing phase ---- */

  /* satisfaction drain using NPC drainRate */
  var npc = State.currentNpc;
  State.satisfaction -= npc.drainRate * dt;

  /* mood tracking */
  var newMood = POS.getMoodStage(State.satisfaction);
  if (newMood !== State.currentMood) {
    State.prevMood = State.currentMood;
    State.currentMood = newMood;
    Bus.emit('moodChange', newMood);
  }

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
  State.lastScanOk = false;
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

  State.lastScanOk = true;
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
  State.holdProgress = 0;

  /* validate discount setting via addToPOS */
  this.addToPOS(State.selectedItemId);

  if (!State.lastScanOk) {
    /* wrong discount — red flash already fired via _scanReject, let user retry */
    State.scanPhase = 'itemSelected';
    return;
  }

  State.scanPhase = 'scanned';
  State.autoBagTimer = PARAMS.autoBagDelay;

  State.combo++;
  if (State.combo > State.maxCombo) State.maxCombo = State.combo;
  State.score += PARAMS.scorePerScan + PARAMS.scoreComboBonus * State.combo;
  State.satisfaction = Math.min(PARAMS.maxSatisfaction, State.satisfaction + PARAMS.scanRecovery);
  Bus.emit('moodHint', 'calm');

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
  State.lastCheckoutReport = this._buildCheckoutReport(reason, message);
  State.mistakeCount++;
  var npc = State.currentNpc;
  var penalty = npc.mistakePenalty + PARAMS.mistakeEscalation * (State.mistakeCount - 1);

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

  /* ---- Adaptive difficulty: update rating based on performance ---- */
  if (State.round >= 3) {
    var satFactor = State.satisfaction / PARAMS.maxSatisfaction;
    var mistakeFactor = Math.max(0, 1 - State.mistakeCount * 0.3);
    var perf = satFactor * 0.6 + mistakeFactor * 0.4;
    State.diffRating += 0.5 + perf * 1.2;
  }

  this.audio.play('checkout_success');
  Bus.emit('checkoutSuccess');

  State.phase = 'customerFeedback';
  State.customerFeedback = 'happy';
  State.customerAnimTimer = 1.2;
  Bus.emit('customerFeedback', 'happy');
};

Game.prototype._gameOver = function () {
  this.audio.play('warning');

  State.phase = 'customerFeedback';
  State.customerFeedback = 'angry';
  State.customerAnimTimer = 0.8;
  Bus.emit('customerFeedback', 'angry');
};

Game.prototype._buildCheckoutReport = function (reason, message) {
  var round = ROUNDS[State.round];
  var required = round ? round.items : [];
  var reqMap = {};
  for (var i = 0; i < required.length; i++) {
    reqMap[required[i].id] = required[i].qty;
  }

  var posQty = {};
  for (var j = 0; j < State.posItems.length; j++) {
    var entry = State.posItems[j];
    posQty[entry.itemId] = (posQty[entry.itemId] || 0) + entry.qty;
  }

  var lines = [];
  for (i = 0; i < required.length; i++) {
    var req = required[i];
    var item = ITEMS[req.id];
    var name = item ? (item.nameEn || item.name || req.id) : req.id;
    var actual = posQty[req.id] || 0;
    var status = 'ok';
    if (actual === 0) status = 'missing';
    else if (actual !== req.qty) status = 'qty';
    else if (item && item.isSale) {
      var correct = getCorrectDiscount(req.id);
      if (correct) {
        for (var k = 0; k < State.posItems.length; k++) {
          var e = State.posItems[k];
          if (e.itemId !== req.id) continue;
          if (e.barcodeType !== 'discount' || e.discountRate !== correct.discountRate) {
            status = 'discount'; break;
          }
        }
      }
    }
    lines.push({
      id: req.id,
      name: name,
      expected: req.qty,
      actual: actual,
      status: status,
    });
  }

  for (var id in posQty) {
    if (reqMap[id]) continue;
    var extraItem = ITEMS[id];
    var extraName = extraItem ? (extraItem.nameEn || extraItem.name || id) : id;
    lines.push({
      id: id,
      name: extraName,
      expected: 0,
      actual: posQty[id],
      status: 'excess',
    });
  }

  return {
    reason: reason,
    message: message,
    lines: lines,
  };
};

POS.Game = Game;
})();
