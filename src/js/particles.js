/* src/js/particles.js — WebGL2 particle system (weather + seasonal FX) */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

var KIND = {
  rain: 0,
  snow: 1,
  blossom: 2,
  maple: 3,
};

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ParticleSystem(canvas, opts) {
  opts = opts || {};
  this.canvas = canvas;
  this.gl = canvas.getContext('webgl2', { antialias: false, alpha: true });
  this.maxParticles = opts.maxParticles || 2200;
  this.particles = [];
  this.emitters = [];
  this._data = new Float32Array(this.maxParticles * 9);
  this._initGL();
}

ParticleSystem.PRESETS = {
  rain: {
    rate: 240,
    area: { x: 0, y: -80, w: 360, h: 80 },
    size: [8, 16],
    life: [0.9, 1.4],
    speed: [420, 620],
    drift: [-30, 30],
    gravity: 20,
    spin: [0, 0],
    wind: 0,
    color: [
      [0.55, 0.75, 1.0, 0.85],
      [0.45, 0.65, 0.95, 0.65],
    ],
  },
  snow: {
    rate: 90,
    area: { x: 0, y: -80, w: 360, h: 80 },
    size: [1.5, 3.5],
    life: [3.6, 5.6],
    speed: [10, 32],
    drift: [-35, 35],
    gravity: 2.5,
    spin: [-0.6, 0.6],
    wind: 3,
    color: [
      [1.0, 1.0, 1.0, 0.9],
      [0.9, 0.95, 1.0, 0.7],
    ],
  },
  blossom: {
    rate: 10,
    area: { x: 0, y: -90, w: 360, h: 90 },
    size: [4, 9],
    life: [2.4, 3.4],
    speed: [30, 70],
    drift: [-60, 60],
    gravity: 5,
    spin: [-3.0, 3.0],
    wind: -18,
    color: [
      [1.0, 0.72, 0.86, 0.85],
      [1.0, 0.80, 0.92, 0.7],
      [0.98, 0.66, 0.82, 0.8],
    ],
  },
  maple: {
    rate: 7,
    area: { x: 0, y: -80, w: 360, h: 80 },
    size: [6, 10],
    life: [1.8, 2.6],
    speed: [36, 66],
    drift: [-80, 80],
    gravity: 2,
    spin: [-7.0, 7.0],
    wind: 0,
    color: [
      [1.0, 0.52, 0.16, 0.9],
      [0.98, 0.72, 0.22, 0.9],
      [0.86, 0.36, 0.12, 0.9],
      [0.75, 0.22, 0.12, 0.9],
    ],
  },
};

ParticleSystem.prototype._initGL = function () {
  var gl = this.gl;
  if (!gl) { this.disabled = true; return; }

  var vsSrc = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 a_pos;',
    'in vec4 a_col;',
    'in float a_size;',
    'in float a_kind;',
    'in float a_rot;',
    'uniform vec2 u_res;',
    'out vec4 v_col;',
    'out float v_kind;',
    'out float v_rot;',
    'void main(){',
    '  vec2 p = a_pos / u_res * 2.0 - 1.0;',
    '  p.y = -p.y;',
    '  gl_Position = vec4(p, 0.0, 1.0);',
    '  gl_PointSize = a_size;',
    '  v_col = a_col;',
    '  v_kind = a_kind;',
    '  v_rot = a_rot;',
    '}',
  ].join('\n');

  var fsSrc = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 v_col;',
    'in float v_kind;',
    'in float v_rot;',
    'out vec4 outColor;',
    'float lineShape(vec2 uv){',
    '  float x = abs(uv.x);',
    '  float y = abs(uv.y);',
    '  float body = smoothstep(0.28, 0.06, x);',
    '  float tip = smoothstep(1.0, 0.75, y);',
    '  return body * (1.0 - tip);',
    '}',
    'float circleShape(vec2 uv){',
    '  float r = length(uv);',
    '  return smoothstep(1.0, 0.7, 1.0 - r);',
    '}',
    'float diamondShape(vec2 uv){',
    '  float d = abs(uv.x) + abs(uv.y);',
    '  return smoothstep(1.0, 0.65, 1.0 - d);',
    '}',
    'float squareShape(vec2 uv){',
    '  float d = max(abs(uv.x), abs(uv.y));',
    '  return smoothstep(1.0, 0.8, 1.0 - d);',
    '}',
    'void main(){',
    '  vec2 uv = gl_PointCoord * 2.0 - 1.0;',
    '  float c = cos(v_rot);',
    '  float s = sin(v_rot);',
    '  vec2 ruv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);',
    '  float a;',
    '  if (v_kind < 0.5) {',
    '    a = lineShape(uv);',
    '  } else if (v_kind < 1.5) {',
    '    a = circleShape(uv);',
    '  } else if (v_kind < 2.5) {',
    '    a = diamondShape(ruv);',
    '  } else {',
    '    a = squareShape(ruv);',
    '  }',
    '  if (a <= 0.01) discard;',
    '  outColor = vec4(v_col.rgb, v_col.a * a);',
    '}',
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[particles] shader compile failed:', gl.getShaderInfoLog(s));
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
    console.warn('[particles] shader link failed:', gl.getProgramInfoLog(prog));
    this.disabled = true; return;
  }

  this.prog = prog;
  this.aPos = gl.getAttribLocation(prog, 'a_pos');
  this.aCol = gl.getAttribLocation(prog, 'a_col');
  this.aSize = gl.getAttribLocation(prog, 'a_size');
  this.aKind = gl.getAttribLocation(prog, 'a_kind');
  this.aRot = gl.getAttribLocation(prog, 'a_rot');
  this.uRes = gl.getUniformLocation(prog, 'u_res');

  this.buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);

  gl.useProgram(this.prog);
  gl.enableVertexAttribArray(this.aPos);
  gl.enableVertexAttribArray(this.aCol);
  gl.enableVertexAttribArray(this.aSize);
  gl.enableVertexAttribArray(this.aKind);
  gl.enableVertexAttribArray(this.aRot);

  var stride = 9 * 4;
  gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(this.aCol, 4, gl.FLOAT, false, stride, 2 * 4);
  gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, stride, 6 * 4);
  gl.vertexAttribPointer(this.aKind, 1, gl.FLOAT, false, stride, 7 * 4);
  gl.vertexAttribPointer(this.aRot, 1, gl.FLOAT, false, stride, 8 * 4);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
};

ParticleSystem.prototype.resize = function (w, h) {
  if (this.disabled) return;
  this.canvas.width = w;
  this.canvas.height = h;
  this.gl.viewport(0, 0, w, h);
};

ParticleSystem.prototype.addEmitter = function (type, opts) {
  var preset = ParticleSystem.PRESETS[type] || ParticleSystem.PRESETS.rain;
  opts = opts || {};
  var area = opts.area || preset.area;
  var emitter = {
    id: this.emitters.length,
    type: type,
    kind: KIND[type] != null ? KIND[type] : 0,
    rate: (opts.rate != null) ? opts.rate : preset.rate,
    area: { x: area.x, y: area.y, w: area.w, h: area.h },
    size: opts.size || preset.size,
    life: opts.life || preset.life,
    speed: opts.speed || preset.speed,
    drift: opts.drift || preset.drift,
    gravity: (opts.gravity != null) ? opts.gravity : preset.gravity,
    spin: opts.spin || preset.spin,
    wind: (opts.wind != null) ? opts.wind : preset.wind,
    color: opts.color || preset.color,
    enabled: (opts.enabled !== false),
    _emitRemainder: 0,
  };
  this.emitters.push(emitter);
  return emitter;
};

ParticleSystem.prototype.setEmitterEnabled = function (id, enabled) {
  var e = this.emitters[id];
  if (e) e.enabled = !!enabled;
};

ParticleSystem.prototype.clear = function () {
  this.particles.length = 0;
};

ParticleSystem.prototype._spawnFromEmitters = function (dt) {
  for (var i = 0; i < this.emitters.length; i++) {
    var e = this.emitters[i];
    if (!e.enabled) continue;
    var want = e.rate * dt + e._emitRemainder;
    var count = Math.floor(want);
    e._emitRemainder = want - count;
    for (var j = 0; j < count; j++) {
      if (this.particles.length >= this.maxParticles) return;
      this._spawnParticle(e);
    }
  }
};

ParticleSystem.prototype._spawnParticle = function (e) {
  var x = e.area.x + Math.random() * e.area.w;
  var y = e.area.y + Math.random() * e.area.h;
  var speed = randRange(e.speed[0], e.speed[1]);
  var drift = randRange(e.drift[0], e.drift[1]) + e.wind;
  var life = randRange(e.life[0], e.life[1]);
  var size = randRange(e.size[0], e.size[1]);
  var spin = randRange(e.spin[0], e.spin[1]);
  var col = pick(e.color);
  var p = {
    x: x,
    y: y,
    vx: drift,
    vy: speed,
    life: life,
    ttl: life,
    size: size,
    kind: e.kind,
    rot: Math.random() * Math.PI * 2,
    spin: spin,
    r: col[0],
    g: col[1],
    b: col[2],
    a: col[3],
    gravity: e.gravity,
  };

  if (e.kind === KIND.maple) {
    p.zigPhase = Math.random() * Math.PI * 2;
    p.zigAmp = randRange(10, 24);
    p.zigFreq = randRange(2.0, 3.4);
  }

  if (e.kind === KIND.snow) {
    p.loopPhase = Math.random() * Math.PI * 2;
    p.loopAmpX = randRange(16, 28);
    p.loopAmpY = randRange(10, 18);
    p.loopFreq = randRange(1.4, 2.2);
  }

  this.particles.push(p);
};

ParticleSystem.prototype.update = function (dt) {
  if (this.disabled) return;
  var gl = this.gl;
  var w = this.canvas.width;
  var h = this.canvas.height;
  if (!w || !h) return;

  if (dt > 0.05) dt = 0.05;
  this._spawnFromEmitters(dt);

  var out = this._data;
  var write = 0;

  for (var i = this.particles.length - 1; i >= 0; i--) {
    var p = this.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      this.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    if (p.kind === KIND.maple) {
      p.zigPhase += p.zigFreq * dt;
      p.x += Math.sin(p.zigPhase) * p.zigAmp * dt;
      p.rot += 1.6 * dt;
    }
    if (p.kind === KIND.snow) {
      p.loopPhase += p.loopFreq * dt;
      p.x += Math.sin(p.loopPhase) * p.loopAmpX * dt;
      p.y += Math.sin(p.loopPhase * 2.0) * p.loopAmpY * dt;
      p.rot += 0.5 * dt;
    }

    if (p.y > h + 80 || p.x < -80 || p.x > w + 80) {
      this.particles.splice(i, 1);
      continue;
    }

    var t = p.life / p.ttl;
    var fade = t < 0.25 ? (t / 0.25) : 1.0;

    out[write++] = p.x;
    out[write++] = p.y;
    out[write++] = p.r;
    out[write++] = p.g;
    out[write++] = p.b;
    out[write++] = p.a * fade;
    out[write++] = p.size;
    out[write++] = p.kind;
    out[write++] = p.rot;
  }

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (write === 0) return;

  gl.useProgram(this.prog);
  gl.uniform2f(this.uRes, w, h);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.bufferData(gl.ARRAY_BUFFER, out.subarray(0, write), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.POINTS, 0, write / 9);
};

POS.ParticleSystem = ParticleSystem;
POS.ParticleSystemKinds = KIND;
})();
