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

/* ---- NPC data (10 characters for 10 rounds) ---- */
POS.NPCS = [
  /* 0: R1 — housewife_02, tutorial */
  {
    id:'housewife_02', name:'主婦', emoji:'😊', type:'kind',
    drainRate:2.2, mistakePenalty:12, scoreMult:0.9, bodyColor:'#d07090',
    dialogue: {
      greeting:['こんにちは。ゆっくりで大丈夫です。','すみません、サクッとお願いします。'],
      moodChange:{
        calm:['ゆっくりで大丈夫です。'],
        impatient:['大丈夫、大丈夫。'],
        annoyed:['まぁまぁ、落ち着いて。'],
        angry:['今日はやめときます。']
      },
      scanSuccess:['のんびりでOKです。','OKです。'],
      checkoutSuccess:['助かりました。'],
      checkoutFail:['あれ、違いました？'],
      timeout:['今日は出ます。'],
      mistake:{
        missing:['商品が一つ抜けています。','あ、これ入ってないです。'],
        qty:['もう一つあります。','一つ減らしてください。'],
        discount:['割引ついてますよね？']
      }
    }
  },
  /* 1: R2 — kid_with_parent_12 */
  {
    id:'kid_with_parent_12', name:'親子', emoji:'🙂', type:'kind',
    drainRate:2.5, mistakePenalty:12, scoreMult:0.9, bodyColor:'#60a0d0',
    dialogue: {
      greeting:['…お願いします。','すみません、サクッとお願いします。'],
      moodChange:{
        calm:['のんびりでOKです。'],
        impatient:['早く。'],
        annoyed:['まだ？'],
        angry:['もういい。']
      },
      scanSuccess:['はい。','問題ないです。'],
      checkoutSuccess:['…ありがとう。'],
      checkoutFail:['違う。'],
      timeout:['失礼します。'],
      mistake:{
        missing:['まだ通ってないですよ。','それ、まだスキャンされていません。'],
        qty:['二つのはずです。','数量が違います。'],
        discount:['その割引、別のですよね。']
      }
    }
  },
  /* 2: R3 — factory_worker_07, discount intro */
  {
    id:'factory_worker_07', name:'作業服の客', emoji:'🙂', type:'kind',
    drainRate:2.4, mistakePenalty:12, scoreMult:0.9, bodyColor:'#808060',
    dialogue: {
      greeting:['こんにちは。特売が命です。','こんにちは。今日、特売ありますか？'],
      moodChange:{
        calm:['のんびりでOKです。'],
        impatient:['特売の時間が…'],
        annoyed:['割引、忘れてませんか？'],
        angry:['割引なきゃ帰ります。']
      },
      scanSuccess:['割引、ちゃんとお願いします。','はい、それで合ってます。'],
      checkoutSuccess:['安く済みました。'],
      checkoutFail:['値段が高いです。'],
      timeout:['また来ます。'],
      mistake:{
        missing:['あ、これ入ってないです。','まだ通ってないですよ。'],
        qty:['一つ減らしてください。','二つのはずです。'],
        discount:['割引シールが違います。']
      }
    }
  },
  /* 3: R4 — korean_resident_01, Korean dialogue */
  {
    id:'korean_resident_01', name:'한국인 손님', emoji:'🇰🇷', type:'kind',
    drainRate:2.4, mistakePenalty:12, scoreMult:0.95, bodyColor:'#4080c0',
    dialogue: {
      greeting:['천천히 하셔도 돼요.','안녕하세요. 한국 사람이라 반가워요.'],
      moodChange:{
        calm:['괜찮아요, 편하게요.'],
        impatient:['괜찮아요.'],
        annoyed:['괜찮습니다.'],
        angry:['오늘은 이만요.']
      },
      scanSuccess:['괜찮아요, 편하게요.','네, 맞아요.'],
      checkoutSuccess:['수고하셨어요.'],
      checkoutFail:['어, 다르네요.'],
      timeout:['다음에 올게요.'],
      mistake:{
        missing:['이거 하나 빠졌어요.','아직 안 찍혔어요.'],
        qty:['수량이 하나 더 있어요.','하나는 빼주세요.'],
        discount:['할인 붙은 거 맞나요?']
      }
    }
  },
  /* 4: R5 — grandpa_04, slow but high penalty */
  {
    id:'grandpa_04', name:'おじいさん', emoji:'🙂', type:'picky',
    drainRate:2.0, mistakePenalty:18, scoreMult:1.0, bodyColor:'#806040',
    dialogue: {
      greeting:['…お願いします。','やあ、レジの音って落ち着くね。'],
      moodChange:{
        calm:['うむ。'],
        impatient:['早く。'],
        annoyed:['まだ？'],
        angry:['もういい。']
      },
      scanSuccess:['はい。','そのままで。'],
      checkoutSuccess:['…ありがとう。'],
      checkoutFail:['違う。'],
      timeout:['また来ます。'],
      mistake:{
        missing:['まだ通ってないですよ。','それ、まだスキャンされていません。'],
        qty:['二つのはずです。','数量が違います。'],
        discount:['割引シールが違います。']
      }
    }
  },
  /* 5: R6 — young_mom_05, medium pressure */
  {
    id:'young_mom_05', name:'子連れのお母さん', emoji:'😣', type:'picky',
    drainRate:2.6, mistakePenalty:16, scoreMult:1.0, bodyColor:'#d06080',
    dialogue: {
      greeting:['こんにちは！今日の運勢はレジ運！','こんにちは。丁寧にお願いします。'],
      moodChange:{
        calm:['ピッ！いい音。'],
        impatient:['ピッピッが足りない。'],
        annoyed:['スキャンのリズムが崩れた。'],
        angry:['今日はレジ運がない。']
      },
      scanSuccess:['ピッ！いい音。','ありがとうございます。'],
      checkoutSuccess:['完璧！レジ神！'],
      checkoutFail:['えー、バグった？'],
      timeout:['今日は出ます。'],
      mistake:{
        missing:['それ、まだスキャンされていません。','商品が一つ抜けています。'],
        qty:['数量が違います。','もう一つあります。'],
        discount:['割引ついてますよね？']
      }
    }
  },
  /* 6: R7 — highschooler_03, first fast customer */
  {
    id:'highschooler_03', name:'高校生', emoji:'😅', type:'rushed',
    drainRate:3.5, mistakePenalty:10, scoreMult:1.1, bodyColor:'#e0a020',
    dialogue: {
      greeting:['こんにちは！今日は寒いですね。','こんにちは。今日は静かに買い物したいです。'],
      moodChange:{
        calm:['レジの音、いいですね。'],
        impatient:['おしゃべりしすぎたかな。'],
        annoyed:['あれ、話が途切れた。'],
        angry:['今日は話す気分じゃないです。']
      },
      scanSuccess:['レジの音、いいですね。','いいですね。'],
      checkoutSuccess:['楽しかったです、ありがとう。'],
      checkoutFail:['え、計算違い？'],
      timeout:['失礼します。'],
      mistake:{
        missing:['あ、これ入ってないです。','まだ通ってないですよ。'],
        qty:['一つ減らしてください。','二つのはずです。'],
        discount:['その割引、別のですよね。']
      }
    }
  },
  /* 7: R8 — taxi_driver_06, high pressure */
  {
    id:'taxi_driver_06', name:'タクシー運転手', emoji:'😠', type:'rushed',
    drainRate:4.0, mistakePenalty:9, scoreMult:1.2, bodyColor:'#20a040',
    dialogue: {
      greeting:['こんにちは…眠いです。','どうも。袋は少なめで。'],
      moodChange:{
        calm:['ぼーっとしてました。'],
        impatient:['眠気が限界です。'],
        annoyed:['頭が回りません。'],
        angry:['今日は帰ります…']
      },
      scanSuccess:['ぼーっとしてました。','問題ないです。'],
      checkoutSuccess:['助かりました…'],
      checkoutFail:['すみません、違う…？'],
      timeout:['失礼します。'],
      mistake:{
        missing:['商品が一つ抜けています。','あ、これ入ってないです。'],
        qty:['もう一つあります。','一つ減らしてください。'],
        discount:['その割引、別のですよね。']
      }
    }
  },
  /* 8: R9 — office_clerk_01, demanding */
  {
    id:'office_clerk_01', name:'会社員', emoji:'😤', type:'rushed',
    drainRate:3.8, mistakePenalty:8, scoreMult:1.2, bodyColor:'#3060d0',
    dialogue: {
      greeting:['こんにちは。きっちりお願いします。','こんにちは。急ぎでお願いします。'],
      moodChange:{
        calm:['数字は大事です。'],
        impatient:['正確さ重視で。'],
        annoyed:['計算は合ってますか？'],
        angry:['ミスは困ります。']
      },
      scanSuccess:['数字は大事です。','はい、それで合ってます。'],
      checkoutSuccess:['きれいな計算でした。'],
      checkoutFail:['合計が合いません。'],
      timeout:['また来ます。'],
      mistake:{
        missing:['それ、まだスキャンされていません。','商品が一つ抜けています。'],
        qty:['数量が違います。','もう一つあります。'],
        discount:['割引シールが違います。']
      }
    }
  },
  /* 9: R10 — night_vendor_21, BOSS */
  {
    id:'night_vendor_21', name:'夜勤帰り', emoji:'😫', type:'rushed',
    drainRate:5.0, mistakePenalty:10, scoreMult:1.1, bodyColor:'#800060',
    dialogue: {
      greeting:['こんにちは！今日の運勢はレジ運！','こんにちは。急ぎでお願いします。'],
      moodChange:{
        calm:['ピッ！いい音。'],
        impatient:['ピッピッが足りない。'],
        annoyed:['スキャンのリズムが崩れた。'],
        angry:['今日はレジ運がない。']
      },
      scanSuccess:['ピッ！いい音。','いいですね。'],
      checkoutSuccess:['完璧！レジ神！'],
      checkoutFail:['えー、バグった？'],
      timeout:['失礼します。'],
      mistake:{
        missing:['それ、まだスキャンされていません。','商品が一つ抜けています。'],
        qty:['数量が違います。','もう一つあります。'],
        discount:['その割引、別のですよね。']
      }
    }
  },
];

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

/* ---- Rounds: npcIndex references POS.NPCS ---- */
POS.ROUNDS = [
  /* R1  */ { npcIndex:0, items:[{id:'banana',qty:5},{id:'bread',qty:5}] },
  /* R2  */ { npcIndex:1, items:[{id:'milk',qty:1},{id:'apple',qty:2},{id:'onigiri',qty:1}] },
  /* R3  */ { npcIndex:2, items:[{id:'banana',qty:2},{id:'egg',qty:1},{id:'cola',qty:1}] },
  /* R4  */ { npcIndex:3, items:[{id:'ramen',qty:1},{id:'onigiri',qty:2},{id:'milk',qty:1},{id:'bread',qty:1}] },
  /* R5  */ { npcIndex:4, items:[{id:'apple',qty:1},{id:'meat',qty:1},{id:'cola',qty:1},{id:'banana',qty:1}] },
  /* R6  */ { npcIndex:5, items:[{id:'egg',qty:2},{id:'ramen',qty:1},{id:'bread',qty:1},{id:'juice',qty:1}] },
  /* R7  */ { npcIndex:6, items:[{id:'milk',qty:1},{id:'choco',qty:1},{id:'onigiri',qty:2},{id:'apple',qty:1}] },
  /* R8  */ { npcIndex:7, items:[{id:'meat',qty:1},{id:'juice',qty:1},{id:'ramen',qty:1},{id:'cola',qty:2}] },
  /* R9  */ { npcIndex:8, items:[{id:'egg',qty:1},{id:'bread',qty:1},{id:'choco',qty:1},{id:'banana',qty:2},{id:'milk',qty:1}] },
  /* R10 */ { npcIndex:9, items:[{id:'meat',qty:1},{id:'juice',qty:1},{id:'apple',qty:2},{id:'onigiri',qty:1},{id:'ramen',qty:1}] },
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
