/* src/js/data.js — Empty containers + helpers (data filled by loader.js) */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

/* Loader fills these in-place at boot */
POS.ITEMS  = {};
POS.NPCS   = [];
POS.ROUNDS = [];
POS.ENCOURAGEMENTS = [];

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
  /* meta event params */
  midAddSatBoost: 3,
  midCancelSatDrain: 5,
  blackoutCheckoutBlock: true,
  /* promo params */
  promoScanRecovery: 8,
  timePerPromo: 2.0,
  /* time-budget balance constants */
  timePerNormal: 1.3,
  timePerSale:   2.2,
  marginEasy:    2.0,
  marginHard:    1.05,
  marginPeak:    15,
};

POS.getCorrectDiscount = function (itemId) {
  var item = POS.ITEMS[itemId];
  if (!item || !item.isSale) return null;
  var discounts = item.barcodes.filter(function (b) { return b.type === 'discount'; });
  if (!discounts.length) return null;
  return discounts.reduce(function (min, b) { return b.discountRate < min.discountRate ? b : min; }, discounts[0]);
};

/* ---- Tutorial round definitions ---- */
POS.TUTORIAL_ORDER = ['sale','damagedBarcode','promo','midAdd','midCancel'];

POS.TUTORIAL_DEFS = {
  sale: {
    unlockDR: 2,
    label: '\uD560\uC778 \uC2A4\uCE94',
    tutorial: { products:2, qtyMin:3, qtyMax:4, saleCount:1, discPair:[10,30], npcType:'kind', metas:{} },
    practice: { products:3, qtyMin:4, qtyMax:6, saleCount:3, discPair:[10,30], npcType:'kind', metas:{} },
  },
  damagedBarcode: {
    unlockDR: 5,
    label: '\uD6FC\uC190 \uBC14\uCF54\uB4DC',
    tutorial: { products:2, qtyMin:4, qtyMax:5, saleCount:0, discPair:null, npcType:'kind',
                metas:{ damagedBarcode:{ chance:1.0, ratio:0.5 } } },
    practice: { products:3, qtyMin:5, qtyMax:7, saleCount:0, discPair:null, npcType:'kind',
                metas:{ damagedBarcode:{ chance:1.0, ratio:0.5 } } },
  },
  promo: {
    unlockDR: 6,
    label: '1+1 \uBB34\uB8CC',
    tutorial: { products:2, qtyMin:3, qtyMax:4, saleCount:0, discPair:null, npcType:'kind',
                metas:{ promo:{ chance:1.0 } } },
    practice: { products:3, qtyMin:4, qtyMax:6, saleCount:0, discPair:null, npcType:'kind',
                metas:{ promo:{ chance:1.0 } } },
  },
  midAdd: {
    unlockDR: 6,
    label: '\uCD94\uAC00 \uC0C1\uD488',
    tutorial: { products:2, qtyMin:3, qtyMax:4, saleCount:0, discPair:null, npcType:'kind',
                metas:{ midAdd:{ chance:1.0, count:1, delay:[5,8] } } },
    practice: { products:3, qtyMin:4, qtyMax:5, saleCount:0, discPair:null, npcType:'kind',
                metas:{ midAdd:{ chance:1.0, count:2, delay:[4,6] } } },
  },
  midCancel: {
    unlockDR: 9,
    label: '\uCDE8\uC18C \uC694\uCCAD',
    tutorial: { products:3, qtyMin:5, qtyMax:6, saleCount:0, discPair:null, npcType:'kind',
                metas:{ midCancel:{ chance:1.0, count:1, delay:[5,8] } } },
    practice: { products:4, qtyMin:6, qtyMax:8, saleCount:0, discPair:null, npcType:'kind',
                metas:{ midCancel:{ chance:1.0, count:2, delay:[4,6] } } },
  },
};

})();
