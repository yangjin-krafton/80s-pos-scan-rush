/* src/js/main.js — Entry point, game loop, viewport scaling */
(function () {
'use strict';
var POS = window.POS;

var audio   = new POS.AudioManager();
var scanner = new POS.Scanner();
var game    = new POS.Game(audio, scanner);
var ui      = new POS.UI();

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

  var scanContent = document.querySelector('.scan-content');
  if (scanContent) scanner.bind(scanContent);

  POS.Bus.on('startClick', function () { audio.unlock(); game.startGame(); });
  POS.Bus.on('retryClick', function () { game.startGame(); });

  ui.showTitle();

  lastTime = performance.now();
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', boot);
})();
