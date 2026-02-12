/* src/js/scanner.js — Drag input + barcode-scanner hit detection */
(function () {
'use strict';
var POS   = window.POS;
var ITEMS  = POS.ITEMS;
var State  = POS.State;
var Bus    = POS.Bus;

function Scanner() {
  this.scanContent = null;
  this.scannerDrop = null;
  this._onDown = this._onDown.bind(this);
  this._onMove = this._onMove.bind(this);
  this._onUp   = this._onUp.bind(this);
}

Scanner.prototype.bind = function (scanContentEl) {
  this.scanContent = scanContentEl;
  this.scannerDrop = scanContentEl.querySelector('.scanner-drop');
  scanContentEl.addEventListener('pointerdown', this._onDown);
  scanContentEl.addEventListener('pointermove', this._onMove);
  scanContentEl.addEventListener('pointerup',   this._onUp);
  scanContentEl.addEventListener('pointercancel', this._onUp);
};

Scanner.prototype._onDown = function (e) {
  var dragItem = e.target.closest('.drag-item');
  if (!dragItem) return;
  if (State.scanPhase !== 'itemSelected' && State.scanPhase !== 'scanning') return;

  e.preventDefault();
  dragItem.setPointerCapture(e.pointerId);
  State.dragActive = true;

  var rect = dragItem.getBoundingClientRect();
  State.dragOffsetX = e.clientX - (rect.left + rect.width  / 2);
  State.dragOffsetY = e.clientY - (rect.top  + rect.height / 2);

  dragItem.classList.add('dragging');
  Bus.emit('dragStart');
};

Scanner.prototype._onMove = function (e) {
  if (!State.dragActive) return;
  e.preventDefault();

  var dragItem = this.scanContent.querySelector('.drag-item');
  if (!dragItem) return;

  var cr = this.scanContent.getBoundingClientRect();
  var hw = dragItem.offsetWidth  / 2;
  var hh = dragItem.offsetHeight / 2;

  var x = e.clientX - cr.left - State.dragOffsetX;
  var y = e.clientY - cr.top  - State.dragOffsetY;

  x = Math.max(hw, Math.min(cr.width  - hw, x));
  y = Math.max(hh, Math.min(cr.height - hh, y));

  State.itemX = x;
  State.itemY = y;

  dragItem.style.left = x + 'px';
  dragItem.style.top  = y + 'px';

  Bus.emit('dragMove');
};

Scanner.prototype._onUp = function () {
  if (!State.dragActive) return;
  State.dragActive = false;

  var dragItem = this.scanContent ? this.scanContent.querySelector('.drag-item') : null;
  if (dragItem) dragItem.classList.remove('dragging');

  Bus.emit('dragEnd');
};

Scanner.prototype.checkOverlap = function () {
  if (State.scanPhase !== 'itemSelected' && State.scanPhase !== 'scanning') return null;

  var dragItem = this.scanContent
    ? this.scanContent.querySelector('.drag-item')
    : null;
  if (!dragItem || !this.scannerDrop) return null;

  var sr = this.scannerDrop.getBoundingClientRect();
  var zones = dragItem.querySelectorAll('.bc-zone');

  for (var i = 0; i < zones.length; i++) {
    var zr = zones[i].getBoundingClientRect();
    if (zr.right  > sr.left  &&
        zr.left   < sr.right &&
        zr.bottom > sr.top   &&
        zr.top    < sr.bottom) {
      var idx  = parseInt(zones[i].dataset.idx, 10);
      var item = ITEMS[State.selectedItemId];
      if (item && item.barcodes[idx]) return item.barcodes[idx];
    }
  }
  return null;
};

POS.Scanner = Scanner;
})();
