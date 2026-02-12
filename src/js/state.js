/* src/js/state.js — Event bus + game state */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

/* ---- Simple pub/sub event bus ---- */
POS.Bus = {
  _h: {},
  on: function (evt, fn)  { (this._h[evt] || (this._h[evt] = [])).push(fn); },
  off: function (evt, fn) { var a = this._h[evt]; if (a) this._h[evt] = a.filter(function (f) { return f !== fn; }); },
  emit: function (evt) {
    var args = Array.prototype.slice.call(arguments, 1);
    (this._h[evt] || []).forEach(function (fn) { fn.apply(null, args); });
  },
};

/* ---- Mutable game state singleton ---- */
POS.State = {
  phase: 'title',
  round: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,

  satisfaction: 100,
  mistakeCount: 0,

  posItems: [],
  bagCount: 0,

  scanPhase: 'idle',
  selectedItemId: null,
  holdProgress: 0,
  currentBarcodeHit: null,

  dragActive: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  itemX: 0,
  itemY: 0,

  autoBagTimer: 0,
  phaseTimer: 0,

  resetGame: function () {
    this.phase = 'title';
    this.round = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
  },

  resetRound: function () {
    this.satisfaction = 100;
    this.mistakeCount = 0;
    this.posItems = [];
    this.bagCount = 0;
    this.scanPhase = 'idle';
    this.selectedItemId = null;
    this.holdProgress = 0;
    this.currentBarcodeHit = null;
    this.dragActive = false;
    this.autoBagTimer = 0;
  },
};

})();
