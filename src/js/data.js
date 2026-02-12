/* src/js/data.js — Pure data definitions */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

POS.ITEMS = {
  banana:  {
    id:'banana', emoji:'🍌', name:'バナナ', nameEn:'BANANA', price:100,
    barcodes: [{ x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' }]
  },
  milk: {
    id:'milk', emoji:'🥛', name:'牛乳', nameEn:'MILK', price:190,
    barcodes: [{ x:0.15, y:0.76, w:0.70, h:0.18, type:'normal' }]
  },
  bread: {
    id:'bread', emoji:'🍞', name:'食パン', nameEn:'BREAD', price:250,
    barcodes: [{ x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' }]
  },
  apple: {
    id:'apple', emoji:'🍎', name:'りんご', nameEn:'APPLE', price:150,
    barcodes: [{ x:0.25, y:0.76, w:0.50, h:0.18, type:'normal' }]
  },
  egg: {
    id:'egg', emoji:'🥚', name:'たまご', nameEn:'EGG', price:220,
    barcodes: [{ x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' }]
  },
  ramen: {
    id:'ramen', emoji:'🍜', name:'ラーメン', nameEn:'RAMEN', price:180,
    barcodes: [{ x:0.15, y:0.76, w:0.70, h:0.18, type:'normal' }]
  },
  onigiri: {
    id:'onigiri', emoji:'🍙', name:'おにぎり', nameEn:'ONIGIRI', price:130,
    barcodes: [{ x:0.25, y:0.76, w:0.50, h:0.18, type:'normal' }]
  },
  cola: {
    id:'cola', emoji:'🥤', name:'コーラ', nameEn:'COLA', price:120,
    barcodes: [{ x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' }]
  },
  /* --- Sale items: multiple barcodes, lowest discount = correct --- */
  meat: {
    id:'meat', emoji:'🍖', name:'特売肉', nameEn:'MEAT', price:480, isSale:true,
    barcodes: [
      { x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' },
      { x:0.00, y:0.18, w:0.44, h:0.24, type:'discount', discountRate:10, label:'10%OFF' },
      { x:0.56, y:0.18, w:0.44, h:0.24, type:'discount', discountRate:30, label:'30%OFF' },
    ]
  },
  juice: {
    id:'juice', emoji:'🧃', name:'ジュース', nameEn:'JUICE', price:160, isSale:true,
    barcodes: [
      { x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' },
      { x:0.00, y:0.12, w:0.46, h:0.24, type:'discount', discountRate:15, label:'15%OFF' },
      { x:0.54, y:0.12, w:0.46, h:0.24, type:'discount', discountRate:20, label:'20%OFF' },
    ]
  },
  choco: {
    id:'choco', emoji:'🍫', name:'チョコ', nameEn:'CHOCO', price:200, isSale:true,
    barcodes: [
      { x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' },
      { x:0.00, y:0.20, w:0.44, h:0.24, type:'discount', discountRate:5, label:'5%OFF' },
      { x:0.56, y:0.20, w:0.44, h:0.24, type:'discount', discountRate:25, label:'25%OFF' },
    ]
  },
};

POS.CUSTOMER_TYPES = {
  rushed: { id:'rushed', emoji:'😤', name:'급한 손님',     drainMult:1.5, mistakePenalty:8,  scoreMult:1.2 },
  picky:  { id:'picky',  emoji:'🧐', name:'까다로운 손님', drainMult:0.7, mistakePenalty:20, scoreMult:1.0 },
  kind:   { id:'kind',   emoji:'😊', name:'친절한 손님',   drainMult:1.0, mistakePenalty:12, scoreMult:0.8 },
};

POS.ROUNDS = [
  /* R1  */ { customer:'kind',   drainRate:2.0, items:[{id:'banana',qty:5},{id:'bread',qty:5}] },
  /* R2  */ { customer:'kind',   drainRate:2.5, items:[{id:'milk',qty:1},{id:'apple',qty:2},{id:'onigiri',qty:1}] },
  /* R3  */ { customer:'kind',   drainRate:3.0, items:[{id:'banana',qty:2},{id:'egg',qty:1},{id:'cola',qty:1}] },
  /* R4  */ { customer:'rushed', drainRate:3.5, items:[{id:'ramen',qty:1},{id:'onigiri',qty:2},{id:'milk',qty:1},{id:'bread',qty:1}] },
  /* R5  */ { customer:'picky',  drainRate:3.0, items:[{id:'apple',qty:1},{id:'meat',qty:1},{id:'cola',qty:1},{id:'banana',qty:1}] },
  /* R6  */ { customer:'rushed', drainRate:4.0, items:[{id:'egg',qty:2},{id:'ramen',qty:1},{id:'bread',qty:1},{id:'juice',qty:1}] },
  /* R7  */ { customer:'picky',  drainRate:3.5, items:[{id:'milk',qty:1},{id:'choco',qty:1},{id:'onigiri',qty:2},{id:'apple',qty:1}] },
  /* R8  */ { customer:'rushed', drainRate:4.5, items:[{id:'meat',qty:1},{id:'juice',qty:1},{id:'ramen',qty:1},{id:'cola',qty:2}] },
  /* R9  */ { customer:'picky',  drainRate:4.0, items:[{id:'egg',qty:1},{id:'bread',qty:1},{id:'choco',qty:1},{id:'banana',qty:2},{id:'milk',qty:1}] },
  /* R10 */ { customer:'rushed', drainRate:5.0, items:[{id:'meat',qty:1},{id:'juice',qty:1},{id:'apple',qty:2},{id:'onigiri',qty:1},{id:'ramen',qty:1}] },
];

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
  roundIntroTime: 2.0,
  roundClearTime: 2.0,
};

POS.getCorrectDiscount = function (itemId) {
  var item = POS.ITEMS[itemId];
  if (!item || !item.isSale) return null;
  var discounts = item.barcodes.filter(function (b) { return b.type === 'discount'; });
  if (!discounts.length) return null;
  return discounts.reduce(function (min, b) { return b.discountRate < min.discountRate ? b : min; }, discounts[0]);
};

})();
