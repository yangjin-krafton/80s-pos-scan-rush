/* src/js/ui.js — DOM rendering */
(function () {
'use strict';
var POS    = window.POS;
var ITEMS  = POS.ITEMS;
var NPCS   = POS.NPCS;
var ROUNDS = POS.ROUNDS;
var PARAMS = POS.PARAMS;
var State  = POS.State;
var Bus    = POS.Bus;

/* reason key mapping: game.js reason → NPC dialogue.mistake key */
var MISTAKE_KEY_MAP = { missing:'missing', excess:'missing', quantity:'qty', discount:'discount' };

function UI() {
  this.els = {};
  this._feedbackTimer = 0;
  this._checkoutFx = null;
  this._seasonFx = null;
  this._seasonFxMode = 'none';
  this._seasonEmitters = null;
  this._moodFxTimer = 0;
  this._checkoutFailTimer = 0;
}

/* ---- init ---- */
UI.prototype.init = function () {
  this._cache();
  this._initCheckoutFx();
  this._initSeasonFx();
  this._bindButtons();
  this._listenBus();
};

UI.prototype._cache = function () {
  var q = function (s) { return document.querySelector(s); };
  this.els = {
    game:         q('.game'),
    infoRound:    q('#info-round'),
    infoScore:    q('#info-score'),
    hudName:      q('.hud-name'),
    hudRight:     q('.hud-right'),
    customerScene: q('.customer-scene'),
    pxBubble:     q('.px-bubble'),
    pxCurrent:    q('.px-current'),
    pxHead:       q('.px-head'),
    pxBody:       q('.px-body'),
    pxFeedback:   q('.px-feedback'),
    pxQueue:      q('.px-queue'),
    posScroll:    q('.pos-scroll'),
    posFoot:      q('.pos-foot .tv'),
    checkoutBtn:  q('.pos-foot .checkout'),
    scanContent:  q('.scan-content'),
    scanProg:     q('.scan-prog-fill'),
    scanMsg:      q('.scan-msg'),
    dcVal:        q('#dc-val'),
    cartDesktop:  q('.cart-desktop'),
    overlay:      q('#overlay'),
    overlayInner: q('#overlay-inner'),
  };
};

UI.prototype._bindButtons = function () {
  var self = this;
  var chkBtn = document.querySelector('.pos-foot .checkout');
  if (chkBtn) chkBtn.addEventListener('click', function () { Bus.emit('checkoutClick'); });

  var dcUp   = document.querySelector('#dc-up');
  var dcDown = document.querySelector('#dc-down');
  if (dcUp)   dcUp.addEventListener('click', function () { self._changeDiscount(5); });
  if (dcDown) dcDown.addEventListener('click', function () { self._changeDiscount(-5); });
};

UI.prototype._listenBus = function () {
  var self = this;
  Bus.on('roundStart',      function ()  { self._onRoundStart(); });
  Bus.on('roundReady',      function ()  { /* overlay already hidden by customerSummon */ });
  Bus.on('itemSelected',    function (id){ self._renderScanItem(id); });
  Bus.on('itemBagged',      function ()  { self._clearScanItem(); });
  Bus.on('scanComplete',    function (d) { self._onScanComplete(d); });
  Bus.on('posUpdated',      function ()  { self._renderPOS(); });
  Bus.on('holdProgress',    function (p) { self._updateProgress(p); });
  Bus.on('checkoutMistake', function (d) { self._onCheckoutMistake(d); });
  Bus.on('checkoutMistake', function ()  { self._playCheckoutFx('fail'); });
  Bus.on('checkoutMistake', function ()  { self._flashCheckoutFail(); });
  Bus.on('checkoutSuccess', function ()  { self._playCheckoutFx('success'); self._spawnEmojiParty(); });
  Bus.on('roundClear',      function ()  { /* no full-screen clear overlay */ });
  Bus.on('gameOver',        function ()  { self._showGameOver(); });
  Bus.on('gameClear',       function ()  { self._showOverlay('ALL CLEAR!', 'TOTAL: ' + State.score.toLocaleString(), 'clear'); });
  Bus.on('scanFail',        function ()  { self._onScanFail(); });

  /* ---- New customer state machine handlers ---- */
  Bus.on('customerSummon',  function ()  { self._onCustomerSummon(); });
  Bus.on('customerArrive',  function ()  { self._onCustomerArrive(); });
  Bus.on('customerFeedback',function (t) { self._onCustomerFeedback(t); });
  Bus.on('customerLeave',   function (t) { self._onCustomerLeave(t); });
  Bus.on('moodChange',      function (m) { self._onMoodChange(m); });
  Bus.on('moodHint',        function (m) { self._onMoodHint(m); });

  /* ---- Meta event handlers ---- */
  Bus.on('posBlackout',     function (on) { self._onPosBlackout(on); });
  Bus.on('midAdd',          function (items) { self._onMidAdd(items); });
  Bus.on('midCancel',       function (items) { self._onMidCancel(items); });
};

/* ---- per-frame ---- */
UI.prototype.update = function (dt) {
  this._updateInfoBar();
  this._updateCustomer();
  this._updateScanMsg();
  this._updateCartTimer();
  if (this._checkoutFx) this._checkoutFx.update(dt);
  if (this._seasonFx) this._seasonFx.update(dt);
  this._updateEmojiParticles(dt);
  if (this._moodFxTimer > 0) {
    this._moodFxTimer -= dt;
    if (this._moodFxTimer <= 0 && this.els.pxFeedback) {
      this.els.pxFeedback.classList.remove('active');
      this.els.pxFeedback.innerHTML = '';
    }
  }
  if (this._checkoutFailTimer > 0) {
    this._checkoutFailTimer -= dt;
    if (this._checkoutFailTimer <= 0 && this.els.checkoutBtn) {
      this.els.checkoutBtn.classList.remove('is-fail');
    }
  }
  if (this._feedbackTimer > 0) {
    this._feedbackTimer -= dt;
    if (this._feedbackTimer <= 0) this._hideFeedback();
  }
};

/* ---- checkout FX ---- */

UI.prototype._initCheckoutFx = function () {
  if (!this.els.game) return;
  if (!window.POS || !POS.CheckoutFX) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'checkout-fx';
  this.els.game.appendChild(canvas);
  this._checkoutFx = new POS.CheckoutFX(canvas);
  this._resizeCheckoutFx();
  window.addEventListener('resize', this._resizeCheckoutFx.bind(this));
};

UI.prototype._resizeCheckoutFx = function () {
  if (!this._checkoutFx || !this.els.game) return;
  var w = this.els.game.clientWidth || 360;
  var h = this.els.game.clientHeight || 640;
  this._checkoutFx.resize(w, h);
};

UI.prototype._playCheckoutFx = function (type) {
  if (!this._checkoutFx || !this.els.checkoutBtn || !this.els.game) return;
  var btnRect = this.els.checkoutBtn.getBoundingClientRect();
  var gameRect = this.els.game.getBoundingClientRect();
  var cx = btnRect.left + btnRect.width / 2;
  var cy = btnRect.top + btnRect.height / 2;
  var x = (cx - gameRect.left) * (this._checkoutFx.canvas.width / gameRect.width);
  var y = (cy - gameRect.top) * (this._checkoutFx.canvas.height / gameRect.height);
  this._checkoutFx.spawn(x, y, type);
};

/* ---- seasonal FX (weather / items) ---- */

UI.prototype._initSeasonFx = function () {
  if (!this.els.customerScene) return;
  if (!window.POS || !POS.ParticleSystem) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'season-fx';
  this.els.customerScene.appendChild(canvas);
  this._seasonFx = new POS.ParticleSystem(canvas, { maxParticles: 2600 });
  this._seasonEmitters = {
    rain: this._seasonFx.addEmitter('rain', { enabled: false }),
    snow: this._seasonFx.addEmitter('snow', { enabled: false }),
    blossom: this._seasonFx.addEmitter('blossom', { enabled: false }),
    maple: this._seasonFx.addEmitter('maple', { enabled: false }),
  };
  this._resizeSeasonFx();
  window.addEventListener('resize', this._resizeSeasonFx.bind(this));
};

UI.prototype._resizeSeasonFx = function () {
  if (!this._seasonFx || !this.els.customerScene) return;
  var w = this.els.customerScene.clientWidth || 360;
  var h = this.els.customerScene.clientHeight || 88;
  this._seasonFx.resize(w, h);
  if (!this._seasonEmitters) return;
  var keys = Object.keys(this._seasonEmitters);
  for (var i = 0; i < keys.length; i++) {
    var e = this._seasonEmitters[keys[i]];
    if (e && e.area) {
      e.area.x = 0;
      e.area.y = -90;
      e.area.w = w;
      e.area.h = 90;
    }
  }
};

UI.prototype._setSeasonFx = function (mode) {
  this._seasonFxMode = mode || 'none';
  if (!this._seasonFx || !this._seasonEmitters) return;
  var keys = Object.keys(this._seasonEmitters);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var e = this._seasonEmitters[key];
    if (e) e.enabled = (key === this._seasonFxMode);
  }
  if (this._seasonFxMode === 'none') this._seasonFx.clear();
};

UI.prototype._randomizeSeasonFx = function () {
  var pool = ['none', 'rain', 'snow', 'blossom', 'maple'];
  var pick = pool[Math.floor(Math.random() * pool.length)];
  this._setSeasonFx(pick);
};

/* ---- emoji party (checkout success) — JS physics ---- */

UI.prototype._spawnEmojiParty = function () {
  var game = this.els.game;
  if (!game) return;
  if (!this._emojiParts) this._emojiParts = [];
  var pool = ['\uD83C\uDF89','\uD83C\uDF8A','\uD83E\uDD73','\uD83C\uDF88','\uD83C\uDF86','\u2728','\uD83C\uDF1F','\uD83D\uDCAB','\uD83C\uDFB6','\uD83D\uDC96','\uD83E\uDE99','\uD83C\uDF80'];
  var count = 28;
  for (var i = 0; i < count; i++) {
    var el = document.createElement('span');
    el.className = 'emoji-pop';
    el.textContent = pool[Math.floor(Math.random() * pool.length)];
    el.style.fontSize = (16 + Math.random() * 12) + 'px';
    game.appendChild(el);
    var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    var speed = 420 + Math.random() * 320;
    this._emojiParts.push({
      el: el,
      x: 60 + Math.random() * 240,
      y: 640,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: 0,
      vr: (Math.random() - 0.5) * 500,
      sc: 0.8 + Math.random() * 0.4,
      life: 2.2 + Math.random() * 1.0,
      ttl: 0,
    });
    this._emojiParts[this._emojiParts.length - 1].ttl =
      this._emojiParts[this._emojiParts.length - 1].life;
  }
};

UI.prototype._updateEmojiParticles = function (dt) {
  var parts = this._emojiParts;
  if (!parts || !parts.length) return;
  var GRAVITY = 850;
  var FADE = 0.45;
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.life -= dt;
    if (p.life <= 0 || p.y > 700) {
      p.el.remove();
      parts.splice(i, 1);
      continue;
    }
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    var t = p.life / p.ttl;
    var a = p.life < FADE ? p.life / FADE : 1;
    var s = p.sc * (0.35 + t * 0.65);
    p.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) rotate(' + p.rot.toFixed(0) + 'deg) scale(' + s.toFixed(2) + ')';
    p.el.style.opacity = a.toFixed(2);
  }
};

/* ---- info bar ---- */
UI.prototype._updateInfoBar = function () {
  var rd = this.els.infoRound;
  var sc = this.els.infoScore;
  if (rd) {
    var total = PARAMS.endlessRounds ? '∞' : pad2(ROUNDS.length);
    rd.textContent = pad2(State.round + 1) + '/' + total;
  }
  if (sc) sc.textContent = String(State.score).padStart(6, '0');
};

/* ---- customer ---- */
UI.prototype._updateCustomer = function () {
  if (State.phase === 'title') return;
  var npc = State.currentNpc;
  if (!npc) return;
  var sat = State.satisfaction;

  // expression — use NPC emoji for calm, generic for other moods
  if (this.els.pxHead) {
    if (sat > 70) this.els.pxHead.textContent = npc.emoji;
    else if (sat > 40) this.els.pxHead.textContent = '😐';
    else if (sat > 15) this.els.pxHead.textContent = '😠';
    else this.els.pxHead.textContent = '🤬';
  }
  // HUD name & round
  if (this.els.hudName)  this.els.hudName.textContent = npc.name + ' #' + pad2(State.round + 1);
  if (this.els.hudRight) {
    var total = PARAMS.endlessRounds ? '∞' : ROUNDS.length;
    this.els.hudRight.textContent = 'ROUND ' + pad2(State.round + 1) + '/' + total;
  }
};

/* ---- cart cooldown timer (RPG skill-cooldown style overlay) ---- */

UI.prototype._updateCartTimer = function () {
  var desktop = this.els.cartDesktop;
  if (!desktop) return;

  if (State.phase !== 'playing') {
    desktop.classList.remove('cd-warn', 'cd-danger');
    desktop.style.setProperty('--sat-deg', '0');
    return;
  }

  var npc = State.currentNpc;
  if (!npc || npc.drainRate <= 0) return;

  var sat = State.satisfaction;
  var pct = sat / PARAMS.maxSatisfaction;
  var secsLeft = sat / npc.drainRate;

  /* Dark wedge angle: 0 at 100% sat → 360 at 0% sat (clockwise from 12 o'clock) */
  var deg = ((1 - pct) * 360).toFixed(1);
  desktop.style.setProperty('--sat-deg', deg);

  /* Warning states */
  if (secsLeft <= 3) {
    desktop.classList.remove('cd-warn');
    desktop.classList.add('cd-danger');
  } else if (secsLeft <= 10) {
    desktop.classList.remove('cd-danger');
    desktop.classList.add('cd-warn');
  } else {
    desktop.classList.remove('cd-warn', 'cd-danger');
  }
};

/* ---- customer state machine UI handlers ---- */

UI.prototype._resetCustomerClasses = function () {
  var px = this.els.pxCurrent;
  if (px) {
    px.classList.remove('is-moving', 'is-happy', 'is-angry', 'leave-left', 'leave-right');
    px.classList.add('offscreen-right');
  }
  if (this.els.game) this.els.game.classList.remove('danger');
  var fb = this.els.pxFeedback;
  if (fb) {
    fb.classList.remove('active');
    fb.innerHTML = '';
  }
};

UI.prototype._onCustomerSummon = function () {
  this._hideOverlay();
  var px = this.els.pxCurrent;
  if (px) {
    px.classList.remove('offscreen-right');
    px.classList.add('is-moving');
  }
  // First queue character departs
  var firstQ = this.els.pxQueue ? this.els.pxQueue.querySelector('.px-qchar') : null;
  if (firstQ) firstQ.classList.add('departing');
};

UI.prototype._onCustomerArrive = function () {
  var px = this.els.pxCurrent;
  if (px) px.classList.remove('is-moving');
  // Remove departing queue character
  var dept = this.els.pxQueue ? this.els.pxQueue.querySelector('.px-qchar.departing') : null;
  if (dept) dept.remove();
  // Show NPC greeting
  var npc = State.currentNpc;
  if (npc && this.els.pxBubble) {
    this.els.pxBubble.textContent = POS.pickDialogue(npc.dialogue.greeting);
  }
};

UI.prototype._onCustomerFeedback = function (type) {
  var px = this.els.pxCurrent;
  var fb = this.els.pxFeedback;
  var npc = State.currentNpc;

  if (type === 'happy') {
    if (px) px.classList.add('is-happy');
    if (fb) {
      fb.innerHTML =
        '<span class="fb-heart">♥</span>' +
        '<span class="fb-heart" style="left:8px;animation-delay:0.15s">♥</span>' +
        '<span class="fb-heart" style="left:16px;animation-delay:0.3s">♥</span>';
      fb.classList.add('active');
    }
    if (npc && this.els.pxBubble) {
      this.els.pxBubble.textContent = POS.pickDialogue(npc.dialogue.checkoutSuccess);
      this.els.pxBubble.classList.remove('feedback-error');
    }
    if (this.els.pxHead) this.els.pxHead.textContent = '😄';
  } else {
    if (px) px.classList.add('is-angry');
    if (fb) {
      fb.innerHTML = '<span class="fb-angry">!!</span>';
      fb.classList.add('active');
    }
    if (npc && this.els.pxBubble) {
      var msg = POS.pickDialogue(npc.dialogue.checkoutFail) || POS.pickDialogue(npc.dialogue.timeout);
      this.els.pxBubble.textContent = msg;
      this.els.pxBubble.classList.add('feedback-error');
    }
    if (this.els.pxHead) this.els.pxHead.textContent = '🤬';
  }
};

UI.prototype._onCustomerLeave = function (type) {
  var px = this.els.pxCurrent;
  if (!px) return;
  px.classList.remove('is-happy', 'is-angry');
  if (type === 'happy') {
    px.classList.add('leave-left');
  } else {
    px.classList.add('leave-right');
  }
  var fb = this.els.pxFeedback;
  if (fb) fb.classList.remove('active');
};

UI.prototype._onMoodChange = function (mood) {
  var npc = State.currentNpc;
  if (npc && this.els.pxBubble) {
    var lines = npc.dialogue.moodChange[mood];
    if (lines && lines.length) {
      this.els.pxBubble.textContent = POS.pickDialogue(lines);
    }
  }
  this._showMoodFx(mood);
  if (this.els.game) {
    if (mood === 'angry') this.els.game.classList.add('danger');
    else this.els.game.classList.remove('danger');
  }
};

UI.prototype._onMoodHint = function (mood) {
  if (mood === 'calm') this._setMood('calm');
};

UI.prototype._setMood = function (mood) {
  if (State.currentMood !== mood) {
    State.prevMood = State.currentMood;
    State.currentMood = mood;
    Bus.emit('moodChange', mood);
  }
};

UI.prototype._showMoodFx = function (mood) {
  var fb = this.els.pxFeedback;
  if (!fb) return;
  var label = '...';
  if (mood === 'calm') label = 'OK';
  else if (mood === 'impatient') label = '...';
  else if (mood === 'annoyed') label = '! ?';
  else if (mood === 'angry') label = '!!!';
  fb.innerHTML = '<span class=\"fb-mood ' + mood + '\">' + label + '</span>';
  fb.classList.add('active');
  this._moodFxTimer = 0.6;
};

UI.prototype._flashCheckoutFail = function () {
  var btn = this.els.checkoutBtn;
  if (!btn) return;
  btn.classList.remove('is-fail');
  /* reflow to restart animation */
  btn.offsetWidth;
  btn.classList.add('is-fail');
  this._checkoutFailTimer = 0.4;
};

/* ---- round lifecycle ---- */

UI.prototype._onRoundStart = function () {
  var round = ROUNDS[State.round];
  var npc = round.npc;

  this._resetCustomerClasses();
  this._renderCart();
  this._renderPOS();
  this._clearScanItem();
  this._updateDiscountDisplay();
  this._randomizeSeasonFx();

  // Apply NPC body color via CSS variable
  var px = this.els.pxCurrent;
  if (px) {
    px.style.setProperty('--npc-body', npc.bodyColor);
    var c = npc.bodyColor;
    var r = parseInt(c.substr(1,2),16), g = parseInt(c.substr(3,2),16), b = parseInt(c.substr(5,2),16);
    var leg = '#' + [Math.floor(r*0.65), Math.floor(g*0.65), Math.floor(b*0.65)]
      .map(function(v){ return ('0'+Math.max(0,v).toString(16)).slice(-2); }).join('');
    px.style.setProperty('--npc-legs', leg);
  }

  this._showOverlay(
    'ROUND ' + (State.round + 1),
    npc.name + ' 등장!',
    'intro'
  );

  // Queue preview with future NPC emojis
  var remaining = PARAMS.endlessRounds ? 5 : (ROUNDS.length - State.round - 1);
  if (this.els.pxQueue) {
    var q = '';
    for (var i = 0; i < Math.min(remaining, 5); i++) {
      var futureRound = ROUNDS[State.round + 1 + i];
      var futureNpc = futureRound ? futureRound.npc : null;
      var qEmoji = futureNpc ? futureNpc.emoji : '😐';
      var qColor = futureNpc ? futureNpc.bodyColor : '#808080';
      q += '<div class="px-qchar">'
        + '<span class="qc-head">' + qEmoji + '</span>'
        + '<div class="qc-body" style="background:' + qColor + '"></div>'
        + '<div class="qc-legs"><div class="qc-leg" style="background:' + qColor + '"></div><div class="qc-leg" style="background:' + qColor + '"></div></div>'
        + '</div>';
    }
    this.els.pxQueue.innerHTML = q;
  }
};

/* ---- checkout mistake with NPC dialogue ---- */

UI.prototype._onCheckoutMistake = function (d) {
  var npc = State.currentNpc;
  var msg = d.message;
  if (npc) {
    var key = MISTAKE_KEY_MAP[d.reason] || d.reason;
    var lines = npc.dialogue.mistake[key];
    if (lines && lines.length) {
      msg = POS.pickDialogue(lines);
    }
  }
  this._showFeedback(msg, 'error');
};

/* ---- cart ---- */

UI.prototype._renderCart = function () {
  var desktop = this.els.cartDesktop;
  if (!desktop) return;
  var round = ROUNDS[State.round];
  desktop.innerHTML = '';

  /* clean up cards that were reparented to .game from previous round */
  var orphans = document.querySelectorAll('.game > .cart-card');
  for (var k = 0; k < orphans.length; k++) orphans[k].remove();

  // Expand items: qty copies as individual cards with damage info, then shuffle
  var cards = [];
  round.items.forEach(function (entry) {
    var item = ITEMS[entry.id];
    if (!item) return;
    for (var q = 0; q < entry.qty; q++) {
      var isDamaged = entry.damagedCopies ? entry.damagedCopies[q] : false;
      cards.push({ item: item, isDamaged: isDamaged, isAdded: !!entry.isAdded });
    }
  });
  // Fisher-Yates shuffle
  for (var i = cards.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
  }

  var cardW = 64, cardH = 64, pad = 6;
  var areaW = desktop.clientWidth  || 340;
  var areaH = desktop.clientHeight || 120;
  var maxX = Math.max(areaW - cardW - pad, pad);
  var maxY = Math.max(areaH - cardH - pad, pad);
  var count = cards.length;

  // Grid-based scattered positions
  var cols = Math.ceil(Math.sqrt(count * (areaW / Math.max(areaH, 1))));
  cols = Math.max(cols, 1);
  var rows = Math.ceil(count / cols);
  var cellW = maxX / Math.max(cols, 1);
  var cellH = maxY / Math.max(rows, 1);

  var self = this;
  self._cartTopZ = count + 1;

  cards.forEach(function (cardData, idx) {
    var item = cardData.item;
    var card = document.createElement('div');
    card.className = 'cart-card'
      + (item.isSale ? ' is-sale' : '')
      + (cardData.isDamaged ? ' is-damaged' : '')
      + (cardData.isAdded ? ' is-added' : '');
    card.dataset.itemId = item.id;
    card.dataset.isDamaged = cardData.isDamaged ? '1' : '0';

    var col = idx % cols;
    var row = Math.floor(idx / cols);
    var bx = pad + col * cellW + (Math.random() - 0.5) * cellW * 0.6;
    var by = pad + row * cellH + (Math.random() - 0.5) * cellH * 0.6;
    bx = Math.max(pad, Math.min(bx, maxX));
    by = Math.max(pad, Math.min(by, maxY));

    var rot = (Math.random() - 0.5) * 30;
    var z = Math.floor(Math.random() * count) + 1;

    card.style.left = bx + 'px';
    card.style.top  = by + 'px';
    card.style.transform = 'rotate(' + rot + 'deg)';
    card.style.zIndex = z;

    var saleBadge = '';
    if (item.isSale) {
      var disc = POS.getCorrectDiscount(item.id);
      saleBadge = '<span class="sbadge">' + (disc ? disc.discountRate + '%' : '割') + '</span>';
    }
    card.innerHTML =
      '<span>' + item.emoji + '</span>' +
      '<span class="cn">' + item.name + '</span>' +
      saleBadge;

    // Drag & click handling
    self._initCardDrag(card, desktop, item);
    desktop.appendChild(card);
  });
};

/* ---- cart card drag → cross-zone → hold-scan ---- */

UI.prototype._initCardDrag = function (card, desktop, item) {
  var self = this;
  var gameEl = document.querySelector('.game');
  var scanner = POS.scanner;
  var dragging = false;
  var startX = 0, startY = 0;
  var moved = false;
  var inGame = false;
  var activePointerId = null;
  var DRAG_THRESHOLD = 6;

  /* Cached during drag — avoids repeated layout reflow on PC */
  var cachedGR = null;
  var cachedScale = 1;
  var rafPending = false;
  var lastMoveEvt = null;
  var scanPanelEl = null;

  function cacheGameRect() {
    cachedGR = gameEl.getBoundingClientRect();
    cachedScale = cachedGR.width / 360;
    if (!scanPanelEl) scanPanelEl = document.querySelector('.scan-panel');
  }

  function gameCoords(e) {
    var gr = cachedGR || gameEl.getBoundingClientRect();
    var s = cachedGR ? cachedScale : (gr.width / 360);
    return { x: (e.clientX - gr.left) / s, y: (e.clientY - gr.top) / s, s: s };
  }

  function applyCardPosition(e) {
    var gc = gameCoords(e);
    var nx = Math.max(0, Math.min(gc.x - 32, 360 - 64));
    var ny = Math.max(0, Math.min(gc.y - 32, 640 - 64));
    card.style.left = nx + 'px';
    card.style.top  = ny + 'px';
  }

  function isOver(e, el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right &&
           e.clientY >= r.top  && e.clientY <= r.bottom;
  }

  /* -- barcode zones for scanner overlap detection -- */

  function addBarcodeZones() {
    removeBarcodeZones();
    item.barcodes.forEach(function (bc, i) {
      var z = document.createElement('div');
      z.className = bc.type === 'discount' ? 'bc-zone discount' : 'bc-zone';
      z.style.cssText = 'left:' + (bc.x * 100) + '%;top:' + (bc.y * 100)
        + '%;width:' + (bc.w * 100) + '%;height:' + (bc.h * 100) + '%';
      z.dataset.idx = i;
      z.dataset.type = bc.type;
      z.dataset.rate = bc.discountRate || 0;
      if (bc.label) z.innerHTML = '<span class="bc-label">' + bc.label + '</span>';
      card.appendChild(z);
    });
  }

  function removeBarcodeZones() {
    var zones = card.querySelectorAll('.bc-zone');
    for (var k = 0; k < zones.length; k++) zones[k].remove();
  }

  /* -- reparent helpers -- */

  function reparentToGame(gc) {
    if (inGame) return;
    var cw = card.offsetWidth || 64;
    var ch = card.offsetHeight || 64;
    inGame = true;
    card.remove();
    card.classList.add('in-game');
    card.style.left = (gc.x - cw / 2) + 'px';
    card.style.top  = (gc.y - ch / 2) + 'px';
    card.style.zIndex = '500';
    gameEl.appendChild(card);
  }

  function reparentToCart(dropEvt) {
    if (!inGame) return;
    inGame = false;
    removeBarcodeZones();
    card.classList.remove('in-game');
    card.style.transition = 'none';
    card.remove();
    var areaW = desktop.clientWidth || 340;
    var areaH = desktop.clientHeight || 120;
    if (dropEvt) {
      var dr = desktop.getBoundingClientRect();
      var gr = cachedGR || gameEl.getBoundingClientRect();
      var s  = cachedGR ? cachedScale : (gr.width / 360);
      var lx = (dropEvt.clientX - dr.left) / s - 32;
      var ly = (dropEvt.clientY - dr.top)  / s - 32;
      card.style.left = Math.max(0, Math.min(lx, areaW - 64)) + 'px';
      card.style.top  = Math.max(0, Math.min(ly, areaH - 64)) + 'px';
    } else {
      card.style.left = Math.max(0, (areaW - 64) / 2) + 'px';
      card.style.top  = Math.max(0, (areaH - 64) / 2) + 'px';
    }
    card.style.transform = 'rotate(0deg)';
    card.style.zIndex = String((self._cartTopZ || 100) + 1);
    self._cartTopZ = parseInt(card.style.zIndex);
    card.style.boxShadow = '';
    desktop.appendChild(card);
  }

  function flyToScanWait() {
    removeBarcodeZones();
    var sc = self.els.scanContent;
    if (!sc) return;
    var scRect = sc.getBoundingClientRect();
    var gr = gameEl.getBoundingClientRect();
    var s = gr.width / 360;
    var waiting = gameEl.querySelectorAll('.cart-card');
    var n = 0;
    for (var k = 0; k < waiting.length; k++) {
      if (waiting[k] !== card) n++;
    }
    var offX = ((n % 3) - 1) * 18;
    var offY = Math.floor(n / 3) * 14;
    var tx = (scRect.left + scRect.width / 2 - gr.left) / s - 32 + offX;
    var ty = (scRect.top + scRect.height * 0.35 - gr.top) / s - 32 + offY;
    card.style.transition = 'left 0.25s ease-out, top 0.25s ease-out, transform 0.25s ease-out';
    card.style.left = tx + 'px';
    card.style.top  = ty + 'px';
    card.style.transform = 'rotate(0deg) scale(1)';
    card.style.boxShadow = '';
    card.style.cursor = 'pointer';
    setTimeout(function () { card.style.transition = ''; }, 260);
  }

  /* -- damaged barcode overlay (no scan zones) -- */

  function addDamagedOverlay() {
    removeBarcodeZones();
    var existing = card.querySelector('.bc-damaged');
    if (existing) existing.remove();
    var dmg = document.createElement('div');
    dmg.className = 'bc-damaged';
    dmg.innerHTML = '<span class="bc-dmg-label">DAMAGED</span>';
    card.appendChild(dmg);
  }

  function removeDamagedOverlay() {
    var el = card.querySelector('.bc-damaged');
    if (el) el.remove();
  }

  /* -- begin scan session: set State + scanner for hold-scan -- */

  function startScanSession() {
    if (card.dataset.isDamaged === '1') {
      /* Damaged barcode: show overlay, allow drag but no scan */
      addDamagedOverlay();
      State.selectedItemId = item.id;
      State.scanPhase = 'itemSelected';
      State.holdProgress = 0;
      State.dragActive = true;
      scanner.setActiveDrag(card);
      Bus.emit('cardPickup', item.id);
      return;
    }
    addBarcodeZones();
    State.selectedItemId = item.id;
    State.scanPhase = 'itemSelected';
    State.holdProgress = 0;
    State.dragActive = true;
    scanner.setActiveDrag(card);
    Bus.emit('cardPickup', item.id);
  }

  /* -- listen for scan completion (from game.update hold-scan) -- */

  Bus.on('scanComplete', function (data) {
    if (scanner.activeDragEl !== card) return;
    /* scan succeeded — fly card to wait area */
    dragging = false;
    State.dragActive = false;
    cleanupDragState();
    card.style.willChange = '';
    if (activePointerId !== null) {
      try { card.releasePointerCapture(activePointerId); } catch (ex) { /* ok */ }
      activePointerId = null;
    }
    scanner.clearActiveDrag();
    flyToScanWait();
  });

  /* --- pointer handlers --- */

  function onDown(e) {
    if (State.phase !== 'playing') return;
    e.preventDefault();
    dragging = true;
    moved = false;
    activePointerId = e.pointerId;
    card.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    cacheGameRect();
    card.style.transition = 'none';
    card.style.willChange = 'left, top, transform';
    card.style.cursor = 'grabbing';

    if (inGame) {
      /* re-grab from scan wait area */
      moved = true;
      card.style.zIndex = '500';
      card.style.transform = 'rotate(0deg) scale(1.08)';
      card.style.boxShadow = '4px 4px 12px rgba(0,0,0,0.4), inset 1px 1px 0 #fff, inset -1px -1px 0 #808080';
      startScanSession();
    } else {
      self._cartTopZ = (self._cartTopZ || 100) + 1;
      card.style.zIndex = self._cartTopZ;
    }
  }

  function onMove(e) {
    if (!dragging) return;

    if (!inGame) {
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        moved = true;
        reparentToGame(gameCoords(e));
        startX = e.clientX;
        startY = e.clientY;
        startScanSession();
        card.style.transform = 'rotate(0deg) scale(1.08)';
        card.style.boxShadow = '4px 4px 12px rgba(0,0,0,0.4), inset 1px 1px 0 #fff, inset -1px -1px 0 #808080';
      }
      if (!moved) return;
    }

    /* Batch position updates via RAF — prevents PC stutter from high-freq pointermove */
    lastMoveEvt = e;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        if (!lastMoveEvt || !dragging) return;
        applyCardPosition(lastMoveEvt);
        if (scanPanelEl) scanPanelEl.classList.toggle('drop-hover', isOver(lastMoveEvt, scanPanelEl));
      });
    }
  }

  function cleanupDragState() {
    rafPending = false;
    lastMoveEvt = null;
    cachedGR = null;
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    activePointerId = null;
    State.dragActive = false;
    cleanupDragState();
    try { card.releasePointerCapture(e.pointerId); } catch (ex) { /* ok */ }
    card.style.cursor = 'pointer';
    card.style.boxShadow = '';
    card.style.willChange = '';

    if (scanPanelEl) scanPanelEl.classList.remove('drop-hover');

    if (!moved) {
      card.style.transform = '';
      return;
    }

    /* Apply final position exactly at drop point */
    if (inGame) applyCardPosition(e);

    var cartZone = document.querySelector('.cart-zone');
    if (isOver(e, cartZone)) {
      /* return to cart — cancel scan */
      State.scanPhase = 'idle';
      State.selectedItemId = null;
      State.holdProgress = 0;
      scanner.clearActiveDrag();
      reparentToCart(e);
    } else {
      /* stay in .game — card rests at drop position */
      card.style.transform = 'rotate(0deg)';
    }
  }

  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup',   onUp);
  card.addEventListener('pointercancel', onUp);
};

/* ---- Meta event: POS CRT Blackout ---- */

UI.prototype._onPosBlackout = function (isBlackout) {
  var posPanel = document.querySelector('.pos-panel');
  if (!posPanel) return;
  var self = this;

  if (isBlackout) {
    posPanel.classList.add('crt-blackout');
    setTimeout(function () {
      if (State.posBlackout) posPanel.classList.add('crt-reboot');
    }, 300);
  } else {
    posPanel.classList.remove('crt-reboot');
    posPanel.classList.add('crt-poweron');
    setTimeout(function () {
      posPanel.classList.remove('crt-blackout', 'crt-poweron');
    }, 500);
    self._renderPOS();
  }
};

/* ---- Meta event: Mid-round Add ---- */

UI.prototype._onMidAdd = function (newItems) {
  var desktop = this.els.cartDesktop;
  if (!desktop) return;
  var self = this;

  /* Show NPC dialogue */
  var npc = State.currentNpc;
  if (npc && this.els.pxBubble) {
    var lines = npc.dialogue.addRequest;
    if (lines && lines.length) {
      this.els.pxBubble.textContent = POS.pickDialogue(lines);
    } else {
      this.els.pxBubble.textContent = 'あ、これも追加で！';
    }
  }

  /* Create new cart cards */
  var areaW = desktop.clientWidth || 340;
  var areaH = desktop.clientHeight || 120;

  for (var i = 0; i < newItems.length; i++) {
    var entry = newItems[i];
    var item = entry.item;
    for (var q = 0; q < entry.qty; q++) {
      var card = document.createElement('div');
      card.className = 'cart-card is-added' + (item.isSale ? ' is-sale' : '');
      card.dataset.itemId = item.id;
      card.dataset.isDamaged = '0';

      var bx = Math.random() * (areaW - 64);
      var by = Math.random() * (areaH - 64);
      var rot = (Math.random() - 0.5) * 20;

      card.style.left = bx + 'px';
      card.style.top = by + 'px';
      card.style.transform = 'rotate(' + rot + 'deg) scale(0)';
      card.style.zIndex = String((self._cartTopZ || 100) + 1);
      self._cartTopZ = parseInt(card.style.zIndex);

      var saleBadge = '';
      if (item.isSale) {
        var disc = POS.getCorrectDiscount(item.id);
        saleBadge = '<span class="sbadge">' + (disc ? disc.discountRate + '%' : '割') + '</span>';
      }
      card.innerHTML =
        '<span>' + item.emoji + '</span>' +
        '<span class="cn">' + item.name + '</span>' +
        saleBadge;

      self._initCardDrag(card, desktop, item);
      desktop.appendChild(card);

      /* Pop-in animation */
      (function (c, r) {
        setTimeout(function () {
          c.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          c.style.transform = 'rotate(' + r + 'deg) scale(1)';
          setTimeout(function () { c.style.transition = ''; }, 320);
        }, 50 + i * 100);
      })(card, rot);
    }
  }
};

/* ---- Meta event: Mid-round Cancel ---- */

UI.prototype._onMidCancel = function (cancelledItems) {
  var desktop = this.els.cartDesktop;
  if (!desktop) return;

  /* Show NPC dialogue */
  var npc = State.currentNpc;
  if (npc && this.els.pxBubble) {
    var lines = npc.dialogue.cancelRequest;
    if (lines && lines.length) {
      this.els.pxBubble.textContent = POS.pickDialogue(lines);
    } else {
      this.els.pxBubble.textContent = 'やっぱりこれ、いらない。';
    }
  }

  /* Mark cancelled cart cards */
  for (var i = 0; i < cancelledItems.length; i++) {
    var ci = cancelledItems[i];
    var matchCards = desktop.querySelectorAll('.cart-card[data-item-id="' + ci.id + '"]');
    var marked = 0;
    for (var j = 0; j < matchCards.length; j++) {
      if (marked >= ci.cancelQty) break;
      if (!matchCards[j].classList.contains('is-cancelled')) {
        matchCards[j].classList.add('is-cancelled');
        marked++;
      }
    }

    /* Flash POS row if item already scanned */
    var posScroll = this.els.posScroll;
    if (posScroll) {
      var rows = posScroll.querySelectorAll('.pos-row');
      for (var r = 0; r < rows.length; r++) {
        var qb = rows[r].querySelector('.qb[data-id*="' + ci.id + '"]');
        if (qb) {
          rows[r].classList.add('cancel-flash');
          (function (row) {
            setTimeout(function () { row.classList.remove('cancel-flash'); }, 1000);
          })(rows[r]);
        }
      }
    }
  }
};

/* ---- POS list ---- */

UI.prototype._renderPOS = function () {
  var scroll = this.els.posScroll;
  if (!scroll) return;
  scroll.innerHTML = '';

  if (State.posItems.length === 0) {
    scroll.innerHTML = '<div style="color:#006600;font-size:11px;text-align:center;padding:12px 4px">C:\\POS> 카트에서 상품을<br/>드래그해서 스캔..._</div>';
  }

  var total = 0;
  var items = State.posItems;
  for (var pi = items.length - 1; pi >= 0; pi--) { var pos = items[pi];
    var item = ITEMS[pos.itemId];
    if (!item) return;
    var price = item.isSale && pos.barcodeType === 'discount'
      ? Math.round(item.price * (1 - pos.discountRate / 100))
      : item.price;
    var lineTotal = price * pos.qty;
    total += lineTotal;

    var row = document.createElement('div');
    row.className = 'pos-row' + (item.isSale ? ' sale' : '');
    var posKey = pos.itemId + '_' + pos.discountRate;
    var midLabel = pos.discountRate > 0
      ? '<span class="sale-dot">' + pos.discountRate + '%OFF</span>'
      : (item.isSale ? '<span class="sale-dot">割</span>' : '<span class="nm">' + item.name + '</span>');

    row.innerHTML =
      '<span class="em">' + item.emoji + '</span>' +
      '<span class="dc">' + midLabel + '</span>' +
      '<div class="qty-ctrl">' +
        '<span class="qb" data-action="minus" data-id="' + posKey + '">−</span>' +
        '<span class="qn">' + pos.qty + '</span>' +
        '<span class="qb" data-action="plus" data-id="' + posKey + '">＋</span>' +
      '</div>';
    scroll.appendChild(row);
  }

  scroll.querySelectorAll('.qb').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = btn.dataset.id;
      Bus.emit(btn.dataset.action === 'plus' ? 'qtyPlus' : 'qtyMinus', id);
    });
  });

  if (this.els.posFoot) this.els.posFoot.textContent = '¥' + total.toLocaleString();
};

/* ---- scan zone ---- */

UI.prototype._renderScanItem = function (itemId) {
  /* skip legacy drag-item when card-based drag is active */
  if (POS.scanner && POS.scanner.activeDragEl) return;

  var item = ITEMS[itemId];
  if (!item) return;
  var content = this.els.scanContent;
  if (!content) return;

  var old = content.querySelector('.drag-item');
  if (old) old.remove();

  var el = document.createElement('div');
  el.className = 'drag-item';
  el.style.touchAction = 'none';

  var bcHtml = '';
  item.barcodes.forEach(function (bc, i) {
    var cls = bc.type === 'discount' ? 'bc-zone discount' : 'bc-zone';
    bcHtml += '<div class="' + cls + '"'
      + ' style="left:' + (bc.x * 100) + '%;top:' + (bc.y * 100) + '%;width:' + (bc.w * 100) + '%;height:' + (bc.h * 100) + '%"'
      + ' data-idx="' + i + '" data-type="' + bc.type + '" data-rate="' + (bc.discountRate || 0) + '">'
      + (bc.label ? '<span class="bc-label">' + bc.label + '</span>' : '')
      + '</div>';
  });

  el.innerHTML =
    '<span class="item-emoji">' + item.emoji + '</span>' +
    '<span class="il">' + item.name + '</span>' +
    bcHtml;

  var arrow = content.querySelector('.drag-arrow');
  if (arrow) content.insertBefore(el, arrow); else content.prepend(el);

  el.style.left = (content.clientWidth / 2) + 'px';
  el.style.top  = '40px';

  if (this.els.scanMsg) {
    this.els.scanMsg.textContent = item.isSale
      ? '올바른 할인 바코드를\n스캐너에 맞춰!'
      : '바코드를 스캐너에\n맞춰서 유지!';
  }
};

UI.prototype._clearScanItem = function () {
  var content = this.els.scanContent;
  if (!content) return;
  var old = content.querySelector('.drag-item');
  if (old) old.remove();
  if (this.els.scanMsg) this.els.scanMsg.innerHTML = '할인 설정 후<br/>바코드를 스캐너에!';
  this._updateProgress(0);
  if (this.els.cartDesktop) {
    this.els.cartDesktop.querySelectorAll('.cart-card').forEach(function (c) { c.classList.remove('active'); });
  }
};

UI.prototype._updateProgress = function (pct) {
  if (this.els.scanProg) {
    this.els.scanProg.style.width = Math.min(pct * 100, 100) + '%';
    this.els.scanProg.style.animation = 'none';
  }
};

/* ---- discount control ---- */

UI.prototype._changeDiscount = function (delta) {
  State.scanDiscountRate = Math.max(0, Math.min(50, State.scanDiscountRate + delta));
  this._updateDiscountDisplay();
};

UI.prototype._updateDiscountDisplay = function () {
  if (!this.els.dcVal) return;
  var r = State.scanDiscountRate;
  this.els.dcVal.textContent = r > 0 ? r + '% OFF' : '할인 없음';
  this.els.dcVal.classList.toggle('dc-active', r > 0);
};

/* ---- scan fail flash ---- */

UI.prototype._onScanFail = function () {
  var content = this.els.scanContent;
  if (!content) return;
  content.classList.remove('scan-fail-flash');
  /* force reflow to restart animation */
  void content.offsetWidth;
  content.classList.add('scan-fail-flash');
  setTimeout(function () { content.classList.remove('scan-fail-flash'); }, 500);
};

UI.prototype._updateScanMsg = function () {
  var content = this.els.scanContent;
  if (!content) return;

  /* bc-zones may live on the active drag card (in .game), not inside scan-content */
  var activeDrag = POS.scanner ? POS.scanner.activeDragEl : null;
  var zones = activeDrag ? activeDrag.querySelectorAll('.bc-zone')
                         : content.querySelectorAll('.bc-zone');
  for (var i = 0; i < zones.length; i++) zones[i].classList.remove('active');

  var scannerDrop = content.querySelector('.scanner-drop');
  if (scannerDrop) scannerDrop.classList.toggle('detecting', State.scanPhase === 'scanning');

  if (State.currentBarcodeHit && State.scanPhase === 'scanning') {
    var item = ITEMS[State.selectedItemId];
    if (item) {
      var idx = item.barcodes.indexOf(State.currentBarcodeHit);
      if (idx >= 0 && zones[idx]) zones[idx].classList.add('active');
    }
  }
};

UI.prototype._onScanComplete = function (data) {
  var content = this.els.scanContent;
  if (content) {
    content.classList.add('scan-flash');
    setTimeout(function () { content.classList.remove('scan-flash'); }, 200);
  }
  if (data.combo >= 2) this._showCombo(data.combo);

  // 30% chance to show NPC scanSuccess dialogue
  if (State.currentNpc && this.els.pxBubble) {
    var roll = Math.random();
    if (roll < 0.3) {
      this.els.pxBubble.textContent = POS.pickDialogue(State.currentNpc.dialogue.scanSuccess);
    } else if (roll < 0.5) {
      this.els.pxBubble.textContent = POS.pickDialogue(State.currentNpc.dialogue.bagSuccess);
    }
  }
};

UI.prototype._showCombo = function (n) {
  var popup = document.createElement('div');
  popup.className = 'combo-popup';
  popup.textContent = 'COMBO ×' + n;
  var game = document.querySelector('.game');
  if (game) game.appendChild(popup);
  setTimeout(function () { popup.remove(); }, 800);
};

/* ---- feedback ---- */

UI.prototype._showFeedback = function (message, type) {
  if (this.els.pxBubble) {
    this.els.pxBubble.textContent = message;
    this.els.pxBubble.classList.add('feedback-' + type);
  }
  this._feedbackTimer = 3.5;
};

UI.prototype._hideFeedback = function () {
  if (this.els.pxBubble) {
    this.els.pxBubble.classList.remove('feedback-error', 'feedback-success');
  }
};

/* ---- overlay ---- */

UI.prototype._showOverlay = function (title, subtitle, type) {
  var ov    = this.els.overlay;
  var inner = this.els.overlayInner;
  if (!ov || !inner) return;

  var btnHtml = (type === 'fail' || type === 'clear')
    ? '<button class="overlay-btn" id="overlay-retry">RETRY</button>'
    : '';

  if (type === 'fail') {
    var report = State.lastCheckoutReport;
    var reason = report && report.reason ? report.reason.toUpperCase() : 'UNKNOWN';
    var msg = report && report.message ? report.message : subtitle;
    var linesHtml = '';
    if (report && report.lines && report.lines.length) {
      for (var i = 0; i < report.lines.length; i++) {
        var ln = report.lines[i];
        var bad = ln.status !== 'ok';
        linesHtml += '<div class="receipt-item' + (bad ? ' bad' : '') + '">' +
          '<span class="ri-name">' + ln.name + '</span>' +
          '<span class="ri-qty">x' + ln.actual + ' / x' + ln.expected + '</span>' +
          '</div>';
      }
    } else {
      linesHtml = '<div class="receipt-item bad">NO RECEIPT LOG</div>';
    }
    inner.innerHTML =
      '<div class="receipt">' +
        '<div class="receipt-head">WRONG RECEIPT</div>' +
        '<div class="receipt-sub">' + msg + '</div>' +
        '<div class="receipt-meta">REASON: ' + reason + '</div>' +
        '<div class="receipt-items">' + linesHtml + '</div>' +
        '<div class="receipt-total">SCORE: ' + State.score.toLocaleString() + '</div>' +
        btnHtml +
      '</div>';
  } else {
    inner.innerHTML =
      '<div class="overlay-title ' + type + '">' + title + '</div>' +
      '<div class="overlay-sub">' + subtitle + '</div>' +
      btnHtml;
  }

  ov.classList.remove('hidden');
  ov.className = 'overlay ' + type;

  var retryBtn = inner.querySelector('#overlay-retry');
  if (retryBtn) retryBtn.addEventListener('click', function () { Bus.emit('retryClick'); });
};

UI.prototype._hideOverlay = function () {
  if (this.els.overlay) this.els.overlay.classList.add('hidden');
};

/* ---- Game Over screen with served NPCs + encouragement ---- */
UI.prototype._showGameOver = function () {
  var ov    = this.els.overlay;
  var inner = this.els.overlayInner;
  if (!ov || !inner) return;

  var served = State.servedNpcs || [];
  var enc = POS.ENCOURAGEMENTS || [];

  /* Build served NPC faces row */
  var facesHtml = '';
  if (served.length > 0) {
    facesHtml += '<div class="go-served">';
    facesHtml += '<div class="go-served-title">🎉 오늘 서빙한 손님들</div>';
    facesHtml += '<div class="go-faces">';
    for (var i = 0; i < served.length; i++) {
      facesHtml += '<div class="go-face" style="animation-delay:' + (i * 0.12) + 's">' +
        '<span class="go-face-emoji">' + served[i].emoji + '</span>' +
        '</div>';
    }
    facesHtml += '</div>';
    facesHtml += '<div class="go-served-count">' + served.length + '명의 손님에게 감사받았어요!</div>';
    facesHtml += '</div>';
  } else {
    facesHtml += '<div class="go-served">';
    facesHtml += '<div class="go-served-title">😢 오늘은 아무도 못 보냈어요...</div>';
    facesHtml += '</div>';
  }

  /* Pick random served NPC as speaker + random encouragement message */
  var bubbleHtml = '';
  if (served.length > 0 && enc.length > 0) {
    var speaker = served[Math.floor(Math.random() * served.length)];
    var msg = enc[Math.floor(Math.random() * enc.length)];
    bubbleHtml =
      '<div class="go-bubble-wrap">' +
        '<div class="go-bubble">' +
          '<span class="go-bubble-emoji">' + speaker.emoji + '</span>' +
          '<div class="go-bubble-text">' +
            '<div class="go-bubble-msg">"' + msg.ja + '"</div>' +
            '<div class="go-bubble-who">— ' + speaker.name + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="go-bubble-ko">' + msg.ko + '</div>' +
      '</div>';
  }

  inner.innerHTML =
    '<div class="go-screen">' +
      '<div class="go-title">GAME OVER</div>' +
      '<div class="go-score">SCORE: ' + State.score.toLocaleString() + '</div>' +
      '<div class="go-round">🏪 ROUND ' + (State.round + 1) + ' · COMBO x' + State.maxCombo + '</div>' +
      '<div class="go-divider">━━━━━━━━━━━━━━━━━━━━</div>' +
      facesHtml +
      '<div class="go-divider">━━━━━━━━━━━━━━━━━━━━</div>' +
      bubbleHtml +
      '<button class="overlay-btn go-retry" id="overlay-retry">🔄 다시 도전하기</button>' +
    '</div>';

  ov.classList.remove('hidden');
  ov.className = 'overlay gameover';

  var retryBtn = inner.querySelector('#overlay-retry');
  if (retryBtn) retryBtn.addEventListener('click', function () { Bus.emit('retryClick'); });
};

UI.prototype.showTitle = function () {
  var ov    = this.els.overlay;
  var inner = this.els.overlayInner;
  if (!ov || !inner) return;

  inner.innerHTML =
    '<div class="title-screen">' +
      '<div class="title-logo">' +
        '<span class="title-icon">🏪</span> POS SCAN RUSH <span class="title-icon">🏪</span>' +
      '</div>' +
      '<div class="title-divider">━━━━━━━━━━━━━━━━━━━━━━</div>' +

      '<div class="title-story">' +
        '<div class="title-setting">🌸 1995年、東京 ── 어느 봄날 🗼</div>' +
        '<div class="title-narrative">' +
          '한국에서 온 유학생,<br>' +
          '낯선 편의점 계산대 앞에 서다.' +
        '</div>' +
        '<div class="title-quote">' +
          '알바 첫날, 긴장되는 마음을 안고...<br>' +
          '<span class="title-japanese">"いらっしゃいませ！"</span>' +
        '</div>' +
      '</div>' +

      '<div class="title-divider">━━━━━━━━━━━━━━━━━━━━━━</div>' +

      '<div class="title-howto">' +
        '<div class="title-howto-title">🎮 HOW TO PLAY</div>' +
        '<div class="title-step">📦 아래 화면에는 손님의 구메한 상품 장바구니<em></em>!</div>' +
        '<div class="title-step">💻 상품 하나씩 바코드 스캔 하고 <em>가격 확인</em>!</div>' +
        '<div class="title-step">💴 POS 기에 모든상품 등록 후 <em>계산 버튼 클릭</em>!</div>' +
        '<div class="title-challenge">⚡ 빠르고 정확하게, 손님을 웃게 하세요!</div>' +
      '</div>' +

      '<div class="title-divider">━━━━━━━━━━━━━━━━━━━━━━</div>' +

      '<div class="title-start">' +
        '<span class="title-blink">▶ 화면을 클릭하여 시작</span>' +
      '</div>' +

      '<div class="title-footer">' +
        '🇰🇷 유학생 아르바이트 서바이벌 🇯🇵' +
      '</div>' +
    '</div>';

  ov.classList.remove('hidden');
  ov.className = 'overlay title';

  var handler = function () {
    ov.removeEventListener('click', handler);
    Bus.emit('startClick');
  };
  ov.addEventListener('click', handler);
};

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

POS.UI = UI;
})();
