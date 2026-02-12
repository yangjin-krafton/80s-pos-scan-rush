/* src/js/audio.js — SFX preloader & player (Web Audio API) */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

var SFX_FILES = [
  'scan_beep', 'scan_fail',
  'checkout_success', 'checkout_fail',
  'combo_up', 'item_bag', 'item_pickup',
  'ui_click', 'warning',
];

function AudioManager() {
  this.ctx = null;
  this.buffers = {};
  this.unlocked = false;
  this.muted = false;
}

AudioManager.prototype.init = function () {
  var self = this;
  this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  var promises = SFX_FILES.map(function (name) {
    return self._load(name, 'assets/sfx/' + name + '.m4a');
  });
  return Promise.allSettled
    ? Promise.allSettled(promises)
    : Promise.all(promises.map(function (p) { return p.catch(function () {}); }));
};

AudioManager.prototype._load = function (name, url) {
  var self = this;
  return fetch(url)
    .then(function (r) { return r.arrayBuffer(); })
    .then(function (buf) { return self.ctx.decodeAudioData(buf); })
    .then(function (decoded) { self.buffers[name] = decoded; })
    .catch(function (e) { console.warn('[audio] failed to load ' + name + ':', e); });
};

AudioManager.prototype.play = function (name, volume) {
  if (this.muted) return;
  var buf = this.buffers[name];
  if (!buf || !this.ctx) return;
  var src  = this.ctx.createBufferSource();
  var gain = this.ctx.createGain();
  src.buffer = buf;
  gain.gain.value = (volume !== undefined) ? volume : 1.0;
  src.connect(gain).connect(this.ctx.destination);
  src.start(0);
};

AudioManager.prototype.unlock = function () {
  if (this.unlocked || !this.ctx) return;
  if (this.ctx.state === 'suspended') this.ctx.resume();
  var buf = this.ctx.createBuffer(1, 1, 22050);
  var src = this.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(this.ctx.destination);
  src.start(0);
  this.unlocked = true;
};

POS.AudioManager = AudioManager;
})();
