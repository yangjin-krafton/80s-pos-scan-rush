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
  /* 0 */ { target: '.cart-desktop',       text: '\uD83D\uDC46 \uBB3C\uAC74\uC744 \uC9D1\uC5B4\uBCF4\uC138\uC694!',                               pos: 'top'    },
  /* 1 */ { target: '.scanner-drop',       text: '\uD83D\uDC47 \uC2A4\uCE90\uB108\uC5D0 \uC62C\uB824\uC8FC\uC138\uC694!',                          pos: 'top'    },
  /* 2 */ { target: null,                  text: '\u2705 \uC88B\uC544\uC694! \uC2A4\uCE94 \uC131\uACF5!',                                           pos: 'center', auto: 2000 },
  /* 3 */ { target: '.pos-scroll',         text: '\uD83D\uDCCB \uC2A4\uCE94 \uD56D\uBAA9\uC774 \uC5EC\uAE30 \uB4F1\uB85D\uB3FC\uC694',            pos: 'center', auto: 2500 },
  /* --- Game goal: scan ALL items --- */
  /* 4 */ { target: '.cart-desktop',       text: '\uD83D\uDED2 \uCE74\uD2B8\uC758 \uBAA8\uB4E0 \uC0C1\uD488\uC744 \uC2A4\uCE94\uD558\uC138\uC694!', pos: 'top'    },
  /* 5 */ { target: '.pos-scroll',         text: '\uD83D\uDD22 \uC218\uB7C9\uB3C4 \uB9DE\uCDB0\uC57C \uD574\uC694!',                               pos: 'center' },
  /* --- Discount & satisfaction --- */
  /* 6 */ { target: '.discount-ctrl',      text: '\uD83C\uDFF7\uFE0F \uD560\uC778 \uC0C1\uD488\uC740 \uD560\uC778\uC728 \uBA3C\uC800 \uC124\uC815!', pos: 'bottom', auto: 3500 },
  /* 7 */ { target: '.customer-scene',     text: '\u23F0 \uACE0\uAC1D \uC778\uB0B4\uC2EC\uC774 \uC904\uACE0 \uC788\uC5B4\uC694!',                  pos: 'bottom', auto: 3000 },
  /* --- POS qty control --- */
  /* 8 */ { target: '.pos-scroll',         text: '\u00B1 POS\uC758 +/- \uBC84\uD2BC\uC73C\uB85C \uC218\uB7C9 \uC870\uC808 \uAC00\uB2A5!',         pos: 'center', auto: 3000 },
  /* --- Checkout --- */
  /* 9 */ { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC804\uBD80 \uC2A4\uCE94\uD588\uC73C\uBA74 \uACC4\uC0B0!',                        pos: 'top',    auto: 10000 },
];

/* ================================================================
   Meta Event First-Encounter Alerts
   Each meta shows a brief tooltip the FIRST time it appears in a session.
   ================================================================ */
var META_INTROS = {
  damagedBarcode: {
    text: '\u26A0\uFE0F \uBC14\uCF54\uB4DC \uD6FC\uC190! \u00D7 \uD45C\uC2DC \uCE74\uB4DC\uB294 \uC2A4\uCE94 \uBD88\uAC00!\n\uAC19\uC740 \uC0C1\uD488\uC758 \uC815\uC0C1 \uBCF5\uC0AC\uBCF8\uC744 \uCC3E\uC73C\uC138\uC694.',
    target: '.cart-desktop',
    pos: 'top',
    duration: 4500,
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

  /* Start tutorial when first round is ready */
  Bus.on('roundReady', function () {
    if (!self.active || self.step !== -1) return;
    if (State.round !== 0) return;
    self._show(0);
  });

  /* Step dismiss events — action-based steps */
  Bus.on('cardPickup', function () {
    if (self.active && (self.step === 0 || self.step === 4)) self._advance();
  });
  Bus.on('scanComplete', function () {
    if (self.active && (self.step === 1 || self.step === 5)) self._advance();
  });
  Bus.on('checkoutClick', function () {
    if (self.active && self.step === 9) self._advance();
  });

  /* Full reset on every new game (round 0) — basic tutorial + all meta intros */
  Bus.on('roundStart', function (idx) {
    if (idx === 0) self._resetAll();
    else if (self.active) self._complete();
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
  if (idx >= STEPS.length) { this._complete(); return; }
  this.step = idx;
  var s = STEPS[idx];

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

  var next = this.step + 1;
  if (next >= STEPS.length) { this._complete(); return; }

  var self = this;
  setTimeout(function () { if (self.active) self._show(next); }, 400);
};

Tutorial.prototype._complete = function () {
  this.active = false;
  this.step = STEPS.length;
  this._hideTip();
  this._setGlow(null);
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
  /* Skip if basic tutorial is still active (don't overlap) */
  if (this.active && this.step < STEPS.length) return;

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
