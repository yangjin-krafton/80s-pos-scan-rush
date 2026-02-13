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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

  /* Mark tutorial phase if this is a tutorial/practice round */
  if (round.isTutorial) {
    State.tutorialPhase = round.tutorialPhase;
    State.tutorialCurrentId = round.tutorialId;
  } else {
    State.tutorialPhase = null;
    State.tutorialCurrentId = null;
  }

  State.currentNpc = round.npc;
  State.currentMood = 'calm';
  State.prevMood = 'calm';
  State.phase = 'roundIntro';
  State.phaseTimer = PARAMS.roundIntroTime;

  /* ---- Compute drainRate from item count + difficulty margin ---- */
  var totalQty = 0, saleQty = 0, promoQty = 0;
  for (var i = 0; i < round.items.length; i++) {
    var ri = round.items[i];
    totalQty += ri.qty;
    if (ITEMS[ri.id] && ITEMS[ri.id].isSale) saleQty += ri.qty;
    promoQty += (ri.promoFreeQty || 0);
  }
  var normalQty = totalQty - saleQty - promoQty;
  var rawTime = normalQty * PARAMS.timePerNormal + saleQty * PARAMS.timePerSale + promoQty * PARAMS.timePerPromo;
  var effectiveSat = PARAMS.maxSatisfaction + (totalQty - promoQty) * PARAMS.scanRecovery + promoQty * PARAMS.promoScanRecovery;
  var t = Math.min(State.diffRating / PARAMS.marginPeak, 1);
  var margin = PARAMS.marginHard + (PARAMS.marginEasy - PARAMS.marginHard) * Math.pow(1 - t, 1.5);
  State.currentNpc.drainRate = effectiveSat / (rawTime * margin);

  /* ---- Schedule meta events from round.metas ---- */
  var metas = round.metas || {};
  this._scheduleMetaEvents(metas);

  Bus.emit('roundStart', State.round);
};

/* ---- Schedule independent meta event timers ---- */

Game.prototype._scheduleMetaEvents = function (metas) {
  /* POS Blackout */
  if (metas.posBlackout && Math.random() < metas.posBlackout.chance) {
    var bDelay = metas.posBlackout.delay || [12, 25];
    State.posBlackoutScheduled = true;
    State.posBlackoutScheduleTimer = randInt(bDelay[0], bDelay[1]);
  }
  /* Mid-round Add */
  if (metas.midAdd && Math.random() < metas.midAdd.chance) {
    var aDelay = metas.midAdd.delay || [8, 15];
    State.midAddScheduled = true;
    State.midAddTimer = randInt(aDelay[0], aDelay[1]);
  }
  /* Mid-round Cancel */
  if (metas.midCancel && Math.random() < metas.midCancel.chance) {
    var cDelay = metas.midCancel.delay || [10, 18];
    State.midCancelScheduled = true;
    State.midCancelTimer = randInt(cDelay[0], cDelay[1]);
  }
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
  if (!State.godMode) State.satisfaction -= npc.drainRate * dt;

  /* mood tracking */
  var newMood = POS.getMoodStage(State.satisfaction);
  if (newMood !== State.currentMood) {
    State.prevMood = State.currentMood;
    State.currentMood = newMood;
    Bus.emit('moodChange', newMood);
  }

  if (State.satisfaction <= 0) { State.satisfaction = 0; this._gameOver(); return; }

  /* ---- Meta event timers (all independent) ---- */
  this._updateMetaEvents(dt);

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
      /* Only clear dragActive if no card is currently being dragged */
      if (!State.cardDragActive) State.dragActive = false;
      Bus.emit('itemBagged');
    }
  }
};

/* ---- Meta event update (called every frame during playing phase) ---- */

Game.prototype._updateMetaEvents = function (dt) {
  /* Skip all mid-events if satisfaction too low */
  var satOk = State.satisfaction >= 20;

  /* POS Blackout scheduling */
  if (State.posBlackoutScheduled && !State.posBlackout) {
    State.posBlackoutScheduleTimer -= dt;
    if (State.posBlackoutScheduleTimer <= 0) {
      State.posBlackout = true;
      var round = ROUNDS[State.round];
      var metas = (round && round.metas) || {};
      var dur = (metas.posBlackout && metas.posBlackout.duration) || [2, 4];
      State.posBlackoutTimer = randInt(dur[0], dur[1]);
      State.posBlackoutScheduled = false;
      Bus.emit('posBlackout', true);
    }
  }
  /* POS Blackout recovery */
  if (State.posBlackout) {
    State.posBlackoutTimer -= dt;
    if (State.posBlackoutTimer <= 0) {
      State.posBlackout = false;
      Bus.emit('posBlackout', false);
    }
  }

  /* Mid-round Add */
  if (State.midAddScheduled && !State.midAddFired && satOk) {
    State.midAddTimer -= dt;
    if (State.midAddTimer <= 0) {
      State.midAddFired = true;
      this._fireMidAdd();
    }
  }

  /* Mid-round Cancel */
  if (State.midCancelScheduled && !State.midCancelFired && satOk) {
    State.midCancelTimer -= dt;
    if (State.midCancelTimer <= 0) {
      State.midCancelFired = true;
      this._fireMidCancel();
    }
  }
};

/* ---- Mid-round Add event ---- */

Game.prototype._fireMidAdd = function () {
  var round = ROUNDS[State.round];
  var metas = (round && round.metas) || {};
  var count = (metas.midAdd && metas.midAdd.count) || 1;

  var newItems = POS.Loader.pickAdditionalItems(count, round, round.roundIndex);
  if (!newItems || !newItems.length) return;

  for (var i = 0; i < newItems.length; i++) {
    var entry = newItems[i];
    POS.ITEMS[entry.item.id] = entry.item;
    round.items.push({ id: entry.item.id, qty: entry.qty, isAdded: true });
  }

  /* Small satisfaction boost to compensate for extra work */
  State.satisfaction = Math.min(PARAMS.maxSatisfaction, State.satisfaction + (PARAMS.midAddSatBoost || 3));

  Bus.emit('midAdd', newItems);
};

/* ---- Mid-round Cancel event ---- */

Game.prototype._fireMidCancel = function () {
  var round = ROUNDS[State.round];
  var metas = (round && round.metas) || {};
  var count = (metas.midCancel && metas.midCancel.count) || 1;

  /* Pick cancellation targets (exclude isAdded items, keep at least 1 item) */
  var candidates = [];
  for (var i = 0; i < round.items.length; i++) {
    var ri = round.items[i];
    if (!ri.isAdded && !ri.isCancelled && ri.qty > 0) candidates.push(ri);
  }
  if (candidates.length <= 1) return; /* never cancel everything */

  /* Shuffle and pick up to count */
  for (var s = candidates.length - 1; s > 0; s--) {
    var j = Math.floor(Math.random() * (s + 1));
    var tmp = candidates[s]; candidates[s] = candidates[j]; candidates[j] = tmp;
  }

  var cancelled = [];
  var maxCancel = Math.min(count, candidates.length - 1);
  for (var c = 0; c < maxCancel; c++) {
    var target = candidates[c];
    var cancelQty = Math.min(target.qty, 1); /* cancel 1 unit */
    target.qty -= cancelQty;
    target.isCancelled = true;
    target.cancelQty = cancelQty;
    cancelled.push({ id: target.id, cancelQty: cancelQty, remainQty: target.qty });
  }

  /* Remove fully cancelled items from round.items */
  round.items = round.items.filter(function (ri) { return ri.qty > 0 || ri.isCancelled; });

  Bus.emit('midCancel', cancelled);
};

/* ---- add item to POS with discount validation ---- */

Game.prototype.addToPOS = function (itemId) {
  State.lastScanOk = false;
  if (State.phase !== 'playing') return;

  var item = ITEMS[itemId];
  if (!item) return;

  var discRate = State.scanDiscountRate;
  var barcodeType;

  if (State.scanFreeMode) {
    /* Free mode: only promo items allowed */
    if (!item.isPromo) { this._scanReject(); return; }
    barcodeType = 'promo';
    discRate = 0;
  } else if (discRate > 0) {
    /* Discount mode: validate discount setting vs item */
    if (!item.isSale) { this._scanReject(); return; }
    var hasMatch = false;
    for (var j = 0; j < item.barcodes.length; j++) {
      if (item.barcodes[j].type === 'discount' && item.barcodes[j].discountRate === discRate) {
        hasMatch = true; break;
      }
    }
    if (!hasMatch) { this._scanReject(); return; }
    barcodeType = 'discount';
  } else {
    /* Normal mode */
    if (item.isSale) { this._scanReject(); return; }
    barcodeType = 'normal';
  }

  var existing = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === itemId && State.posItems[i].barcodeType === barcodeType && State.posItems[i].discountRate === discRate) {
      existing = State.posItems[i]; break;
    }
  }

  if (existing) {
    existing.qty++;
    /* Move to end so it appears at the top of the reversed POS list */
    State.posItems.splice(i, 1);
    State.posItems.push(existing);
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

  this.addToPOS(State.selectedItemId);

  if (!State.lastScanOk) {
    State.scanPhase = 'itemSelected';
    return;
  }

  State.scanPhase = 'scanned';
  State.autoBagTimer = PARAMS.autoBagDelay;

  State.combo++;
  if (State.combo > State.maxCombo) State.maxCombo = State.combo;
  State.score += PARAMS.scorePerScan + PARAMS.scoreComboBonus * State.combo;
  var recovery = State.scanFreeMode ? PARAMS.promoScanRecovery : PARAMS.scanRecovery;
  State.satisfaction = Math.min(PARAMS.maxSatisfaction, State.satisfaction + recovery);
  Bus.emit('moodHint', 'calm');

  this.audio.play('scan_beep');
  if (State.combo >= 3) this.audio.play('combo_up', 0.5);

  var scannedItem = ITEMS[State.selectedItemId];
  if (scannedItem) this.audio.speakProduct(scannedItem.name);

  Bus.emit('scanComplete', { itemId: State.selectedItemId, barcode: barcode, combo: State.combo });
  Bus.emit('posUpdated');
};

/* ---- POS qty ---- */

Game.prototype.changeQty = function (key, delta) {
  /* posKey format: itemId_barcodeType_discountRate */
  var parts = key.split('_');
  var discRate = parseFloat(parts.pop());
  var barcodeType = parts.pop();
  var itemId = parts.join('_');

  var entry = null;
  for (var i = 0; i < State.posItems.length; i++) {
    if (State.posItems[i].itemId === itemId && State.posItems[i].barcodeType === barcodeType && State.posItems[i].discountRate === discRate) {
      entry = State.posItems[i]; break;
    }
  }
  if (!entry) return;
  entry.qty += delta;
  if (entry.qty <= 0) {
    State.posItems = State.posItems.filter(function (p) {
      return !(p.itemId === itemId && p.barcodeType === barcodeType && p.discountRate === discRate);
    });
  }
  this.audio.play('ui_click');
  Bus.emit('posUpdated');
};

/* ---- checkout ---- */

Game.prototype.attemptCheckout = function () {
  if (State.phase !== 'playing') return;
  if (State.scanPhase !== 'idle') return;
  /* Block checkout during POS blackout */
  if (State.posBlackout && PARAMS.blackoutCheckoutBlock) return;

  var round    = ROUNDS[State.round];
  var required = round.items;
  var i, req;

  var posQty = {};
  for (i = 0; i < State.posItems.length; i++) {
    var p = State.posItems[i];
    posQty[p.itemId] = (posQty[p.itemId] || 0) + p.qty;
  }

  for (i = 0; i < required.length; i++) {
    req = required[i];
    if (req.qty <= 0) continue; /* fully cancelled items */
    if (!posQty[req.id]) return this._checkoutFail('missing', '상품이 부족해!');
  }

  for (var id in posQty) {
    var found = false;
    for (i = 0; i < required.length; i++) {
      if (required[i].id === id && required[i].qty > 0) { found = true; break; }
    }
    if (!found) return this._checkoutFail('excess', '상품이 너무 많아!');
  }

  for (i = 0; i < required.length; i++) {
    req = required[i];
    if (req.qty <= 0) continue;
    if ((posQty[req.id] || 0) !== req.qty) return this._checkoutFail('quantity', '수량이 안 맞아!');
  }

  for (i = 0; i < required.length; i++) {
    req = required[i];
    if (req.qty <= 0) continue;
    var item = ITEMS[req.id];
    if (!item.isSale) continue;
    var correct = getCorrectDiscount(req.id);
    if (!correct) continue;
    for (var j = 0; j < State.posItems.length; j++) {
      var entry = State.posItems[j];
      if (entry.itemId !== req.id) continue;
      if (entry.barcodeType === 'promo') continue; /* skip promo entries */
      if (entry.barcodeType !== 'discount' || entry.discountRate !== correct.discountRate)
        return this._checkoutFail('discount', '할인 스티커가 달라!');
    }
  }

  /* Promo free quantity verification */
  for (i = 0; i < required.length; i++) {
    req = required[i];
    if (!req.promoFreeQty) continue;
    var freeScanned = 0;
    for (var pj = 0; pj < State.posItems.length; pj++) {
      if (State.posItems[pj].itemId === req.id && State.posItems[pj].barcodeType === 'promo') {
        freeScanned += State.posItems[pj].qty;
      }
    }
    if (freeScanned !== req.promoFreeQty)
      return this._checkoutFail('promo', '무료 상품이 안 맞아!');
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

  var round = ROUNDS[State.round];

  /* ---- Adaptive difficulty: update rating (freeze during tutorial) ---- */
  if (State.round >= 1 && !(round && round.isTutorial)) {
    var satFactor = State.satisfaction / PARAMS.maxSatisfaction;
    var mistakeFactor = Math.max(0, 1 - State.mistakeCount * 0.3);
    var perf = satFactor * 0.6 + mistakeFactor * 0.4;
    State.diffRating += 0.5 + perf * 1.2;
  }

  /* ---- Tutorial round completion handling ---- */
  if (round && round.isTutorial) {
    if (round.tutorialPhase === 'practice') {
      /* Practice complete → mark mechanic as done */
      State.tutorialCompleted[round.tutorialId] = true;
      State.tutorialPhase = null;
      State.tutorialCurrentId = null;
    } else {
      /* Tutorial round complete → next is practice */
      State.tutorialPhase = 'practice';
    }
  } else {
    /* Normal round: check for new tutorial unlocks */
    this._checkTutorialUnlocks();
  }

  var npc = State.currentNpc;
  if (npc) {
    State.servedNpcs.push({ emoji: npc.emoji, name: npc.name });
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
    if (required[i].qty > 0) reqMap[required[i].id] = required[i].qty;
  }

  var posQty = {};
  for (var j = 0; j < State.posItems.length; j++) {
    var entry = State.posItems[j];
    posQty[entry.itemId] = (posQty[entry.itemId] || 0) + entry.qty;
  }

  var lines = [];
  for (i = 0; i < required.length; i++) {
    var req = required[i];
    if (req.qty <= 0) continue;
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
          if (e.barcodeType === 'promo') continue;
          if (e.barcodeType !== 'discount' || e.discountRate !== correct.discountRate) {
            status = 'discount'; break;
          }
        }
      }
    }
    if (status === 'ok' && req.promoFreeQty) {
      var freeCount = 0;
      for (var pck = 0; pck < State.posItems.length; pck++) {
        if (State.posItems[pck].itemId === req.id && State.posItems[pck].barcodeType === 'promo') {
          freeCount += State.posItems[pck].qty;
        }
      }
      if (freeCount !== req.promoFreeQty) status = 'promo';
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

/* ---- Tutorial unlock check (called after normal round checkout) ---- */

Game.prototype._checkTutorialUnlocks = function () {
  var order = POS.TUTORIAL_ORDER;
  var defs  = POS.TUTORIAL_DEFS;
  var done  = State.tutorialCompleted;

  for (var i = 0; i < order.length; i++) {
    var id = order[i];
    if (done[id]) continue;                       // already completed
    var def = defs[id];
    if (State.diffRating < def.unlockDR) continue; // DR not reached

    // Unlock! Build tutorial + practice rounds and splice into ROUNDS
    var tutRound  = this._buildTutorialRound(def.tutorial, id, 'tutorial');
    var pracRound = this._buildTutorialRound(def.practice, id, 'practice');

    var insertAt = State.round + 1;
    ROUNDS.splice(insertAt, 0, tutRound, pracRound);

    // One mechanic at a time
    return;
  }
};

Game.prototype._buildTutorialRound = function (config, tutId, phase) {
  var tier = {
    npcType:   config.npcType,
    products:  config.products,
    qtyMin:    config.qtyMin,
    qtyMax:    config.qtyMax,
    saleCount: config.saleCount,
    discPair:  config.discPair,
    metas:     config.metas || {},
  };

  var round = POS.Loader.buildSingleRound(tier);
  round.isTutorial     = true;
  round.tutorialId     = tutId;
  round.tutorialPhase  = phase; // 'tutorial' | 'practice'
  return round;
};

POS.Game = Game;
})();
