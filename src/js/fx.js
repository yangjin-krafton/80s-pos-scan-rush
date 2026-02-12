/* src/js/fx.js — WebGL2 pixel particle effects */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

function CheckoutFX(canvas) {
  this.canvas = canvas;
  this.gl = canvas.getContext('webgl2', { antialias: false, alpha: true });
  this.maxParticles = 600;
  this.particles = [];
  this._initGL();
}

CheckoutFX.prototype._initGL = function () {
  var gl = this.gl;
  if (!gl) { this.disabled = true; return; }

  var vsSrc = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 a_pos;',
    'in vec4 a_col;',
    'in float a_size;',
    'uniform vec2 u_res;',
    'out vec4 v_col;',
    'void main(){',
    '  vec2 p = a_pos / u_res * 2.0 - 1.0;',
    '  p.y = -p.y;',
    '  gl_Position = vec4(p, 0.0, 1.0);',
    '  gl_PointSize = a_size;',
    '  v_col = a_col;',
    '}',
  ].join('\n');

  var fsSrc = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 v_col;',
    'out vec4 outColor;',
    'void main(){',
    '  outColor = v_col;',
    '}',
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[fx] shader compile failed:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, vsSrc);
  var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) { this.disabled = true; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[fx] shader link failed:', gl.getProgramInfoLog(prog));
    this.disabled = true; return;
  }

  this.prog = prog;
  this.aPos = gl.getAttribLocation(prog, 'a_pos');
  this.aCol = gl.getAttribLocation(prog, 'a_col');
  this.aSize = gl.getAttribLocation(prog, 'a_size');
  this.uRes = gl.getUniformLocation(prog, 'u_res');

  this.buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);

  gl.useProgram(this.prog);
  gl.enableVertexAttribArray(this.aPos);
  gl.enableVertexAttribArray(this.aCol);
  gl.enableVertexAttribArray(this.aSize);

  var stride = (2 + 4 + 1) * 4;
  gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(this.aCol, 4, gl.FLOAT, false, stride, 2 * 4);
  gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, stride, (2 + 4) * 4);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
}

CheckoutFX.prototype.resize = function (w, h) {
  if (this.disabled) return;
  this.canvas.width = w;
  this.canvas.height = h;
  this.gl.viewport(0, 0, w, h);
};

CheckoutFX.prototype.spawn = function (x, y, type) {
  if (this.disabled) return;
  var count = type === 'fail' ? 220 : 320;
  var base = type === 'fail'
    ? [1.0, 0.25, 0.2]
    : [1.0, 0.85, 0.25];
  var accent = type === 'fail'
    ? [0.9, 0.0, 0.1]
    : [0.3, 1.0, 0.5];

  for (var i = 0; i < count; i++) {
    if (this.particles.length >= this.maxParticles) break;
    var a = Math.random() * Math.PI * 2;
    var s = (type === 'fail' ? 90 : 120) * (0.3 + Math.random() * 0.7);
    var vx = Math.cos(a) * s;
    var vy = Math.sin(a) * s - (type === 'fail' ? 10 : 30);
    var life = type === 'fail' ? 0.55 : 0.75;
    var size = type === 'fail' ? 3 + Math.random() * 4 : 4 + Math.random() * 6;

    var mix = Math.random();
    var r = base[0] * (1 - mix) + accent[0] * mix;
    var g = base[1] * (1 - mix) + accent[1] * mix;
    var b = base[2] * (1 - mix) + accent[2] * mix;

    this.particles.push({
      x: x, y: y,
      vx: vx, vy: vy,
      life: life, ttl: life,
      size: size,
      r: r, g: g, b: b,
    });
  }
};

CheckoutFX.prototype.update = function (dt) {
  if (this.disabled) return;
  var gl = this.gl;
  var w = this.canvas.width;
  var h = this.canvas.height;
  if (!w || !h) return;

  var out = new Float32Array(this.particles.length * 7);
  var write = 0;

  for (var i = this.particles.length - 1; i >= 0; i--) {
    var p = this.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      this.particles.splice(i, 1);
      continue;
    }
    p.vy += 120 * dt; /* gravity */
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    var a = Math.max(0, p.life / p.ttl);
    out[write++] = p.x;
    out[write++] = p.y;
    out[write++] = p.r;
    out[write++] = p.g;
    out[write++] = p.b;
    out[write++] = a;
    out[write++] = p.size;
  }

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (write === 0) return;

  gl.useProgram(this.prog);
  gl.uniform2f(this.uRes, w, h);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.bufferData(gl.ARRAY_BUFFER, out.subarray(0, write), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.POINTS, 0, write / 7);
};

POS.CheckoutFX = CheckoutFX;
})();
