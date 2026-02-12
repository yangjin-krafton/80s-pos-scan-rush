/* src/js/data.js — Empty containers + helpers (data filled by loader.js) */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

/* Loader fills these in-place at boot */
POS.ITEMS  = {};
POS.NPCS   = [];
POS.ROUNDS = [];

/* ---- Mood stages ---- */
POS.MOOD_STAGES = [
  {id:'calm',     min:70},
  {id:'impatient',min:40},
  {id:'annoyed',  min:15},
  {id:'angry',    min:0},
];

POS.getMoodStage = function (sat) {
  for (var i = 0; i < POS.MOOD_STAGES.length; i++) {
    if (sat >= POS.MOOD_STAGES[i].min) return POS.MOOD_STAGES[i].id;
  }
  return 'angry';
};

POS.pickDialogue = function (arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
};

POS.PARAMS = {
  maxSatisfaction: 100,
  scanGainRate:   1.0,
  scanDecayRate:  0.7,
  scanThreshold:  0.4,
  scanRecovery:   2,
  bagRecovery:    1,
  mistakeEscalation: 5,
  scorePerScan:      100,
  scoreComboBonus:   20,
  scoreCheckout:     300,
  scoreMistake:     -200,
  scoreTimeBonusMult: 5,
  autoBagDelay: 0.5,
  roundIntroTime: 0.0,
  roundClearTime: 0.0,
  endlessRounds: true,
  roundSeedCount: 3,
  roundChunkSize: 2,
};

POS.getCorrectDiscount = function (itemId) {
  var item = POS.ITEMS[itemId];
  if (!item || !item.isSale) return null;
  var discounts = item.barcodes.filter(function (b) { return b.type === 'discount'; });
  if (!discounts.length) return null;
  return discounts.reduce(function (min, b) { return b.discountRate < min.discountRate ? b : min; }, discounts[0]);
};

})();
