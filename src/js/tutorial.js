/* src/js/tutorial.js — First-time in-game tooltip tutorial + meta event intro */
(function () {
'use strict';
var POS   = window.POS || (window.POS = {});
var Bus   = POS.Bus;
var State = POS.State;

/* ================================================================
   Round 0 Basic Tutorial Steps
   ================================================================ */
var STEPS = [
  /* --- Basic scan flow --- */
  /* 0 */ { target: '.cart-desktop',       text: '\uD83D\uDC46 \uBB3C\uAC74\uC744 \uC9D1\uC5B4\uBCF4\uC138\uC694!',                               pos: 'top',    event: 'cardPickup' },
  /* 1 */ { target: '.scanner-drop',       text: '\uD83D\uDC47 \uC2A4\uCE90\uB108\uC5D0 \uC62C\uB824\uC8FC\uC138\uC694!',                          pos: 'top',    event: 'scanComplete' },
  /* 2 */ { target: null,                  text: '\u2705 \uC88B\uC544\uC694! \uC2A4\uCE94 \uC131\uACF5!',                                           pos: 'center', auto: 2000 },
  /* 3 */ { target: '.pos-scroll',         text: '\uD83D\uDCCB \uC2A4\uCE94 \uD56D\uBAA9\uC774 \uC5EC\uAE30 \uB4F1\uB85D\uB3FC\uC694',            pos: 'center', auto: 2500 },
  /* --- Game goal: scan ALL items --- */
  /* 4 */ { target: '.cart-desktop',       text: '\uD83D\uDED2 \uCE74\uD2B8\uC758 \uBAA8\uB4E0 \uC0C1\uD488\uC744 \uC2A4\uCE94\uD558\uC138\uC694!', pos: 'top',  event: 'cardPickup' },
  /* 5 */ { target: '.pos-scroll',         text: '\uD83D\uDD22 \uC218\uB7C9\uB3C4 \uB9DE\uCDB0\uC57C \uD574\uC694!',                               pos: 'center', event: 'scanComplete' },
  /* --- Discount & satisfaction --- */
  /* 6 */ { target: '.discount-ctrl',      text: '\uD83C\uDFF7\uFE0F \uD560\uC778 \uC0C1\uD488\uC740 \uD560\uC778\uC728 \uBA3C\uC800 \uC124\uC815!', pos: 'bottom', auto: 3500 },
  /* 7 */ { target: '.customer-scene',     text: '\u23F0 \uACE0\uAC1D \uC778\uB0B4\uC2EC\uC774 \uC904\uACE0 \uC788\uC5B4\uC694!',                  pos: 'bottom', auto: 3000 },
  /* --- POS qty control --- */
  /* 8 */ { target: '.pos-scroll',         text: '\u00B1 POS\uC758 +/- \uBC84\uD2BC\uC73C\uB85C \uC218\uB7C9 \uC870\uC808 \uAC00\uB2A5!',         pos: 'center', auto: 3000 },
  /* --- Checkout --- */
  /* 9 */ { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC804\uBD80 \uC2A4\uCE94\uD588\uC73C\uBA74 \uACC4\uC0B0!',                        pos: 'top',    auto: 10000, event: 'checkoutClick' },
];

/* ================================================================
   Mechanic-Specific Tutorial Guide Steps
   Activated during tutorial rounds (isTutorial + tutorialPhase==='tutorial')
   ================================================================ */
var TUTORIAL_ROUND_STEPS = {
  sale: [
    { target: '.discount-ctrl', text: '\uD83C\uDFF7\uFE0F \uD560\uC778 \uC0C1\uD488\uC774 \uC788\uC5B4\uC694!\n\uC544\uB798 \uBC84\uD2BC\uC73C\uB85C \uD560\uC778\uC728\uC744 \uBA3C\uC800 \uC124\uC815!', pos: 'bottom', auto: 5000 },
    { target: '.cart-desktop',  text: '\uD83D\uDED2 \uD560\uC778 \uC2A4\uD2F0\uCEE4 \uC0C1\uD488\uC744 \uC7A1\uC544 \uB4DC\uB798\uADF8!', pos: 'top', event: 'cardPickup' },
    { target: null,             text: '\uD83D\uDCE6 \uD560\uC778 \uBC14\uCF54\uB4DC\uC5D0 \uB9DE\uCDB0 \uC2A4\uCE94!', pos: 'center', event: 'scanComplete' },
    { target: null,             text: '\u2705 \uC88B\uC544\uC694! \uB098\uBA38\uC9C0 \uC0C1\uD488\uB3C4 \uC2A4\uCE94\uD558\uC138\uC694', pos: 'center', auto: 3000 },
    { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC804\uBD80 \uC2A4\uCE94\uD588\uC73C\uBA74 \uACC4\uC0B0!', pos: 'top', event: 'checkoutClick' },
  ],
  damagedBarcode: [
    { target: '.cart-desktop',  text: '\u26A0\uFE0F \u274C \uD45C\uC2DC = \uBC14\uCF54\uB4DC \uD6FC\uC190!\n\uC774 \uCE74\uB4DC\uB294 \uC2A4\uCE94\uC774 \uBD88\uAC00\uB2A5\uD574\uC694!', pos: 'top', auto: 5000 },
    { target: '.cart-desktop',  text: '\uD83D\uDD0D \uAC19\uC740 \uC0C1\uD488\uC758 \uC815\uC0C1 \uCE74\uB4DC\uB97C \uCC3E\uC544\n\uB4DC\uB798\uADF8\uD574\uC11C \uC2A4\uCE94\uD558\uC138\uC694!', pos: 'top', event: 'cardPickup' },
    { target: null,             text: '\uD83D\uDCE6 \uC2A4\uCE90\uB108\uC5D0 \uC62C\uB824 \uC2A4\uCE94!', pos: 'center', event: 'scanComplete' },
    { target: '.pos-scroll',   text: '\uD83D\uDCCB \uD6FC\uC190\uB41C \uC218\uB7C9\uB9CC\uD07C POS\uC758\n\u002B \uBC84\uD2BC\uC73C\uB85C \uC218\uB7C9\uC744 \uB9DE\uCDB0\uC8FC\uC138\uC694!', pos: 'center', auto: 6000 },
    { target: null,             text: '\u2705 \uB098\uBA38\uC9C0 \uC0C1\uD488\uB3C4 \uAC19\uC740 \uBC29\uBC95\uC73C\uB85C!', pos: 'center', auto: 3000 },
    { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC804\uBD80 \uC218\uB7C9 \uB9DE\uCDB4 \uD6C4 \uACC4\uC0B0!', pos: 'top', event: 'checkoutClick' },
  ],
  promo: [
    { target: '.cart-desktop',  text: '\uD83C\uDF81 1+1 \uC0C1\uD488! \uC720\uB8CC\uBD84 + \uBB34\uB8CC\uBD84 \uBAA8\uB450 \uC2A4\uCE94!', pos: 'top', auto: 5000 },
    { target: '.cart-desktop',  text: '\uD83D\uDCE6 \uBA3C\uC800 \uC77C\uBC18 \uC2A4\uCE94\uC73C\uB85C \uC720\uB8CC\uBD84!', pos: 'top', event: 'scanComplete' },
    { target: '#free-toggle',   text: '\uD83C\uDD93 \uC774\uC81C \uBB34\uB8CC \uD1A0\uAE00 ON!\n\uBB34\uB8CC\uBD84\uB3C4 \uC2A4\uCE94\uD558\uC138\uC694', pos: 'bottom', auto: 5000 },
    { target: null,             text: '\u2705 \uC798\uD588\uC5B4\uC694! \uB098\uBA38\uC9C0\uB3C4 \uD655\uC778!', pos: 'center', auto: 3000 },
    { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC804\uBD80 \uC2A4\uCE94 \uD6C4 \uACC4\uC0B0!', pos: 'top', event: 'checkoutClick' },
  ],
  midAdd: [
    { target: '.cart-desktop',  text: '\uD83D\uDCE6 \uBA3C\uC800 \uC0C1\uD488\uC744 \uC2A4\uCE94\uD558\uC138\uC694!\n\uC7A0\uC2DC \uD6C4 \uC190\uB2D8\uC774 \uCD94\uAC00 \uC694\uCCAD!', pos: 'top', auto: 6000 },
    { target: null,             text: '\uD83D\uDED2 ADD \uC0C1\uD488\uC774 \uCD94\uAC00\uB418\uBA74\n\uADF8\uAC83\uB3C4 \uAF2D \uC2A4\uCE94\uD558\uC138\uC694!', pos: 'center', auto: 4000 },
    { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uCD94\uAC00 \uC0C1\uD488 \uD3EC\uD568 \uC804\uBD80 \uC2A4\uCE94 \uD6C4 \uACC4\uC0B0!', pos: 'top', event: 'checkoutClick' },
  ],
  midCancel: [
    { target: '.cart-desktop',  text: '\uD83D\uDCE6 \uBA3C\uC800 \uC0C1\uD488\uC744 \uC2A4\uCE94\uD558\uC138\uC694!\n\uC7A0\uC2DC \uD6C4 \uC190\uB2D8\uC774 \uCDE8\uC18C \uC694\uCCAD!', pos: 'top', auto: 6000 },
    { target: '.pos-scroll',   text: '\u274C \uCDE8\uC18C \uC694\uCCAD\uC774 \uC624\uBA74\nPOS\uC5D0\uC11C \u2212\uB85C \uC218\uB7C9\uC744 \uBE7C\uC138\uC694!', pos: 'center', auto: 4000 },
    { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC870\uC815 \uD6C4 \uACC4\uC0B0!', pos: 'top', event: 'checkoutClick' },
  ],
};

/* ================================================================
   Meta Event First-Encounter Alerts
   Each meta shows a brief tooltip the FIRST time it appears in a session.
   ================================================================ */
var META_INTROS = {
  sale: {
    text: '\uD83C\uDFF7\uFE0F \uD560\uC778 \uC0C1\uD488\uC774\uC5D0\uC694!\n\uD560\uC778\uC728\uC744 \uC124\uC815\uD558\uACE0 \uD560\uC778 \uBC14\uCF54\uB4DC\uB97C \uC2A4\uCE94\uD558\uC138\uC694.',
    target: '.discount-ctrl',
    pos: 'bottom',
    duration: 5000,
  },
  damagedBarcode: {
    text: '\u26A0\uFE0F \uBC14\uCF54\uB4DC \uD6FC\uC190! \u274C \uCE74\uB4DC\uB294 \uC2A4\uCE94 \uBD88\uAC00!\n\uC815\uC0C1 \uCE74\uB4DC \uC2A4\uCE94 \uD6C4 POS +\uB85C \uC218\uB7C9 \uC870\uC808!',
    target: '.cart-desktop',
    pos: 'top',
    duration: 5000,
  },
  midAdd: {
    text: '\uD83D\uDED2 \uC190\uB2D8\uC774 \uCD94\uAC00 \uC0C1\uD488\uC744 \uC694\uCCAD\uD588\uC5B4\uC694!\nADD \uB9C8\uD06C \uC0C1\uD488\uB3C4 \uC2A4\uCE94\uD574\uC8FC\uC138\uC694.',
    target: '.cart-desktop',
    pos: 'top',
    duration: 4000,
  },
  midCancel: {
    text: '\u274C \uC190\uB2D8\uC774 \uC0C1\uD488 \uCDE8\uC18C\uB97C \uC694\uCCAD\uD588\uC5B4\uC694!\nCANCEL \uC0C1\uD488\uC740 POS\uC5D0\uC11C \uBE7C\uC8FC\uC138\uC694.',
    target: '.pos-scroll',
    pos: 'center',
    duration: 4000,
  },
  posBlackout: {
    text: '\uD83D\uDDA5\uFE0F POS \uD654\uBA74\uC774 \uAEBC\uC84C\uC5B4\uC694!\n\uC7A0\uC2DC \uD6C4 \uBCF5\uAD6C\uB429\uB2C8\uB2E4. \uB370\uC774\uD130\uB294 \uC548\uC804!',
    target: '.pos-panel',
    pos: 'center',
    duration: 3500,
  },
  mixedSale: {
    text: '\uD83C\uDFF7\uFE0F \uAC19\uC740 \uC0C1\uD488\uC774 \uC138\uC77C/\uBE44\uC138\uC77C\uB85C \uC788\uC5B4\uC694!\n\uD560\uC778 \uC124\uC815\uC744 \uC798 \uAD6C\uBD84\uD558\uC138\uC694.',
    target: '.cart-desktop',
    pos: 'top',
    duration: 4000,
  },
  multiDiscount: {
    text: '\uD83D\uDCB2 \uAC19\uC740 \uC0C1\uD488\uC5D0 \uB2E4\uB978 \uD560\uC778\uC728!\n\uAC01\uAC01 \uC62C\uBC14\uB978 \uD560\uC778 \uBC14\uCF54\uB4DC\uB97C \uC2A4\uCE94\uD558\uC138\uC694.',
    target: '.cart-desktop',
    pos: 'top',
    duration: 4500,
  },
  highQty: {
    text: '\uD83D\uDCE6 \uB300\uB7C9 \uAD6C\uB9E4 \uC190\uB2D8! \uAC19\uC740 \uC0C1\uD488 \uC5EC\uB7EC \uAC1C\uC528\uC694.\n\uC218\uB7C9\uC744 \uC798 \uB9DE\uCDB0\uC8FC\uC138\uC694!',
    target: '.cart-desktop',
    pos: 'top',
    duration: 3500,
  },
};

/* ================================================================
   Tutorial Class
   ================================================================ */

function Tutorial() {
  this.active  = false;
  this.step    = -1;
  this._tipEl  = null;
  this._glowEl = null;
  this._timer  = null;
  this._gameEl = null;
  this._currentSteps = null; /* active step sequence (STEPS or mechanic-specific) */

  /* Meta intro tracking: which metas have been shown this session */
  this._seenMetas = {};
  this._metaTipEl = null;
  this._metaTimer = null;
}

Tutorial.prototype.init = function () {
  this._gameEl = document.querySelector('.game');
  if (!this._gameEl) return;
  this._createTip();
  this._createMetaTip();
  this._listen();
};

/* Full reset: basic tutorial + all meta intros cleared.
   Called on every new game start (first load, retry after game over). */
Tutorial.prototype._resetAll = function () {
  /* basic tutorial */
  if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  this._hideTip();
  this._setGlow(null);
  this.active = true;
  this.step = -1;
  this._currentSteps = STEPS;

  /* meta intros — clear so every meta tip shows once in the new game */
  this._seenMetas = {};
  this._hideMetaTip();
};

Tutorial.prototype._createTip = function () {
  var el = document.createElement('div');
  el.className = 'tut-tip';
  this._gameEl.appendChild(el);
  this._tipEl = el;
};

Tutorial.prototype._createMetaTip = function () {
  var el = document.createElement('div');
  el.className = 'tut-meta-tip';
  this._gameEl.appendChild(el);
  this._metaTipEl = el;
};

Tutorial.prototype._listen = function () {
  var self = this;

  /* Start tutorial when round is ready */
  Bus.on('roundReady', function () {
    var round = POS.ROUNDS[State.round];

    /* Mechanic tutorial guide: activate step sequence for tutorial rounds */
    if (round && round.isTutorial && round.tutorialPhase === 'tutorial') {
      var mechSteps = TUTORIAL_ROUND_STEPS[round.tutorialId];
      if (mechSteps) {
        self._currentSteps = mechSteps;
        self.active = true;
        self.step = -1;
        self._show(0);
      }
      return;
    }

    /* Basic tutorial for round 0 */
    if (!self.active || self.step !== -1) return;
    if (State.round !== 0) return;
    self._show(0);
  });

  /* Step dismiss events — generic event-based advancement */
  Bus.on('cardPickup',    function () { self._advanceOnEvent('cardPickup'); });
  Bus.on('scanComplete',  function () { self._advanceOnEvent('scanComplete'); });
  Bus.on('checkoutClick', function () { self._advanceOnEvent('checkoutClick'); });
  Bus.on('midAdd',        function () { self._advanceOnEvent('midAdd'); });
  Bus.on('midCancel',     function () { self._advanceOnEvent('midCancel'); });

  /* Full reset on every new game (round 0) — basic tutorial + all meta intros */
  Bus.on('roundStart', function (idx) {
    if (idx === 0) {
      self._currentSteps = STEPS;
      self._resetAll();
    } else if (self.active) {
      self._complete();
    }
  });

  /* Also reset on game over so next game gets fresh tutorials */
  Bus.on('gameOver', function () {
    self._resetAll();
  });

  /* ---- Meta first-encounter listeners ---- */

  /* Check for meta intros at round start (for generation-time metas) */
  Bus.on('roundStart', function () {
    var round = POS.ROUNDS[State.round];
    if (!round || !round.metas) return;

    /* Tutorial round: force-show the mechanic's meta intro (ignore seenMetas) */
    if (round.isTutorial && round.tutorialPhase === 'tutorial') {
      var metaId = round.tutorialId;
      var intro = META_INTROS[metaId];
      if (intro) {
        /* Delay slightly so UI is ready */
        setTimeout(function () { self._displayMetaTip(intro); }, 600);
      }
      return; /* skip normal meta checks for tutorial rounds */
    }

    var metas = round.metas;

    /* damagedBarcode: check if any item has damagedCopies */
    if (metas.damagedBarcode) {
      var hasDamaged = false;
      for (var i = 0; i < round.items.length; i++) {
        if (round.items[i].damagedCopies) { hasDamaged = true; break; }
      }
      if (hasDamaged) self._showMetaIntro('damagedBarcode');
    }

    /* highQty: check if any item has qty > 3 */
    if (metas.highQty) {
      for (var h = 0; h < round.items.length; h++) {
        if (round.items[h].qty > 3) { self._showMetaIntro('highQty'); break; }
      }
    }

    /* mixedSale: check round for same baseId as sale+non-sale */
    if (metas.mixedSale) {
      var bases = {};
      var hasMixed = false;
      for (var m = 0; m < round.items.length; m++) {
        var itm = POS.ITEMS[round.items[m].id];
        if (!itm) continue;
        var key = itm.baseId + (itm.isSale ? '_s' : '_n');
        var other = itm.baseId + (itm.isSale ? '_n' : '_s');
        if (bases[other]) { hasMixed = true; break; }
        bases[key] = true;
      }
      if (hasMixed) self._showMetaIntro('mixedSale');
    }

    /* multiDiscount: check round for same baseId with different discount items */
    if (metas.multiDiscount) {
      var discBases = {};
      var hasMultiDisc = false;
      for (var d = 0; d < round.items.length; d++) {
        var di = POS.ITEMS[round.items[d].id];
        if (!di || !di.isSale) continue;
        if (discBases[di.baseId]) { hasMultiDisc = true; break; }
        discBases[di.baseId] = true;
      }
      if (hasMultiDisc) self._showMetaIntro('multiDiscount');
    }
  });

  /* Runtime meta events */
  Bus.on('midAdd', function () { self._showMetaIntro('midAdd'); });
  Bus.on('midCancel', function () { self._showMetaIntro('midCancel'); });
  Bus.on('posBlackout', function (on) {
    if (on) self._showMetaIntro('posBlackout');
  });
};

/* ================================================================
   Basic Tutorial Methods
   ================================================================ */

Tutorial.prototype._show = function (idx) {
  var steps = this._currentSteps || STEPS;
  if (idx >= steps.length) { this._complete(); return; }
  this.step = idx;
  var s = steps[idx];

  this._setGlow(s.target ? document.querySelector(s.target) : null);
  this._posTip(s.target ? document.querySelector(s.target) : null, s.text, s.pos);

  if (s.auto) {
    var self = this;
    this._timer = setTimeout(function () {
      if (self.active && self.step === idx) self._advance();
    }, s.auto);
  }
};

Tutorial.prototype._advance = function () {
  if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  this._hideTip();
  this._setGlow(null);

  var steps = this._currentSteps || STEPS;
  var next = this.step + 1;
  if (next >= steps.length) { this._complete(); return; }

  var self = this;
  setTimeout(function () { if (self.active) self._show(next); }, 400);
};

Tutorial.prototype._complete = function () {
  var steps = this._currentSteps || STEPS;
  this.active = false;
  this.step = steps.length;
  this._hideTip();
  this._setGlow(null);
};

/* ---- Event-based step advancement ---- */

Tutorial.prototype._advanceOnEvent = function (evt) {
  if (!this.active || this.step < 0) return;
  var steps = this._currentSteps || STEPS;
  if (this.step >= steps.length) return;
  if (steps[this.step].event === evt) this._advance();
};

/* ---- glow highlight ---- */

Tutorial.prototype._setGlow = function (el) {
  if (this._glowEl) this._glowEl.classList.remove('tut-glow');
  this._glowEl = el || null;
  if (el) el.classList.add('tut-glow');
};

/* ---- tooltip positioning ---- */

Tutorial.prototype._posTip = function (target, text, pos) {
  var tip = this._tipEl;
  if (!tip) return;
  tip.textContent = text;

  if (!target) {
    tip.style.left = '180px';
    tip.style.top  = '300px';
    tip.className = 'tut-tip visible pos-center';
    return;
  }

  var gr = this._gameEl.getBoundingClientRect();
  var s  = gr.width / 360;
  var tr = target.getBoundingClientRect();

  var tx = (tr.left - gr.left) / s;
  var ty = (tr.top  - gr.top)  / s;
  var tw = tr.width  / s;
  var th = tr.height / s;

  switch (pos) {
    case 'top':
      tip.style.left = Math.round(tx + tw / 2) + 'px';
      tip.style.top  = Math.round(ty - 8) + 'px';
      break;
    case 'bottom':
      tip.style.left = Math.round(tx + tw / 2) + 'px';
      tip.style.top  = Math.round(ty + th + 8) + 'px';
      break;
    case 'left':
      tip.style.left = Math.round(tx - 8) + 'px';
      tip.style.top  = Math.round(ty + th / 2) + 'px';
      break;
    case 'right':
      tip.style.left = Math.round(tx + tw + 8) + 'px';
      tip.style.top  = Math.round(ty + th / 2) + 'px';
      break;
    case 'center':
      tip.style.left = Math.round(tx + tw / 2) + 'px';
      tip.style.top  = Math.round(ty + th / 2) + 'px';
      break;
  }

  tip.className = 'tut-tip visible pos-' + pos;
};

Tutorial.prototype._hideTip = function () {
  if (this._tipEl) this._tipEl.classList.remove('visible');
};

/* ================================================================
   Meta First-Encounter Intro System
   ================================================================ */

Tutorial.prototype._showMetaIntro = function (metaId) {
  /* Skip if already seen this session */
  if (this._seenMetas[metaId]) return;
  /* Skip if any tutorial guide is still active (don't overlap) */
  var steps = this._currentSteps || STEPS;
  if (this.active && this.step < steps.length) return;

  var intro = META_INTROS[metaId];
  if (!intro) return;

  this._seenMetas[metaId] = true;
  this._displayMetaTip(intro);
};

Tutorial.prototype._displayMetaTip = function (intro) {
  var tip = this._metaTipEl;
  if (!tip) return;
  var self = this;

  /* Clear any existing meta tip */
  if (this._metaTimer) { clearTimeout(this._metaTimer); this._metaTimer = null; }

  /* Set text (support multiline with \n) */
  tip.innerHTML = '';
  var lines = intro.text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (i > 0) tip.appendChild(document.createElement('br'));
    tip.appendChild(document.createTextNode(lines[i]));
  }

  /* Position based on target */
  var target = intro.target ? document.querySelector(intro.target) : null;
  if (target && this._gameEl) {
    var gr = this._gameEl.getBoundingClientRect();
    var s  = gr.width / 360;
    var tr = target.getBoundingClientRect();
    var tx = (tr.left - gr.left) / s;
    var ty = (tr.top  - gr.top)  / s;
    var tw = tr.width  / s;
    var th = tr.height / s;

    switch (intro.pos) {
      case 'top':
        tip.style.left = Math.round(tx + tw / 2) + 'px';
        tip.style.top  = Math.round(ty - 8) + 'px';
        break;
      case 'center':
        tip.style.left = Math.round(tx + tw / 2) + 'px';
        tip.style.top  = Math.round(ty + th / 2) + 'px';
        break;
      default:
        tip.style.left = '180px';
        tip.style.top  = '300px';
    }
  } else {
    tip.style.left = '180px';
    tip.style.top  = '300px';
  }

  /* Show with entrance animation */
  tip.classList.add('visible');

  /* Auto-dismiss */
  this._metaTimer = setTimeout(function () {
    self._hideMetaTip();
  }, intro.duration || 4000);
};

Tutorial.prototype._hideMetaTip = function () {
  if (this._metaTipEl) this._metaTipEl.classList.remove('visible');
  if (this._metaTimer) { clearTimeout(this._metaTimer); this._metaTimer = null; }
};

POS.Tutorial = Tutorial;
})();
