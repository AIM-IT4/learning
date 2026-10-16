// Deterministic WebGL2 renderer: every frame is a pure function of t.
'use strict';
const W = 1920, H = 1080;                 // output / typography resolution
const RS = +(new URLSearchParams(location.search).get('rs') || 0.6667);  // GL render scale (CPU-only GPU)
const GW = Math.round(W * RS), GH = Math.round(H * RS);
const glc = document.getElementById('gl');
glc.width = GW; glc.height = GH;
const gl = glc.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
const HDR = !!gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');

const GLSL_COMMON = `
#define PI 3.14159265359
#define TAU 6.28318530718
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float hash31(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
vec3 hash33(vec3 p3){p3=fract(p3*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yxx)*p3.zyx);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm2(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise2(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}return s;}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
float fbm3l(vec3 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/.875;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float ss(float a,float b,float x){return smoothstep(a,b,x);}
float win(float a,float b,float c,float d,float x){return smoothstep(a,b,x)*(1.-smoothstep(c,d,x));}
vec3 camRay(vec2 uv, vec3 ro, vec3 ta, float fl){vec3 f=normalize(ta-ro);vec3 r=normalize(cross(f,vec3(0,1,0)));vec3 u=cross(r,f);return normalize(uv.x*r+uv.y*u+fl*f);}
vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);return v*mix(vec3(1),k,s);}
`;

const FS_HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime;
in vec2 vUv; out vec4 fragColor;
` + GLSL_COMMON;

const VS_FULL = `#version 300 es
in vec2 aPos; out vec2 vUv; void main(){ vUv=aPos*.5+.5; gl_Position=vec4(aPos,0,1); }`;

// Vertex header for point/line clouds projected with the same pinhole camera as camRay().
const VS_HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uRo; uniform vec3 uTa; uniform float uFl;
` + GLSL_COMMON + `
vec4 project(vec3 p, out float z){
  vec3 f=normalize(uTa-uRo); vec3 r=normalize(cross(f,vec3(0,1,0))); vec3 u=cross(r,f);
  vec3 v=p-uRo; z=dot(v,f);
  vec2 q=vec2(dot(v,r),dot(v,u))*uFl/max(z,1e-3);
  float asp=uRes.x/uRes.y;
  if(z<0.05) return vec4(0,0,2,1);
  return vec4(q.x/(.5*asp), q.y/.5, 0., 1.);
}`;

const FS_POINT = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; out vec4 fragColor;
void main(){ vec2 d=gl_PointCoord-.5; float r=length(d)*2.; float a=exp(-r*r*4.)+.25*exp(-r*r*.9); if(r>1.) discard; fragColor=vec4(vCol*a*vA,1.); }`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
    throw new Error('Shader compile error:\n' + log + '\n' + numbered.slice(0, 20000));
  }
  return s;
}

function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  const locs = {};
  p.loc = (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(p, n)));
  return p;
}

function fsProgram(body) { return program(VS_FULL, FS_HEAD + body); }

function setU(p, u) {
  let unit = 0;
  for (const k in u) {
    const loc = p.loc(k); if (loc === null) continue;
    const v = u[k];
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (v && v.tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(loc, unit); unit++; }
    else if (v && v.i !== undefined) gl.uniform1i(loc, v.i);
    else if (v.length === 2) gl.uniform2fv(loc, v);
    else if (v.length === 3) gl.uniform3fv(loc, v);
    else if (v.length === 4) gl.uniform4fv(loc, v);
    else gl.uniform1fv(loc, v);
  }
}

// fullscreen triangle
const fsVAO = gl.createVertexArray();
gl.bindVertexArray(fsVAO);
const fsBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

function drawFS(p, u) {
  gl.useProgram(p);
  setU(p, Object.assign({ uRes: [curTarget.w, curTarget.h] }, u));
  gl.bindVertexArray(fsVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function makeTarget(w, h, mip) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const levels = mip ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, HDR ? gl.RGBA16F : gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fb, tex, w, h };
}
const SCREEN = { fb: null, w: GW, h: GH };
let curTarget = SCREEN;
function bindTarget(t) { curTarget = t; gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }

// Point/line clouds: attrs = {name: {data: Float32Array, size}}
const FS_LINE = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; out vec4 fragColor;
void main(){ fragColor=vec4(vCol*vA,1.); }`;

function makeCloud(vsBody, attrs, count, mode) {
  const p = program(VS_HEAD + vsBody, mode === undefined || mode === gl.POINTS ? FS_POINT : FS_LINE);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const name in attrs) {
    const loc = gl.getAttribLocation(p, name);
    if (loc < 0) continue;
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, attrs[name].data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, attrs[name].size, gl.FLOAT, false, 0, 0);
  }
  gl.bindVertexArray(null);
  return {
    draw(u) {
      gl.useProgram(p);
      setU(p, Object.assign({ uRes: [curTarget.w, curTarget.h] }, u));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(vao);
      gl.drawArrays(mode === undefined ? gl.POINTS : mode, 0, count);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    }
  };
}

// deterministic PRNG for building geometry
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// easing helpers (JS side)
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = (x) => { x = clamp01(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x) => Math.pow(clamp01(x), 3);
