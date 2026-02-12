/* src/js/loader.js — Dynamic data loader: CSV/JSON → random rounds */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});
var PARAMS = POS.PARAMS;

/* ---- Difficulty table (1-indexed rounds mapped to 0-indexed array) ---- */
var DIFFICULTY_TABLE = [
  /* R1  */ { npcType:'kind',   products:2, qtyMin:4, qtyMax:6, saleCount:0, discPair:null },
  /* R2  */ { npcType:'kind',   products:2, qtyMin:4, qtyMax:5, saleCount:0, discPair:null },
  /* R3  */ { npcType:'kind',   products:3, qtyMin:4, qtyMax:5, saleCount:0, discPair:null },
  /* R4  */ { npcType:'kind',   products:3, qtyMin:4, qtyMax:5, saleCount:1, discPair:[10,30] },
  /* R5  */ { npcType:'picky',  products:3, qtyMin:4, qtyMax:5, saleCount:1, discPair:[10,30] },
  /* R6  */ { npcType:'picky',  products:4, qtyMin:5, qtyMax:6, saleCount:1, discPair:[10,25] },
  /* R7  */ { npcType:'rushed', products:4, qtyMin:5, qtyMax:6, saleCount:1, discPair:[10,25] },
  /* R8  */ { npcType:'rushed', products:4, qtyMin:5, qtyMax:6, saleCount:2, discPair:[15,25] },
  /* R9  */ { npcType:'rushed', products:5, qtyMin:6, qtyMax:7, saleCount:1, discPair:[15,20] },
  /* R10 */ { npcType:'rushed', products:5, qtyMin:6, qtyMax:7, saleCount:2, discPair:[15,20] },
];

/* ---- Body color palettes per NPC type ---- */
var BODY_COLORS = {
  kind:   ['#d07090','#60a0d0','#808060','#4080c0','#60c090','#d0a070'],
  picky:  ['#806040','#d06080','#a08060','#6080a0','#c08040'],
  rushed: ['#e0a020','#20a040','#3060d0','#800060','#d04040'],
};

/* ---- Helpers ---- */

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---- Loader ---- */

POS.Loader = {
  catalog: [],
  npcPool: [],
  _npcByType: null,
  _productPool: [],
  _nextRoundIndex: 0,
  _lastBaseId: null,

  /* Main entry: fetch + parse + generate */
  load: function () {
    var self = this;
    return Promise.all([
      fetch('data/products.csv').then(function (r) { return r.text(); }),
      fetch('data/npcs.json').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      self.catalog = self._parseCSV(results[0]);
      self.npcPool = results[1].npcs.map(function (raw) { return self._adaptNpc(raw); });
      self._buildNpcIndex();
      self._resetRoundStream();
      self._appendRounds(PARAMS.roundSeedCount || 12);
      console.log('[loader] Loaded', self.catalog.length, 'products,', self.npcPool.length, 'NPCs,', POS.ROUNDS.length, 'rounds');
    });
  },

  /* Re-generate rounds (for retry) without re-fetching */
  regenerate: function () {
    this._resetRoundStream();
    this._appendRounds(PARAMS.roundSeedCount || 12);
    console.log('[loader] Regenerated', POS.ROUNDS.length, 'rounds');
  },

  /* Ensure at least targetCount rounds exist */
  ensureRounds: function (targetCount) {
    if (POS.ROUNDS.length >= targetCount) return;
    var need = targetCount - POS.ROUNDS.length;
    var chunk = Math.max(need, PARAMS.roundChunkSize || 6);
    this._appendRounds(chunk);
  },

  /* ---- CSV parser ---- */
  _parseCSV: function (text) {
    var lines = text.trim().split('\n');
    var result = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(',');
      if (cols.length < 6) continue;
      result.push({
        id:       cols[0].trim(),
        emoji:    cols[1].trim(),
        name:     cols[2].trim(),
        name_en:  cols[3].trim(),
        category: cols[4].trim(),
        price:    parseInt(cols[5].trim(), 10),
      });
    }
    return result;
  },

  /* ---- NPC format adapter ---- */
  _adaptNpc: function (raw) {
    var moodChange = {};
    if (raw.moodChange) {
      if (!raw.moodChange.calm) moodChange.calm = [];
      else moodChange.calm = raw.moodChange.calm;
      moodChange.impatient = raw.moodChange.impatient || [];
      moodChange.annoyed   = raw.moodChange.annoyed || [];
      moodChange.angry     = raw.moodChange.angry || [];
    } else {
      moodChange = { calm:[], impatient:[], annoyed:[], angry:[] };
    }

    return {
      id:             raw.id,
      base_id:        raw.base_id,
      name:           raw.name,
      emoji:          raw.emoji,
      type:           raw.type,
      drainRate:      raw.satisfactionDrainPerSec,
      mistakePenalty: raw.mistakePenalty,
      scoreMult:      raw.scoreMultiplier,
      bodyColor:      null, /* assigned during round generation */
      dialogue: {
        greeting:        raw.greeting || [],
        scanSuccess:     raw.scanSuccess || [],
        checkoutSuccess: raw.checkoutSuccess || [],
        checkoutFail:    raw.checkoutFail || [],
        timeout:         raw.timeout || [],
        mistake:         raw.mistake || { missing:[], qty:[], discount:[] },
        moodChange:      moodChange,
      },
    };
  },

  /* ---- Round generation (endless) ---- */
  _buildNpcIndex: function () {
    var npcByType = { kind:[], picky:[], rushed:[] };
    for (var n = 0; n < this.npcPool.length; n++) {
      var npc = this.npcPool[n];
      if (npcByType[npc.type]) npcByType[npc.type].push(npc);
    }
    this._npcByType = npcByType;
  },

  _resetRoundStream: function () {
    /* Clear existing runtime data */
    var key;
    for (key in POS.ITEMS) delete POS.ITEMS[key];
    POS.NPCS.length = 0;
    POS.ROUNDS.length = 0;

    this._productPool = shuffle(this.catalog.slice());
    this._nextRoundIndex = 0;
    this._lastBaseId = null;
  },

  _appendRounds: function (count) {
    for (var i = 0; i < count; i++) {
      var roundIndex = this._nextRoundIndex;
      var tier = this._getTierForRound(roundIndex);

      /* ---- Pick NPC ---- */
      var byType = this._npcByType[tier.npcType] || this._npcByType.kind;
      var candidates = byType.filter(function (c) { return c.base_id !== this._lastBaseId; }, this);
      if (!candidates.length) candidates = byType;
      var chosenNpc = pick(candidates);

      /* Clone NPC so each round has its own instance with unique bodyColor */
      var npcInstance = JSON.parse(JSON.stringify(chosenNpc));
      var palette = BODY_COLORS[tier.npcType] || BODY_COLORS.kind;
      npcInstance.bodyColor = pick(palette);
      this._lastBaseId = npcInstance.base_id;

      /* Difficulty boost every 3 rounds after round 10 */
      if (tier.drainRateMult) npcInstance.drainRate *= tier.drainRateMult;
      if (tier.mistakeMult) npcInstance.mistakePenalty *= tier.mistakeMult;

      /* ---- Pick products ---- */
      var picked = this._pickProducts(this._productPool, tier);

      /* ---- Build items and round entry ---- */
      var roundItems = [];
      for (var p = 0; p < picked.length; p++) {
        var prod = picked[p];
        var isSale = prod._isSale;
        var item = this._buildItem(prod.product, isSale, tier.discPair, roundIndex);
        POS.ITEMS[item.id] = item;
        roundItems.push({ id: item.id, qty: prod.qty });
      }

      POS.NPCS.push(npcInstance);
      POS.ROUNDS.push({ npc: npcInstance, items: roundItems, roundIndex: roundIndex });

      this._nextRoundIndex++;
    }
  },

  _getTierForRound: function (roundIndex) {
    /* Rounds 0-2: fixed intro tiers (always easy start) */
    if (roundIndex < 3) {
      var intro = DIFFICULTY_TABLE[roundIndex];
      return {
        npcType:   intro.npcType,
        products:  intro.products,
        qtyMin:    intro.qtyMin,
        qtyMax:    intro.qtyMax,
        saleCount: intro.saleCount,
        discPair:  intro.discPair,
      };
    }

    /* Round 3+: adaptive — tier driven by State.diffRating */
    var State = POS.State;
    var tierIdx = 3 + Math.floor(State.diffRating);

    if (tierIdx < DIFFICULTY_TABLE.length) {
      var base = DIFFICULTY_TABLE[tierIdx];
      return {
        npcType:   base.npcType,
        products:  base.products,
        qtyMin:    base.qtyMin,
        qtyMax:    base.qtyMax,
        saleCount: base.saleCount,
        discPair:  base.discPair,
      };
    }

    /* Beyond table: escalating difficulty */
    var overflow = tierIdx - DIFFICULTY_TABLE.length;
    var block = Math.max(1, Math.floor(overflow / 3) + 1);
    var tier = {
      npcType:   'rushed',
      products:  Math.min(8, 5 + Math.floor(block / 2)),
      qtyMin:    6 + Math.floor(block / 2),
      qtyMax:    7 + Math.floor((block + 1) / 2),
      saleCount: Math.min(3, 2 + Math.floor(block / 3)),
      discPair:  [15, 20],
      drainRateMult: 1 + block * 0.12,
      mistakeMult:   1 + block * 0.10,
    };
    return tier;
  },

  /* ---- Product selection for a round ---- */
  _pickProducts: function (pool, tier) {
    if (pool.length < tier.products + 2) {
      var refill = shuffle(this.catalog.slice());
      Array.prototype.push.apply(pool, refill);
    }
    var needed = tier.products;
    var saleCount = tier.saleCount;
    var totalQty = randInt(tier.qtyMin, tier.qtyMax);
    var result = [];
    var usedEmoji = {};

    /* Pick sale products first (prefer price >= 200) */
    if (saleCount > 0) {
      /* Sort candidates: price >= 200 first */
      var saleCandidates = [];
      var saleOther = [];
      for (var s = 0; s < pool.length; s++) {
        if (usedEmoji[pool[s].emoji]) continue;
        if (pool[s].price >= 200) saleCandidates.push(s);
        else saleOther.push(s);
      }

      for (var sc = 0; sc < saleCount; sc++) {
        var idx = -1;
        if (saleCandidates.length > 0) {
          var si = Math.floor(Math.random() * saleCandidates.length);
          idx = saleCandidates.splice(si, 1)[0];
        } else if (saleOther.length > 0) {
          var so = Math.floor(Math.random() * saleOther.length);
          idx = saleOther.splice(so, 1)[0];
        }
        if (idx >= 0) {
          var saleProd = pool.splice(idx, 1)[0];
          usedEmoji[saleProd.emoji] = true;
          result.push({ product: saleProd, _isSale: true, qty: 1 });
          /* Re-index remaining candidate arrays after splice */
          saleCandidates = [];
          saleOther = [];
          for (var rs = 0; rs < pool.length; rs++) {
            if (usedEmoji[pool[rs].emoji]) continue;
            if (pool[rs].price >= 200) saleCandidates.push(rs);
            else saleOther.push(rs);
          }
        }
      }
    }

    /* Pick normal products */
    var normalCount = needed - result.length;
    for (var nc = 0; nc < normalCount; nc++) {
      var found = false;
      for (var pi = 0; pi < pool.length; pi++) {
        if (!usedEmoji[pool[pi].emoji]) {
          var normalProd = pool.splice(pi, 1)[0];
          usedEmoji[normalProd.emoji] = true;
          result.push({ product: normalProd, _isSale: false, qty: 1 });
          found = true;
          break;
        }
      }
      if (!found && pool.length > 0) {
        /* Fallback: allow emoji overlap if necessary */
        var fb = pool.splice(0, 1)[0];
        result.push({ product: fb, _isSale: false, qty: 1 });
      }
    }

    /* Distribute remaining quantity */
    var assigned = result.length; /* each already has qty=1 */
    var remaining = totalQty - assigned;
    while (remaining > 0 && result.length > 0) {
      var ri = Math.floor(Math.random() * result.length);
      if (result[ri].qty < 3) {
        result[ri].qty++;
        remaining--;
      } else {
        /* All at max 3? force assign anyway */
        var allMax = true;
        for (var ch = 0; ch < result.length; ch++) {
          if (result[ch].qty < 3) { allMax = false; break; }
        }
        if (allMax) break;
      }
    }

    return result;
  },

  /* ---- Build a POS.ITEMS entry ---- */
  _buildItem: function (product, isSale, discPair, roundIndex) {
    var barcodes = [{ x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' }];

    if (isSale && discPair) {
      var low  = Math.min(discPair[0], discPair[1]);
      var high = Math.max(discPair[0], discPair[1]);
      barcodes.push({ x:0.00, y:0.18, w:0.44, h:0.24, type:'discount', discountRate:low,  label:low  + '%OFF' });
      barcodes.push({ x:0.56, y:0.18, w:0.44, h:0.24, type:'discount', discountRate:high, label:high + '%OFF' });
    }

    var suffix = '_r' + (roundIndex + 1) + (isSale ? 's' : 'n');
    var itemId = product.id + suffix;
    if (POS.ITEMS[itemId]) itemId = itemId + '_' + Math.floor(Math.random() * 1000);
    var item = {
      id:       itemId,
      baseId:   product.id,
      emoji:    product.emoji,
      name:     product.name_en,
      nameEn:   product.name,
      price:    product.price,
      barcodes: barcodes,
    };
    if (isSale) item.isSale = true;
    return item;
  },
};

})();
