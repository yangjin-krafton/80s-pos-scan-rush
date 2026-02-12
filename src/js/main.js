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

/* ---- BGM register by round ---- */
function bgmRegisterForRound(roundIdx) {
  if (roundIdx < 3) return 'low';
  if (roundIdx < 7) return 'mid';
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

  loadSet(25, 'LOADING DATA...');
  loadLine('C:\\POS> load products.csv');
  loadLine('C:\\POS> load npcs.json');

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
    POS.Bus.on('roundStart', function (roundIdx) {
      audio.bgmSetRegister(bgmRegisterForRound(roundIdx));
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
})();
