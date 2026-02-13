/* src/js/loader.js — Dynamic data loader: CSV/JSON → random rounds */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});
var PARAMS = POS.PARAMS;

/* ---- Base difficulty table (products / qty / sale structure) ---- */
var DIFFICULTY_TABLE = [
  /* R1  */ { npcType:'kind',   products:2,  qtyMin:4,  qtyMax:6,  saleCount:0, discPair:null },
  /* R2  */ { npcType:'kind',   products:2,  qtyMin:4,  qtyMax:5,  saleCount:0, discPair:null },
  /* R3  */ { npcType:'kind',   products:3,  qtyMin:4,  qtyMax:5,  saleCount:0, discPair:null },
  /* R4  */ { npcType:'kind',   products:3,  qtyMin:4,  qtyMax:5,  saleCount:1, discPair:[10,30] },
  /* R5  */ { npcType:'picky',  products:10, qtyMin:12, qtyMax:15, saleCount:2, discPair:[10,30] },
  /* R6  */ { npcType:'picky',  products:10, qtyMin:14, qtyMax:18, saleCount:3, discPair:[10,25] },
  /* R7  */ { npcType:'rushed', products:10, qtyMin:14, qtyMax:18, saleCount:3, discPair:[10,25] },
  /* R8  */ { npcType:'rushed', products:12, qtyMin:16, qtyMax:20, saleCount:5, discPair:[15,25] },
  /* R9  */ { npcType:'rushed', products:12, qtyMin:16, qtyMax:20, saleCount:5, discPair:[15,20] },
  /* R10 */ { npcType:'rushed', products:15, qtyMin:20, qtyMax:26, saleCount:7, discPair:[15,20] },
  /* R11 */ { npcType:'rushed', products:15, qtyMin:22, qtyMax:28, saleCount:8, discPair:[10,20] },
  /* R12 */ { npcType:'rushed', products:15, qtyMin:22, qtyMax:28, saleCount:8, discPair:[10,20] },
  /* R13 */ { npcType:'rushed', products:18, qtyMin:24, qtyMax:30, saleCount:8, discPair:[10,20] },
  /* R14 */ { npcType:'rushed', products:18, qtyMin:26, qtyMax:30, saleCount:9, discPair:[10,15] },
  /* R15 */ { npcType:'rushed', products:20, qtyMin:28, qtyMax:35, saleCount:10, discPair:[10,15] },
];

/* ---- Available discount pairs pool for multiDiscount meta ---- */
var DISC_PAIRS_POOL = [[10,30],[15,25],[10,20],[15,20],[10,25],[20,30]];

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

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* ---- Dynamic meta computation based on diffRating ---- */

function computeMetas(dr, completed) {
  var done = completed || {};
  var metas = {};

  /* highQty: unlocks at dr >= 4 (no tutorial gating) */
  if (dr >= 4) {
    metas.highQty = { qtyMax: clamp(4 + Math.floor((dr - 4) * 0.5), 4, 8) };
  }

  /* damagedBarcode: unlocks at dr >= 5 AND tutorial completed */
  if (dr >= 5 && done.damagedBarcode) {
    metas.damagedBarcode = {
      chance: clamp(0.2 + (dr - 5) * 0.06, 0.2, 0.8),
      ratio:  clamp(0.4 + (dr - 5) * 0.03, 0.4, 0.7),
    };
  }

  /* promo: unlocks at dr >= 6 AND tutorial completed */
  if (dr >= 6 && done.promo) {
    metas.promo = {
      chance: clamp(0.35 + (dr - 6) * 0.05, 0.35, 0.8),
    };
  }

  /* midAdd: unlocks at dr >= 6 AND tutorial completed */
  if (dr >= 6 && done.midAdd) {
    metas.midAdd = {
      chance: clamp(0.3 + (dr - 6) * 0.05, 0.3, 0.8),
      count:  clamp(1 + Math.floor((dr - 6) * 0.5), 1, 5),
      delay:  [clamp(15 - Math.floor(dr * 0.5), 5, 15), clamp(22 - Math.floor(dr * 0.5), 10, 22)],
    };
  }

  /* mixedSale: unlocks at dr >= 7 (no tutorial gating) */
  if (dr >= 7) {
    metas.mixedSale = {
      chance: clamp(0.3 + (dr - 7) * 0.06, 0.3, 0.8),
      count:  clamp(1 + Math.floor((dr - 7) * 0.5), 1, 5),
    };
  }

  /* posBlackout: unlocks at dr >= 8 (no tutorial gating) */
  if (dr >= 8) {
    metas.posBlackout = {
      chance:   clamp(0.2 + (dr - 8) * 0.04, 0.2, 0.6),
      delay:    [clamp(14 - Math.floor(dr * 0.3), 6, 14), clamp(25 - Math.floor(dr * 0.5), 12, 25)],
      duration: [2, clamp(3 + Math.floor((dr - 8) * 0.5), 3, 8)],
    };
  }

  /* multiDiscount: unlocks at dr >= 9 (no tutorial gating) */
  if (dr >= 9) {
    var mdCount = clamp(1 + Math.floor((dr - 9) * 0.7), 1, 8);
    metas.multiDiscount = {
      chance:    clamp(0.4 + (dr - 9) * 0.05, 0.4, 0.9),
      count:     mdCount,
      discPairs: DISC_PAIRS_POOL.slice(0, clamp(mdCount + 1, 2, DISC_PAIRS_POOL.length)),
    };
  }

  /* midCancel: unlocks at dr >= 9 AND tutorial completed */
  if (dr >= 9 && done.midCancel) {
    metas.midCancel = {
      chance: clamp(0.25 + (dr - 9) * 0.05, 0.25, 0.7),
      count:  clamp(1 + Math.floor((dr - 9) * 0.3), 1, 3),
      delay:  [clamp(12 - Math.floor(dr * 0.3), 6, 12), clamp(18 - Math.floor(dr * 0.3), 10, 18)],
    };
  }

  return metas;
}

/* ---- Loader ---- */

POS.Loader = {
  catalog: [],
  npcPool: [],
  promos: [],
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
      fetch('data/encouragements.json').then(function (r) { return r.json(); }).catch(function () { return { encouragements: [] }; }),
      fetch('data/promos.json').then(function (r) { return r.json(); }).catch(function () { return { promos: [] }; }),
    ]).then(function (results) {
      self.catalog = self._parseCSV(results[0]);
      self.npcPool = results[1].npcs.map(function (raw) { return self._adaptNpc(raw); });
      POS.ENCOURAGEMENTS = results[2].encouragements || [];
      self.promos = results[3].promos || [];
      POS.PROMOS = self.promos;
      self._buildNpcIndex();
      self._resetRoundStream();
      self._appendRounds(PARAMS.roundSeedCount || 12);
      console.log('[loader] Loaded', self.catalog.length, 'products,', self.npcPool.length, 'NPCs,', POS.ENCOURAGEMENTS.length, 'encouragements,', self.promos.length, 'promos,', POS.ROUNDS.length, 'rounds');
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
      bodyColor:      null,
      dialogue: {
        greeting:        raw.greeting || [],
        scanSuccess:     raw.scanSuccess || [],
        bagSuccess:      raw.bagSuccess || [],
        checkoutSuccess: raw.checkoutSuccess || [],
        checkoutFail:    raw.checkoutFail || [],
        timeout:         raw.timeout || [],
        mistake:         raw.mistake || { missing:[], qty:[], discount:[] },
        moodChange:      moodChange,
        addRequest:      raw.addRequest || [],
        cancelRequest:   raw.cancelRequest || [],
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
    var key;
    for (key in POS.ITEMS) delete POS.ITEMS[key];
    POS.NPCS.length = 0;
    POS.ROUNDS.length = 0;

    this._productPool = shuffle(this.catalog.slice());
    this._nextRoundIndex = 0;
    this._lastBaseId = null;
  },

  /* Build a single round from an explicit tier config (used by tutorial system) */
  buildSingleRound: function (tier) {
    /* Pick NPC */
    var byType = this._npcByType[tier.npcType] || this._npcByType.kind;
    var candidates = byType.filter(function (c) { return c.base_id !== this._lastBaseId; }, this);
    if (!candidates.length) candidates = byType;
    var chosenNpc = pick(candidates);

    var npcInstance = JSON.parse(JSON.stringify(chosenNpc));
    var palette = BODY_COLORS[tier.npcType] || BODY_COLORS.kind;
    npcInstance.bodyColor = pick(palette);
    this._lastBaseId = npcInstance.base_id;

    /* Pick products */
    var picked = this._pickProducts(this._productPool, tier);

    /* Build items */
    var metas = tier.metas || {};
    var roundIndex = this._nextRoundIndex;
    var roundItems = [];
    for (var p = 0; p < picked.length; p++) {
      var prod = picked[p];
      var isSale = prod._isSale;
      var dp = prod._discPairOverride || tier.discPair;
      var item = this._buildItem(prod.product, isSale, dp, roundIndex, prod._isPromo, prod._promoType);
      POS.ITEMS[item.id] = item;
      var ri = { id: item.id, qty: prod.qty };
      if (prod._isPromo) {
        ri.promoBuyQty = prod._promoBuyQty || 1;
        ri.promoFreeQty = prod._promoFreeQty || 0;
        ri.promoType = prod._promoType;
      }
      roundItems.push(ri);
    }

    /* Apply damagedBarcode meta */
    var dmgMeta = metas.damagedBarcode;
    if (dmgMeta) {
      for (var d = 0; d < roundItems.length; d++) {
        var entry = roundItems[d];
        if (entry.qty > 1 && Math.random() < dmgMeta.chance) {
          var dmgCount = Math.floor(entry.qty * (dmgMeta.ratio || 0.5));
          dmgCount = Math.max(0, Math.min(dmgCount, entry.qty - 1));
          var dmgArr = [];
          for (var dd = 0; dd < entry.qty; dd++) {
            dmgArr.push(dd < dmgCount);
          }
          shuffle(dmgArr);
          entry.damagedCopies = dmgArr;
        }
      }
    }

    POS.NPCS.push(npcInstance);
    this._nextRoundIndex++;

    return { npc: npcInstance, items: roundItems, roundIndex: roundIndex, metas: metas };
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

      var npcInstance = JSON.parse(JSON.stringify(chosenNpc));
      var palette = BODY_COLORS[tier.npcType] || BODY_COLORS.kind;
      npcInstance.bodyColor = pick(palette);
      this._lastBaseId = npcInstance.base_id;

      if (tier.drainRateMult) npcInstance.drainRate *= tier.drainRateMult;
      if (tier.mistakeMult) npcInstance.mistakePenalty *= tier.mistakeMult;

      /* ---- Pick products ---- */
      var picked = this._pickProducts(this._productPool, tier);

      /* ---- Build items and round entry ---- */
      var metas = tier.metas || {};
      var roundItems = [];
      for (var p = 0; p < picked.length; p++) {
        var prod = picked[p];
        var isSale = prod._isSale;
        var dp = prod._discPairOverride || tier.discPair;
        var item = this._buildItem(prod.product, isSale, dp, roundIndex, prod._isPromo, prod._promoType);
        POS.ITEMS[item.id] = item;
        var ri = { id: item.id, qty: prod.qty };
        if (prod._isPromo) {
          ri.promoBuyQty = prod._promoBuyQty || 1;
          ri.promoFreeQty = prod._promoFreeQty || 0;
          ri.promoType = prod._promoType;
        }
        roundItems.push(ri);
      }

      /* ---- Apply damagedBarcode meta ---- */
      var dmgMeta = metas.damagedBarcode;
      if (dmgMeta) {
        for (var d = 0; d < roundItems.length; d++) {
          var entry = roundItems[d];
          if (entry.qty > 1 && Math.random() < dmgMeta.chance) {
            var dmgCount = Math.floor(entry.qty * (dmgMeta.ratio || 0.5));
            dmgCount = Math.max(0, Math.min(dmgCount, entry.qty - 1));
            var dmgArr = [];
            for (var dd = 0; dd < entry.qty; dd++) {
              dmgArr.push(dd < dmgCount);
            }
            shuffle(dmgArr);
            entry.damagedCopies = dmgArr;
          }
        }
      }

      POS.NPCS.push(npcInstance);
      POS.ROUNDS.push({ npc: npcInstance, items: roundItems, roundIndex: roundIndex, metas: metas });

      this._nextRoundIndex++;
    }
  },

  _getTierForRound: function (roundIndex) {
    /* Round 0 only: fixed intro tier (tutorial round) */
    if (roundIndex < 1) {
      var intro = DIFFICULTY_TABLE[0];
      return {
        npcType:  intro.npcType,
        products: intro.products,
        qtyMin:   intro.qtyMin,
        qtyMax:   intro.qtyMax,
        saleCount:intro.saleCount,
        discPair: intro.discPair,
        metas:    {},
      };
    }

    /* Round 1+: adaptive — tier driven by State.diffRating */
    var State = POS.State;
    var dr = State.diffRating;
    var tierIdx = 1 + Math.floor(dr);
    var tier;

    if (tierIdx < DIFFICULTY_TABLE.length) {
      var base = DIFFICULTY_TABLE[tierIdx];
      tier = {
        npcType:  base.npcType,
        products: base.products,
        qtyMin:   base.qtyMin,
        qtyMax:   base.qtyMax,
        saleCount:base.saleCount,
        discPair: base.discPair,
      };
    } else {
      /* Beyond table: escalating difficulty */
      var overflow = tierIdx - DIFFICULTY_TABLE.length;
      var block = Math.max(1, Math.floor(overflow / 3) + 1);
      tier = {
        npcType:   'rushed',
        products:  Math.min(30, 20 + Math.floor(block / 2)),
        qtyMin:    28 + Math.floor(block / 2),
        qtyMax:    35 + Math.floor((block + 1) / 2),
        saleCount: Math.min(15, 10 + Math.floor(block / 2)),
        discPair:  [10, 15],
        drainRateMult: 1 + block * 0.12,
        mistakeMult:   1 + block * 0.10,
      };
    }

    /* Sale gating: block sale items until sale tutorial completed */
    if (!State.tutorialCompleted.sale) {
      tier.saleCount = 0;
      tier.discPair = null;
    }

    /* Compute metas dynamically from diffRating (with tutorial gating) */
    tier.metas = computeMetas(dr, State.tutorialCompleted);
    return tier;
  },

  /* ---- Product selection for a round (meta-aware) ---- */
  _pickProducts: function (pool, tier) {
    var metas = tier.metas || {};
    var qtyMaxPerProduct = (metas.highQty && metas.highQty.qtyMax) || 3;

    var safeNeeded = tier.products + 10;
    if (pool.length < safeNeeded) {
      var refill = shuffle(this.catalog.slice());
      Array.prototype.push.apply(pool, refill);
    }

    var needed = tier.products;
    var saleCount = tier.saleCount;
    var totalQty = randInt(tier.qtyMin, tier.qtyMax);
    var result = [];
    var usedEmoji = {};

    /* ---- Step 1: Multi-discount (same product, different discount rates) ---- */
    var mdMeta = metas.multiDiscount;
    if (mdMeta && Math.random() < mdMeta.chance) {
      var mdCount = Math.min(mdMeta.count || 0, Math.floor(saleCount / 2));
      var mdPairs = mdMeta.discPairs || [];
      for (var mi = 0; mi < mdCount && mdPairs.length >= 2; mi++) {
        var mdProd = this._pickOneProduct(pool, usedEmoji, true);
        if (!mdProd) break;
        var pairA = mdPairs[mi * 2 % mdPairs.length];
        var pairB = mdPairs[(mi * 2 + 1) % mdPairs.length];
        if (pairA[0] === pairB[0] && pairA[1] === pairB[1] && mdPairs.length > 2) {
          pairB = mdPairs[(mi * 2 + 2) % mdPairs.length];
        }
        result.push({ product: mdProd, _isSale: true, qty: 1, _discPairOverride: pairA });
        result.push({ product: mdProd, _isSale: true, qty: 1, _discPairOverride: pairB });
        saleCount -= 2;
        needed -= 1;
      }
    }

    /* ---- Step 2: Mixed sale (same product as both sale and non-sale) ---- */
    var msMeta = metas.mixedSale;
    if (msMeta && Math.random() < msMeta.chance) {
      var msCount = Math.min(msMeta.count || 0, saleCount, Math.floor(needed / 2));
      for (var ms = 0; ms < msCount; ms++) {
        var msProd = this._pickOneProduct(pool, usedEmoji, true);
        if (!msProd) break;
        var msPair = DISC_PAIRS_POOL[Math.floor(Math.random() * DISC_PAIRS_POOL.length)];
        result.push({ product: msProd, _isSale: true,  qty: 1, _discPairOverride: msPair });
        result.push({ product: msProd, _isSale: false, qty: 1 });
        saleCount -= 1;
        needed -= 1;
      }
    }

    /* ---- Step 3: Remaining sale products (each gets a random discount pair) ---- */
    /* Build available discount pairs: tier.discPair as base + pool variety */
    var availPairs = [];
    if (tier.discPair) availPairs.push(tier.discPair);
    for (var ap = 0; ap < DISC_PAIRS_POOL.length; ap++) {
      var pp = DISC_PAIRS_POOL[ap];
      var dup = false;
      for (var ck = 0; ck < availPairs.length; ck++) {
        if (availPairs[ck][0] === pp[0] && availPairs[ck][1] === pp[1]) { dup = true; break; }
      }
      if (!dup) availPairs.push(pp);
    }

    if (saleCount > 0) {
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
          /* Assign a random discount pair from the available pool */
          var pickedPair = availPairs[Math.floor(Math.random() * availPairs.length)];
          result.push({ product: saleProd, _isSale: true, qty: 1, _discPairOverride: pickedPair });
          needed--;
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

    /* ---- Step 4: Remaining normal products ---- */
    var normalCount = Math.max(0, needed);
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
        var fb = pool.splice(0, 1)[0];
        result.push({ product: fb, _isSale: false, qty: 1 });
      }
    }

    /* ---- Step 4.5: Promo products (max 1 per round, after normal picks) ---- */
    var promoMeta = metas.promo;
    var promoApplied = false;
    if (promoMeta && Math.random() < promoMeta.chance) {
      var forced = promoMeta.chance >= 1;
      var promoList = (POS.Loader.promos && POS.Loader.promos.length) ? POS.Loader.promos : [];
      var eligible;
      if (forced) {
        /* Forced promo (tutorials): bypass DR gate, use all promos */
        eligible = promoList.length
          ? promoList.slice()
          : [{ id:'bogo', label:'1+1', buyQty:1, freeQty:1 }];
      } else {
        var dr = (POS.State && POS.State.diffRating) || 0;
        eligible = promoList.filter(function (p) { return dr >= p.unlockDR; });
      }
      if (eligible.length > 0) {
        var chosenPromo = eligible[Math.floor(Math.random() * eligible.length)];
        /* Pick a normal (non-sale) item from result to promote */
        var promoTargets = [];
        for (var pt = 0; pt < result.length; pt++) {
          if (!result[pt]._isSale) promoTargets.push(pt);
        }
        if (promoTargets.length > 0) {
          var promoIdx = promoTargets[Math.floor(Math.random() * promoTargets.length)];
          result[promoIdx]._isPromo = true;
          result[promoIdx]._promoType = chosenPromo.label;
          result[promoIdx]._promoBuyQty = chosenPromo.buyQty;
          result[promoIdx]._promoFreeQty = chosenPromo.freeQty;
          /* Ensure at least buyQty before adding free copies */
          result[promoIdx].qty = Math.max(result[promoIdx].qty, chosenPromo.buyQty);
          result[promoIdx].qty += chosenPromo.freeQty;
          promoApplied = true;
        }
      }
    }

    /* ---- Step 5: Distribute remaining quantity ---- */
    var assigned = 0;
    for (var ai = 0; ai < result.length; ai++) assigned += result[ai].qty;
    var remaining = totalQty - assigned;
    while (remaining > 0 && result.length > 0) {
      var ri = Math.floor(Math.random() * result.length);
      if (result[ri].qty < qtyMaxPerProduct) {
        result[ri].qty++;
        remaining--;
      } else {
        var allMax = true;
        for (var ch = 0; ch < result.length; ch++) {
          if (result[ch].qty < qtyMaxPerProduct) { allMax = false; break; }
        }
        if (allMax) break;
      }
    }

    return result;
  },

  _pickOneProduct: function (pool, usedEmoji, preferExpensive) {
    if (preferExpensive) {
      for (var i = 0; i < pool.length; i++) {
        if (!usedEmoji[pool[i].emoji] && pool[i].price >= 200) {
          var prod = pool.splice(i, 1)[0];
          usedEmoji[prod.emoji] = true;
          return prod;
        }
      }
    }
    for (var j = 0; j < pool.length; j++) {
      if (!usedEmoji[pool[j].emoji]) {
        var prod2 = pool.splice(j, 1)[0];
        usedEmoji[prod2.emoji] = true;
        return prod2;
      }
    }
    if (pool.length > 0) return pool.splice(0, 1)[0];
    return null;
  },

  /* Pick additional items for mid-round add event */
  pickAdditionalItems: function (count, round, roundIndex) {
    var pool = this._productPool;
    if (pool.length < count + 2) {
      var refill = shuffle(this.catalog.slice());
      Array.prototype.push.apply(pool, refill);
    }
    var usedEmoji = {};
    for (var i = 0; i < round.items.length; i++) {
      var existing = POS.ITEMS[round.items[i].id];
      if (existing) usedEmoji[existing.emoji] = true;
    }

    var newItems = [];
    for (var c = 0; c < count; c++) {
      var prod = this._pickOneProduct(pool, usedEmoji, false);
      if (!prod) break;
      var item = this._buildItem(prod, false, null, roundIndex);
      newItems.push({ item: item, qty: 1 });
    }
    return newItems;
  },

  /* ---- Build a POS.ITEMS entry ---- */
  _buildItem: function (product, isSale, discPair, roundIndex, isPromo, promoType) {
    var barcodes = [{ x:0.20, y:0.76, w:0.60, h:0.18, type:'normal' }];

    if (isSale && discPair) {
      var low  = Math.min(discPair[0], discPair[1]);
      var high = Math.max(discPair[0], discPair[1]);
      barcodes.push({ x:0.00, y:0.18, w:0.44, h:0.24, type:'discount', discountRate:low,  label:low  + '%OFF' });
      barcodes.push({ x:0.56, y:0.18, w:0.44, h:0.24, type:'discount', discountRate:high, label:high + '%OFF' });
    }

    var suffix = '_r' + (roundIndex + 1) + (isSale ? 's' + (discPair ? discPair[0] : '') : (isPromo ? 'p' : 'n'));
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
    if (isPromo) {
      item.isPromo = true;
      item.promoType = promoType || '1+1';
    }
    return item;
  },
};

})();
