/* src/js/main.js — Entry point, game loop, viewport scaling */
(function () {
'use strict';
var POS = window.POS;

var audio    = new POS.AudioManager();
var scanner  = new POS.Scanner();
var game     = new POS.Game(audio, scanner);
var ui       = new POS.UI();
var tutorial = new POS.Tutorial();
POS.scanner = scanner;
POS.audio   = audio;

/* ---- viewport ---- */
function fitViewport() {
  var g = document.querySelector('.game');
  if (!g) return;
  var s = Math.min(window.innerWidth / 360, window.innerHeight / 640);
  g.style.transform = 'scale(' + s + ')';
}

/* ---- audio unlock ---- */
function unlockAudio() {
  audio.unlock();
  document.removeEventListener('pointerdown', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}

/* ---- BGM register by adaptive difficulty ---- */
function bgmRegisterForRound() {
  var dr = POS.State.diffRating;
  if (dr < 2) return 'low';
  if (dr < 5) return 'mid';
  return 'high';
}

/* ---- game loop ---- */
var lastTime = 0;
function loop(now) {
  var dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  game.update(dt);
  ui.update(dt);
  requestAnimationFrame(loop);
}

/* ---- loading screen helpers ---- */
var loadEl   = null;
var loadFill = null;
var loadLog  = null;
var loadMsg  = null;

function loadSet(pct, msg) {
  if (loadFill) loadFill.style.width = pct + '%';
  if (loadMsg)  loadMsg.textContent = msg;
}
function loadLine(text) {
  if (!loadLog) return;
  loadLog.textContent += text + '\n';
  loadLog.scrollTop = loadLog.scrollHeight;
}
function loadDone() {
  if (loadEl) loadEl.classList.add('done');
  setTimeout(function () { if (loadEl) loadEl.style.display = 'none'; }, 700);
}

/* ---- settings panel ---- */
function initSettings() {
  var btn   = document.getElementById('settings-btn');
  var panel = document.getElementById('settings-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });

  /* Close when clicking outside */
  document.addEventListener('pointerdown', function (e) {
    if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });

  var sliderBgm = document.getElementById('vol-bgm');
  var sliderSfx = document.getElementById('vol-sfx');
  var sliderTts = document.getElementById('vol-tts');
  var valBgm    = document.getElementById('vol-bgm-val');
  var valSfx    = document.getElementById('vol-sfx-val');
  var valTts    = document.getElementById('vol-tts-val');

  /* Set initial slider positions from audio defaults */
  if (sliderBgm) { sliderBgm.value = Math.round(audio.bgmVolume * 100); valBgm.textContent = sliderBgm.value; }
  if (sliderSfx) { sliderSfx.value = Math.round(audio.sfxVolume * 100); valSfx.textContent = sliderSfx.value; }
  if (sliderTts) { sliderTts.value = Math.round(audio.ttsVolume * 100); valTts.textContent = sliderTts.value; }

  if (sliderBgm) sliderBgm.addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    valBgm.textContent = v;
    audio.setBgmVolume(v / 100);
  });

  if (sliderSfx) sliderSfx.addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    valSfx.textContent = v;
    audio.sfxVolume = v / 100;
  });

  if (sliderTts) sliderTts.addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    valTts.textContent = v;
    audio.ttsVolume = v / 100;
  });
}

/* ---- boot ---- */
function boot() {
  fitViewport();
  window.addEventListener('resize', fitViewport);

  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  loadEl   = document.getElementById('loading');
  loadFill = document.getElementById('load-fill');
  loadLog  = document.getElementById('load-log');
  loadMsg  = document.getElementById('load-msg');

  loadSet(5, 'INITIALIZING...');
  loadLine('C:\\POS> init audio.sys');

  audio.init().catch(function (e) { console.warn('[audio] init failed:', e); });

  loadSet(15, 'INITIALIZING...');
  loadLine('C:\\POS> init ui.drv');

  ui.init();
  game.init();
  tutorial.init();
  initSettings();

  loadSet(25, 'LOADING DATA...');
  loadLine('C:\\POS> load products.csv');
  loadLine('C:\\POS> load npcs.json');
  loadLine('C:\\POS> load encouragements.json');

  /* Async data load → then start game */
  POS.Loader.load().then(function () {
    loadSet(80, 'GENERATING ROUNDS...');
    loadLine('OK - ' + POS.ROUNDS.length + ' rounds generated');
    loadLine('OK - ' + Object.keys(POS.ITEMS).length + ' items loaded');

    var scanContent = document.querySelector('.scan-content');
    if (scanContent) scanner.bind(scanContent);

    POS.Bus.on('startClick', function () {
      audio.unlock();
      audio.bgmStart('low');
      game.startGame();
    });

    POS.Bus.on('retryClick', function () {
      POS.Loader.regenerate();
      audio.bgmStart('low');
      game.startGame();
    });

    /* Escalate BGM register as rounds progress */
    POS.Bus.on('roundStart', function () {
      audio.bgmSetRegister(bgmRegisterForRound());
    });

    /* Stop BGM on game over / clear */
    POS.Bus.on('gameOver',  function () { audio.bgmStop(1.0); });
    POS.Bus.on('gameClear', function () { audio.bgmStop(1.5); });

    loadSet(100, 'READY!');
    loadLine('C:\\POS> READY.');

    setTimeout(function () {
      loadDone();
      ui.showTitle();
    }, 500);

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }).catch(function (e) {
    console.error('[loader] Failed to load data:', e);
    loadLine('ERR - ' + e.message);
    loadSet(100, 'READY (fallback)');

    var scanContent = document.querySelector('.scan-content');
    if (scanContent) scanner.bind(scanContent);

    POS.Bus.on('startClick', function () { audio.unlock(); game.startGame(); });
    POS.Bus.on('retryClick', function () { game.startGame(); });

    setTimeout(function () {
      loadDone();
      ui.showTitle();
    }, 500);

    lastTime = performance.now();
    requestAnimationFrame(loop);
  });
}

document.addEventListener('DOMContentLoaded', boot);

/* ---- Debug console commands ---- */
POS.debug = {
  /** POS.debug.setDifficulty(10) — set diffRating and regenerate next round */
  setDifficulty: function (dr) {
    var State = POS.State;
    State.diffRating = dr;

    /* Rebuild upcoming rounds from current position */
    var keep = State.round + 1;
    POS.ROUNDS.length = keep;
    POS.Loader._nextRoundIndex = keep;
    POS.Loader._appendRounds(3);

    /* Log active metas for the new difficulty */
    var next = POS.ROUNDS[keep];
    var metas = next ? next.metas : {};
    var keys = Object.keys(metas);
    console.log(
      '%c[debug] diffRating = ' + dr + '  |  tier = ' + (1 + Math.floor(dr)),
      'color:#0ff;font-weight:bold'
    );
    if (keys.length) {
      console.log('%c[debug] Active metas for next round:', 'color:#0ff');
      keys.forEach(function (k) { console.log('  ' + k + ':', JSON.stringify(metas[k])); });
    } else {
      console.log('%c[debug] No metas at this difficulty', 'color:#888');
    }
    console.log('%c[debug] Next round regenerated. Finish current round to see changes.', 'color:#0ff');
  },

  /** POS.debug.trigger('posBlackout') — force-fire a runtime meta immediately */
  trigger: function (metaName) {
    var State = POS.State;
    if (State.phase !== 'playing') {
      console.warn('[debug] Can only trigger metas during playing phase');
      return;
    }
    switch (metaName) {
      case 'posBlackout':
        State.posBlackoutScheduled = true;
        State.posBlackoutScheduleTimer = 0.5;
        /* Ensure round has blackout duration params */
        var round = POS.ROUNDS[State.round];
        if (round && (!round.metas || !round.metas.posBlackout)) {
          if (!round.metas) round.metas = {};
          round.metas.posBlackout = { chance: 1, delay: [1,1], duration: [3, 5] };
        }
        console.log('%c[debug] posBlackout will fire in 0.5s', 'color:#f0f');
        break;
      case 'midAdd':
        State.midAddScheduled = true;
        State.midAddFired = false;
        State.midAddTimer = 0.5;
        var rA = POS.ROUNDS[State.round];
        if (rA && (!rA.metas || !rA.metas.midAdd)) {
          if (!rA.metas) rA.metas = {};
          rA.metas.midAdd = { chance: 1, count: 2, delay: [1,1] };
        }
        console.log('%c[debug] midAdd will fire in 0.5s', 'color:#f0f');
        break;
      case 'midCancel':
        State.midCancelScheduled = true;
        State.midCancelFired = false;
        State.midCancelTimer = 0.5;
        var rC = POS.ROUNDS[State.round];
        if (rC && (!rC.metas || !rC.metas.midCancel)) {
          if (!rC.metas) rC.metas = {};
          rC.metas.midCancel = { chance: 1, count: 1, delay: [1,1] };
        }
        console.log('%c[debug] midCancel will fire in 0.5s', 'color:#f0f');
        break;
      default:
        console.warn('[debug] Unknown runtime meta: ' + metaName);
        console.log('[debug] Available: posBlackout, midAdd, midCancel');
    }
  },

  /** POS.debug.status() — show current game state */
  status: function () {
    var State = POS.State;
    var round = POS.ROUNDS[State.round];
    var metas = round ? round.metas : {};
    console.log('%c══════ DEBUG STATUS ══════', 'color:#ff0;font-weight:bold');
    console.log('  phase:       ', State.phase);
    console.log('  round:       ', State.round + 1);
    console.log('  diffRating:  ', State.diffRating.toFixed(2));
    console.log('  satisfaction:', State.satisfaction);
    console.log('  score:       ', State.score);
    console.log('  posItems:    ', State.posItems.length);
    if (round && State.currentNpc) {
      var dr = State.currentNpc.drainRate;
      var timeBudget = (POS.PARAMS.maxSatisfaction / dr).toFixed(1);
      console.log('  drainRate:   ', dr.toFixed(3), '(' + timeBudget + 's budget)');
    }
    console.log('%c── Round Metas ──', 'color:#ff0');
    var keys = Object.keys(metas || {});
    if (keys.length) {
      keys.forEach(function (k) { console.log('  ' + k + ':', JSON.stringify(metas[k])); });
    } else {
      console.log('  (none)');
    }
    console.log('%c── Meta Event State ──', 'color:#ff0');
    console.log('  blackout:', State.posBlackout, '| scheduled:', State.posBlackoutScheduled);
    console.log('  midAdd:   fired:', State.midAddFired, '| scheduled:', State.midAddScheduled);
    console.log('  midCancel: fired:', State.midCancelFired, '| scheduled:', State.midCancelScheduled);
    console.log('%c═════════════════════════', 'color:#ff0;font-weight:bold');
  },

  /** POS.debug.god() — toggle god mode (infinite satisfaction) */
  god: function () {
    var State = POS.State;
    State.godMode = !State.godMode;
    if (State.godMode) {
      State.satisfaction = 100;
      console.log('%c[debug] GOD MODE ON — satisfaction drain disabled', 'color:#ff0;font-weight:bold;font-size:14px');
    } else {
      console.log('%c[debug] GOD MODE OFF', 'color:#888');
    }
  },

  /** POS.debug.help() — list available commands */
  help: function () {
    console.log('%c══════ POS DEBUG COMMANDS ══════', 'color:#0f0;font-weight:bold');
    console.log('  POS.debug.setDifficulty(n)     Set diffRating (metas unlock: 4,5,6,7,8,9)');
    console.log('  POS.debug.trigger(name)        Force-fire runtime meta (posBlackout/midAdd/midCancel)');
    console.log('  POS.debug.god()                Toggle god mode (no satisfaction drain)');
    console.log('  POS.debug.status()             Show current game state & active metas');
    console.log('  POS.debug.help()               This help');
    console.log('%c════════════════════════════════', 'color:#0f0;font-weight:bold');
  },
};

})();
