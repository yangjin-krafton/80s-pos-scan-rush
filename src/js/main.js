/* src/js/main.js — Entry point, game loop, viewport scaling */
(function () {
'use strict';
var POS = window.POS;

var audio   = new POS.AudioManager();
var scanner = new POS.Scanner();
var game    = new POS.Game(audio, scanner);
var ui      = new POS.UI();
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

/* ---- boot ---- */
function boot() {
  fitViewport();
  window.addEventListener('resize', fitViewport);

  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  audio.init().catch(function (e) { console.warn('[audio] init failed:', e); });

  ui.init();
  game.init();

  /* Async data load → then start game */
  POS.Loader.load().then(function () {
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

    ui.showTitle();

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }).catch(function (e) {
    console.error('[loader] Failed to load data:', e);
    var scanContent = document.querySelector('.scan-content');
    if (scanContent) scanner.bind(scanContent);

    POS.Bus.on('startClick', function () { audio.unlock(); game.startGame(); });
    POS.Bus.on('retryClick', function () { game.startGame(); });

    ui.showTitle();

    lastTime = performance.now();
    requestAnimationFrame(loop);
  });
}

document.addEventListener('DOMContentLoaded', boot);
})();
