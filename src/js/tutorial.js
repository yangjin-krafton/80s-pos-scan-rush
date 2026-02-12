/* src/js/tutorial.js — First-time in-game tooltip tutorial */
(function () {
'use strict';
var POS   = window.POS || (window.POS = {});
var Bus   = POS.Bus;
var State = POS.State;


var STEPS = [
  /* --- Basic scan flow --- */
  /* 0 */ { target: '.cart-desktop',       text: '\uD83D\uDC46 \uBB3C\uAC74\uC744 \uC9D1\uC5B4\uBCF4\uC138\uC694!',                               pos: 'top'    },
  /* 1 */ { target: '.scanner-drop',       text: '\uD83D\uDC47 \uC2A4\uCE90\uB108\uC5D0 \uC62C\uB824\uC8FC\uC138\uC694!',                          pos: 'top'    },
  /* 2 */ { target: null,                  text: '\u2705 \uC88B\uC544\uC694! \uC2A4\uCE94 \uC131\uACF5!',                                           pos: 'center', auto: 2000 },
  /* 3 */ { target: '.pos-scroll',         text: '\uD83D\uDCCB \uC2A4\uCE94 \uD56D\uBAA9\uC774 \uC5EC\uAE30 \uB4F1\uB85D\uB3FC\uC694',            pos: 'center', auto: 2500 },
  /* --- Game goal: scan ALL items --- */
  /* 4 */ { target: '.cart-desktop',       text: '\uD83D\uDED2 \uCE74\uD2B8\uC758 \uBAA8\uB4E0 \uC0C1\uD488\uC744 \uC2A4\uCE94\uD558\uC138\uC694!', pos: 'top'    },
  /* 5 */ { target: '.pos-scroll',         text: '\uD83D\uDD22 \uC218\uB7C9\uB3C4 \uB9DE\uCDB0\uC57C \uD574\uC694!',                               pos: 'center' },
  /* --- Strategy hints --- */
  /* 6 */ { target: '.customer-scene',     text: '\u23F0 \uACE0\uAC1D \uC778\uB0B4\uC2EC\uC774 \uC904\uACE0 \uC788\uC5B4\uC694!',                  pos: 'bottom', auto: 3000 },
  /* 7 */ { target: '.discount-ctrl',      text: '\uD83C\uDFF7\uFE0F \uD560\uC778 \uC0C1\uD488\uC740 \uD560\uC778\uC728 \uBA3C\uC800 \uC124\uC815!', pos: 'bottom', auto: 3000 },
  /* 8 */ { target: '.pos-foot',           text: '\uD83D\uDCA1 POS \uB4F1\uB85D\uC774 \uC815\uD655\uD574\uC57C \uACC4\uC0B0 \uC131\uACF5!',       pos: 'top',    auto: 3000 },
  /* --- Checkout --- */
  /* 9 */ { target: '.pos-foot .checkout', text: '\uD83D\uDCB0 \uC804\uBD80 \uC2A4\uCE94\uD588\uC73C\uBA74 \uACC4\uC0B0!',                        pos: 'top',    auto: 10000 },
];

function Tutorial() {
  this.active  = false;
  this.step    = -1;
  this._tipEl  = null;
  this._glowEl = null;
  this._timer  = null;
  this._gameEl = null;
}

Tutorial.prototype.init = function () {
  this._gameEl = document.querySelector('.game');
  if (!this._gameEl) return;
  this._createTip();
  this._listen();
};

Tutorial.prototype._reset = function () {
  if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  this._hideTip();
  this._setGlow(null);
  this.active = true;
  this.step = -1;
};

Tutorial.prototype._createTip = function () {
  var el = document.createElement('div');
  el.className = 'tut-tip';
  this._gameEl.appendChild(el);
  this._tipEl = el;
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

  /* Reset tutorial every game start (round 0), end if past round 0 */
  Bus.on('roundStart', function (idx) {
    if (idx === 0) self._reset();
    else if (self.active) self._complete();
  });
};

Tutorial.prototype._show = function (idx) {
  if (idx >= STEPS.length) { this._complete(); return; }
  this.step = idx;
  var s = STEPS[idx];

  /* Highlight target */
  this._setGlow(s.target ? document.querySelector(s.target) : null);

  /* Position & show tooltip */
  this._posTip(s.target ? document.querySelector(s.target) : null, s.text, s.pos);

  /* Auto-dismiss timer */
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

POS.Tutorial = Tutorial;
})();
