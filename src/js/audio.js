/* src/js/audio.js — SFX preloader & player + BGM mixer (Web Audio API) */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

var SFX_FILES = [
  'scan_beep', 'scan_fail',
  'checkout_success', 'checkout_fail',
  'combo_up', 'item_bag', 'item_pickup',
  'ui_click', 'warning',
];

/* ---- BGM configuration ---- */
var BGM_INSTRUMENTS = ['bass', 'pad', 'lead'];
var BGM_REGISTERS   = ['low', 'mid', 'high'];
var BGM_VARIANTS    = ['01', '02', '03'];
var BGM_VOLUMES     = { bass: 0.55, pad: 0.45, lead: 0.40 };
var BGM_FADE_IN     = 0.8;
var BGM_FADE_OUT    = 0.8;
var BGM_CROSSFADE   = 1.2;

function AudioManager() {
  this.ctx = null;
  this.buffers = {};
  this.unlocked = false;
  this.muted = false;

  /* Volume levels (0-1) */
  this.sfxVolume = 0.8;
  this.bgmVolume = 0.5;
  this.ttsVolume = 0.8;

  /* BGM state */
  this._bgmBuffers  = {};
  this._bgmSources  = {};
  this._bgmGains    = {};
  this._bgmPlaying  = false;
  this._bgmRegister = null;
}

/* ---- SFX init ---- */

AudioManager.prototype.init = function () {
  var self = this;
  this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  var promises = SFX_FILES.map(function (name) {
    return self._load(name, 'assets/sfx/' + name + '.m4a');
  });

  /* Preload BGM files in background (non-blocking) */
  this._bgmPreload();

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

/* ---- SFX play ---- */

AudioManager.prototype.play = function (name, volume) {
  if (this.muted) return;
  var buf = this.buffers[name];
  if (!buf || !this.ctx) return;
  var src  = this.ctx.createBufferSource();
  var gain = this.ctx.createGain();
  src.buffer = buf;
  var base = (volume !== undefined) ? volume : 1.0;
  gain.gain.value = base * this.sfxVolume;
  src.connect(gain).connect(this.ctx.destination);
  src.start(0);
};

/* ---- Audio unlock ---- */

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

/* ================================================================
   BGM — 3-layer looping mixer (bass + pad + lead)
   ================================================================ */

AudioManager.prototype._bgmFileName = function (inst, reg, variant) {
  return 'bgm_' + inst + '_' + reg + '_' + variant + '.m4a';
};

/* Preload all 27 BGM files in background */
AudioManager.prototype._bgmPreload = function () {
  var self = this;
  BGM_INSTRUMENTS.forEach(function (inst) {
    BGM_REGISTERS.forEach(function (reg) {
      BGM_VARIANTS.forEach(function (v) {
        var file = self._bgmFileName(inst, reg, v);
        self._bgmLoadBuffer(file);
      });
    });
  });
};

AudioManager.prototype._bgmLoadBuffer = function (filename) {
  var self = this;
  if (this._bgmBuffers[filename]) {
    return Promise.resolve(this._bgmBuffers[filename]);
  }
  return fetch('assets/bgm/' + filename)
    .then(function (r) { return r.arrayBuffer(); })
    .then(function (buf) { return self.ctx.decodeAudioData(buf); })
    .then(function (decoded) {
      self._bgmBuffers[filename] = decoded;
      return decoded;
    })
    .catch(function (e) {
      console.warn('[bgm] failed to load ' + filename + ':', e);
      return null;
    });
};

/* Pick random variant per instrument for a given register */
AudioManager.prototype._bgmRandomMix = function (register) {
  var mix = {};
  for (var i = 0; i < BGM_INSTRUMENTS.length; i++) {
    var inst = BGM_INSTRUMENTS[i];
    var variant = BGM_VARIANTS[Math.floor(Math.random() * BGM_VARIANTS.length)];
    mix[inst] = this._bgmFileName(inst, register, variant);
  }
  return mix;
};

/* Start a set of 3 instrument tracks with fade-in */
AudioManager.prototype._bgmStartTracks = function (mix, fadeIn) {
  var self = this;
  var t = this.ctx.currentTime;

  var promises = BGM_INSTRUMENTS.map(function (inst) {
    var filename = mix[inst];
    if (!filename) return Promise.resolve();

    return self._bgmLoadBuffer(filename).then(function (buffer) {
      if (!buffer) return;

      var source = self.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      var gain = self.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(BGM_VOLUMES[inst] * self.bgmVolume, t + fadeIn);

      source.connect(gain).connect(self.ctx.destination);
      source.start(0);

      self._bgmSources[inst] = source;
      self._bgmGains[inst] = gain;
    });
  });

  return Promise.all(promises);
};

/* Fade out and stop current tracks */
AudioManager.prototype._bgmStopTracks = function (fadeOut) {
  var t = this.ctx.currentTime;

  for (var i = 0; i < BGM_INSTRUMENTS.length; i++) {
    var inst = BGM_INSTRUMENTS[i];
    var gain   = this._bgmGains[inst];
    var source = this._bgmSources[inst];

    if (gain && source) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + fadeOut);
      /* Schedule stop after fade completes */
      (function (s) {
        setTimeout(function () { try { s.stop(); } catch (e) { /* ok */ } },
          (fadeOut + 0.1) * 1000);
      })(source);
    }

    this._bgmSources[inst] = null;
    this._bgmGains[inst] = null;
  }
};

/* ---- Public BGM API ---- */

/** Start BGM with a random mix at the given register */
AudioManager.prototype.bgmStart = function (register) {
  if (!this.ctx) return;
  this._bgmStopTracks(0.1);

  var reg = register || 'low';
  var mix = this._bgmRandomMix(reg);
  this._bgmRegister = reg;
  this._bgmPlaying = true;

  this._bgmStartTracks(mix, BGM_FADE_IN);
  console.log('[bgm] start:', reg, mix);
};

/** Stop BGM with fade-out */
AudioManager.prototype.bgmStop = function (fadeTime) {
  if (!this._bgmPlaying || !this.ctx) return;
  this._bgmStopTracks(fadeTime || BGM_FADE_OUT);
  this._bgmPlaying = false;
  this._bgmRegister = null;
  console.log('[bgm] stop');
};

/** Change register with crossfade (no-op if same register) */
AudioManager.prototype.bgmSetRegister = function (register) {
  if (!this._bgmPlaying || !this.ctx) return;
  if (register === this._bgmRegister) return;

  /* Fade out old tracks */
  this._bgmStopTracks(BGM_CROSSFADE);

  /* Start new tracks with fade-in (overlaps with old fade-out) */
  var mix = this._bgmRandomMix(register);
  this._bgmRegister = register;
  this._bgmStartTracks(mix, BGM_CROSSFADE);
  console.log('[bgm] register:', register, mix);
};

/* ================================================================
   TTS — Japanese product name readout (Web Speech API)
   ================================================================ */

AudioManager.prototype.speakJa = function (text) {
  if (this.muted || !text) return;
  var synth = window.speechSynthesis;
  if (!synth) return;

  /* Cancel any ongoing speech so they don't stack */
  synth.cancel();

  var utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 1.1;
  utter.pitch = 1.05;
  utter.volume = this.ttsVolume;
  synth.speak(utter);
};

/** Live-update BGM gain nodes when volume slider changes */
AudioManager.prototype.setBgmVolume = function (v) {
  this.bgmVolume = v;
  if (!this._bgmPlaying) return;
  var t = this.ctx.currentTime;
  for (var i = 0; i < BGM_INSTRUMENTS.length; i++) {
    var inst = BGM_INSTRUMENTS[i];
    var gain = this._bgmGains[inst];
    if (gain) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(BGM_VOLUMES[inst] * v, t + 0.15);
    }
  }
};

POS.AudioManager = AudioManager;
})();
