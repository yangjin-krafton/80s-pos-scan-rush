/* src/js/ui.js — DOM rendering */
(function () {
'use strict';
var POS    = window.POS;
var ITEMS  = POS.ITEMS;
var CUSTOMER_TYPES = POS.CUSTOMER_TYPES;
var ROUNDS = POS.ROUNDS;
var PARAMS = POS.PARAMS;
var State  = POS.State;
var Bus    = POS.Bus;

function UI() {
  this.els = {};
  this._feedbackTimer = 0;
}

/* ---- init ---- */
UI.prototype.init = function () {
  this._cache();
  this._bindButtons();
  this._listenBus();
};

UI.prototype._cache = function () {
  var q = function (s) { return document.querySelector(s); };
  this.els = {
    infoRound:    q('#info-round'),
    infoScore:    q('#info-score'),
    hudName:      q('.hud-name'),
    hudHearts:    q('.hud-hearts'),
    hudRight:     q('.hud-right'),
    pxHead:       q('.px-head'),
    pxBubble:     q('.px-bubble'),
    pxBody:       q('.px-body'),
    pxQueue:      q('.px-queue'),
    posScroll:    q('.pos-scroll'),
    posFoot:      q('.pos-foot .tv'),
    bagChip:      q('.bag-chip'),
    scanContent:  q('.scan-content'),
    scanProg:     q('.scan-prog-fill'),
    scanMsg:      q('.scan-msg'),
    cartScroll:   q('.cart-scroll'),
    overlay:      q('#overlay'),
    overlayInner: q('#overlay-inner'),
  };
};

UI.prototype._bindButtons = function () {
  var bagBtn = document.querySelector('.act-btn.bag');
  var retBtn = document.querySelector('.act-btn.ret');
  var chkBtn = document.querySelector('.checkout');
  if (bagBtn) bagBtn.addEventListener('click', function () { Bus.emit('bagClick'); });
  if (retBtn) retBtn.addEventListener('click', function () { Bus.emit('returnClick'); });
  if (chkBtn) chkBtn.addEventListener('click', function () { Bus.emit('checkoutClick'); });
};

UI.prototype._listenBus = function () {
  var self = this;
  Bus.on('roundStart',      function ()  { self._onRoundStart(); });
  Bus.on('roundReady',      function ()  { self._onRoundReady(); });
  Bus.on('itemSelected',    function (id){ self._renderScanItem(id); });
  Bus.on('itemBagged',      function ()  { self._clearScanItem(); });
  Bus.on('itemReturned',    function ()  { self._clearScanItem(); });
  Bus.on('scanComplete',    function (d) { self._onScanComplete(d); });
  Bus.on('posUpdated',      function ()  { self._renderPOS(); });
  Bus.on('holdProgress',    function (p) { self._updateProgress(p); });
  Bus.on('checkoutMistake', function (d) { self._showFeedback(d.message, 'error'); });
  Bus.on('roundClear',      function ()  { self._showOverlay('ROUND CLEAR!', '+' + PARAMS.scoreCheckout + ' pts', 'success'); });
  Bus.on('gameOver',        function ()  { self._showOverlay('GAME OVER', 'SCORE: ' + State.score.toLocaleString(), 'fail'); });
  Bus.on('gameClear',       function ()  { self._showOverlay('ALL CLEAR!', 'TOTAL: ' + State.score.toLocaleString(), 'clear'); });
};

/* ---- per-frame ---- */
UI.prototype.update = function (dt) {
  this._updateInfoBar();
  this._updateCustomer();
  this._updateScanMsg();
  if (this._feedbackTimer > 0) {
    this._feedbackTimer -= dt;
    if (this._feedbackTimer <= 0) this._hideFeedback();
  }
};

/* ---- info bar ---- */
UI.prototype._updateInfoBar = function () {
  var rd = this.els.infoRound;
  var sc = this.els.infoScore;
  if (rd) rd.textContent = pad2(State.round + 1) + '/' + pad2(ROUNDS.length);
  if (sc) sc.textContent = String(State.score).padStart(6, '0');
};

/* ---- customer ---- */
UI.prototype._updateCustomer = function () {
  if (State.phase === 'title') return;
  var round = ROUNDS[State.round];
  if (!round) return;
  var cust = CUSTOMER_TYPES[round.customer];
  var sat  = State.satisfaction;

  // hearts
  var hearts = this.els.hudHearts;
  if (hearts) {
    var total = 10;
    var filled = Math.ceil(sat / (PARAMS.maxSatisfaction / total));
    var html = '';
    for (var i = 0; i < total; i++) {
      if (i < filled) html += sat < 30 ? '<i class="hud-heart warn"></i>' : '<i class="hud-heart"></i>';
      else html += '<i class="hud-heart empty"></i>';
    }
    hearts.innerHTML = html;
  }
  // expression
  if (this.els.pxHead) {
    if (sat > 70) this.els.pxHead.textContent = cust.emoji;
    else if (sat > 40) this.els.pxHead.textContent = '😐';
    else if (sat > 15) this.els.pxHead.textContent = '😠';
    else this.els.pxHead.textContent = '🤬';
  }
  // bubble
  if (this.els.pxBubble) {
    if (sat > 70) this.els.pxBubble.textContent = '좋아좋아!';
    else if (sat > 40) this.els.pxBubble.textContent = '아직인가…';
    else if (sat > 15) this.els.pxBubble.textContent = '느려!';
    else this.els.pxBubble.textContent = '더 못 참아!';
  }
  if (this.els.hudName)  this.els.hudName.textContent = cust.name + ' #' + pad2(State.round + 1);
  if (this.els.hudRight) this.els.hudRight.textContent = 'ROUND ' + pad2(State.round + 1) + '/' + ROUNDS.length;
};

/* ---- round lifecycle ---- */

UI.prototype._onRoundStart = function () {
  this._renderCart();
  this._renderPOS();
  this._clearScanItem();
  this._showOverlay(
    'ROUND ' + (State.round + 1),
    CUSTOMER_TYPES[ROUNDS[State.round].customer].name + ' 등장!',
    'intro'
  );
  // queue
  var remaining = ROUNDS.length - State.round - 1;
  if (this.els.pxQueue) {
    var emojis = ['😐','😴','🤔','😊','😤'];
    var q = '';
    for (var i = 0; i < Math.min(remaining, 5); i++) {
      q += '<div class="px-qchar">'
        + '<span class="qc-head">' + emojis[i % emojis.length] + '</span>'
        + '<div class="qc-body"></div>'
        + '<div class="qc-legs"><div class="qc-leg"></div><div class="qc-leg"></div></div>'
        + '</div>';
    }
    this.els.pxQueue.innerHTML = q;
  }
};

UI.prototype._onRoundReady = function () { this._hideOverlay(); };

/* ---- cart ---- */

UI.prototype._renderCart = function () {
  var scroll = this.els.cartScroll;
  if (!scroll) return;
  var round = ROUNDS[State.round];
  scroll.innerHTML = '';

  round.items.forEach(function (entry) {
    var item = ITEMS[entry.id];
    if (!item) return;
    var card = document.createElement('div');
    card.className = 'cart-card';
    card.dataset.itemId = item.id;
    card.innerHTML =
      '<span>' + item.emoji + '</span>' +
      '<span class="cn">' + item.name + '</span>' +
      (entry.qty > 1 ? '<span class="badge">' + entry.qty + '</span>' : '') +
      (item.isSale ? '<span class="sbadge">割</span>' : '');
    card.addEventListener('click', function () {
      Bus.emit('cartItemClick', item.id);
      scroll.querySelectorAll('.cart-card').forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
    });
    scroll.appendChild(card);
  });
};

/* ---- POS list ---- */

UI.prototype._renderPOS = function () {
  var scroll = this.els.posScroll;
  if (!scroll) return;
  scroll.innerHTML = '';

  if (State.posItems.length === 0) {
    scroll.innerHTML = '<div style="color:#006600;font-size:11px;text-align:center;padding:12px 4px">C:\\POS> 상품을 스캔<br/>해주세요..._</div>';
  }

  var total = 0;
  State.posItems.forEach(function (pos) {
    var item = ITEMS[pos.itemId];
    if (!item) return;
    var price = item.isSale && pos.barcodeType === 'discount'
      ? Math.round(item.price * (1 - pos.discountRate / 100))
      : item.price;
    var lineTotal = price * pos.qty;
    total += lineTotal;

    var row = document.createElement('div');
    row.className = 'pos-row' + (item.isSale ? ' sale' : '');
    row.innerHTML =
      '<span class="em">' + item.emoji + '</span>' +
      '<div class="info">' +
        '<span class="nm">' + item.name + (item.isSale ? '<span class="sale-dot">割</span>' : '') + '</span>' +
        '<span class="pr">¥' + price + ' × ' + pos.qty + ' = ¥' + lineTotal.toLocaleString() + '</span>' +
      '</div>' +
      '<div class="qty-ctrl">' +
        '<span class="qb" data-action="minus" data-id="' + pos.itemId + '">−</span>' +
        '<span class="qn">' + pos.qty + '</span>' +
        '<span class="qb" data-action="plus" data-id="' + pos.itemId + '">＋</span>' +
      '</div>';
    scroll.appendChild(row);
  });

  scroll.querySelectorAll('.qb').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = btn.dataset.id;
      Bus.emit(btn.dataset.action === 'plus' ? 'qtyPlus' : 'qtyMinus', id);
    });
  });

  if (this.els.posFoot) this.els.posFoot.textContent = '¥' + total.toLocaleString();
  if (this.els.bagChip) this.els.bagChip.innerHTML = '<span class="bi">👜</span>×' + State.bagCount;
};

/* ---- scan zone ---- */

UI.prototype._renderScanItem = function (itemId) {
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
  if (this.els.scanMsg) this.els.scanMsg.innerHTML = '카트에서 상품을<br/>골라주세요!';
  this._updateProgress(0);
  if (this.els.cartScroll) {
    this.els.cartScroll.querySelectorAll('.cart-card').forEach(function (c) { c.classList.remove('active'); });
  }
};

UI.prototype._updateProgress = function (pct) {
  if (this.els.scanProg) {
    this.els.scanProg.style.width = Math.min(pct * 100, 100) + '%';
    this.els.scanProg.style.animation = 'none';
  }
};

UI.prototype._updateScanMsg = function () {
  var content = this.els.scanContent;
  if (!content) return;
  var zones = content.querySelectorAll('.bc-zone');
  for (var i = 0; i < zones.length; i++) zones[i].classList.remove('active');

  var scanner = content.querySelector('.scanner-drop');
  if (scanner) scanner.classList.toggle('detecting', State.scanPhase === 'scanning');

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
  this._feedbackTimer = 2.0;
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

  inner.innerHTML =
    '<div class="overlay-title ' + type + '">' + title + '</div>' +
    '<div class="overlay-sub">' + subtitle + '</div>' +
    btnHtml;

  ov.classList.remove('hidden');
  ov.className = 'overlay ' + type;

  var retryBtn = inner.querySelector('#overlay-retry');
  if (retryBtn) retryBtn.addEventListener('click', function () { Bus.emit('retryClick'); });
};

UI.prototype._hideOverlay = function () {
  if (this.els.overlay) this.els.overlay.classList.add('hidden');
};

UI.prototype.showTitle = function () {
  this._showOverlay('POS SCAN RUSH', 'Click to Start!', 'title');
  var ov = this.els.overlay;
  if (ov) {
    var handler = function () {
      ov.removeEventListener('click', handler);
      Bus.emit('startClick');
    };
    ov.addEventListener('click', handler);
  }
};

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

POS.UI = UI;
})();
