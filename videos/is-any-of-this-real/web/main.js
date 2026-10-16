// Composition: scene targets → transition → post FX → 2D typography overlay
'use strict';
const TC = makeTarget(W, H, false);
const TGT = {};
function tgt(scale) { const k = scale.toFixed(3); if (!TGT[k]) TGT[k] = { A: makeTarget(Math.round(W * scale), Math.round(H * scale), false), B: makeTarget(Math.round(W * scale), Math.round(H * scale), false) }; return TGT[k]; }
const BL = [1, 2, 3, 4, 5].map((i) => makeTarget(W >> i, H >> i, false));
const downFS = fsProgram(`
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh;
void main(){
  vec2 uv=vUv; vec2 o=uTexel;
  vec3 c=(texture(uSrc,uv+o*vec2(-1,-1)).rgb+texture(uSrc,uv+o*vec2(1,-1)).rgb+texture(uSrc,uv+o*vec2(-1,1)).rgb+texture(uSrc,uv+o*vec2(1,1)).rgb)*.25;
  if(uThresh>0.){ float br=max(c.r,max(c.g,c.b)); float soft=clamp(br-uThresh*.6,0.,uThresh*.8); soft=soft*soft/(uThresh*3.2+1e-4); float k=max(soft,br-uThresh)/max(br,1e-4); c*=k; }
  fragColor=vec4(min(c,vec3(60.)),1);
}`);
const upFS = fsProgram(`
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uW;
void main(){
  vec2 uv=vUv; vec2 o=uTexel;
  vec3 c=texture(uSrc,uv).rgb*4.;
  c+=(texture(uSrc,uv+vec2(o.x,0)).rgb+texture(uSrc,uv-vec2(o.x,0)).rgb+texture(uSrc,uv+vec2(0,o.y)).rgb+texture(uSrc,uv-vec2(0,o.y)).rgb)*2.;
  c+=texture(uSrc,uv+o).rgb+texture(uSrc,uv-o).rgb+texture(uSrc,uv+vec2(o.x,-o.y)).rgb+texture(uSrc,uv+vec2(-o.x,o.y)).rgb;
  fragColor=vec4(c/16.*uW,1);
}`);
function bloomChain() {
  bindTarget(BL[0]); drawFS(downFS, { uSrc: { tex: TC.tex }, uTexel: [1 / W, 1 / H], uThresh: 0.9 });
  for (let i = 1; i < BL.length; i++) { bindTarget(BL[i]); drawFS(downFS, { uSrc: { tex: BL[i - 1].tex }, uTexel: [1 / BL[i - 1].w, 1 / BL[i - 1].h], uThresh: 0 }); }
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = BL.length - 2; i >= 0; i--) { bindTarget(BL[i]); drawFS(upFS, { uSrc: { tex: BL[i + 1].tex }, uTexel: [1 / BL[i + 1].w, 1 / BL[i + 1].h], uW: 1.0 }); }
  gl.disable(gl.BLEND);
}

const transFS = fsProgram(`
uniform sampler2D uA, uB; uniform float uP, uType;
vec3 A(vec2 uv){ return texture(uA,clamp(uv,0.,1.)).rgb; }
vec3 B(vec2 uv){ return texture(uB,clamp(uv,0.,1.)).rgb; }
float ease(float x){ return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.; }
void main(){
  vec2 uv=vUv; float p=uP; vec3 col;
  int ty=int(uType+.5);
  if(ty==1){ // zoom-through with radial blur
    float e=ease(p);
    vec2 c=uv-.5;
    vec3 a=vec3(0), b=vec3(0);
    for(int i=0;i<10;i++){
      float k=float(i)/10.;
      a+=A(.5+c/(1.+e*e*7.)*(1.-k*.06*e));
      b+=B(.5+c*(1.+(1.-e)*(1.-e)*2.5)*(1.-k*.05*(1.-e)));
    }
    a/=10.; b/=10.;
    col=mix(a,b,smoothstep(.35,.7,p))+vec3(.9,.95,1.)*exp(-pow((p-.52)*7.,2.))*.5;
  } else if(ty==2){ // digital glitch
    float s=floor(p*12.);
    vec2 blk=floor(uv*vec2(28.,16.));
    float r=hash21(blk+s*.37);
    float row=hash21(vec2(floor(uv.y*60.),s));
    float amt=sin(p*PI);
    vec2 o=vec2((row-.5)*.12*amt*step(.6,row),0.);
    vec3 a=vec3(A(uv+o+vec2(.006*amt,0)).r,A(uv+o).g,A(uv+o-vec2(.006*amt,0)).b);
    vec3 b=vec3(B(uv-o+vec2(.006*amt,0)).r,B(uv-o).g,B(uv-o-vec2(.006*amt,0)).b);
    col=mix(a,b,step(r,p*1.15-.05));
    col+=vec3(.2,.9,1.)*step(.985,hash21(blk*1.3+s))*amt;
  } else if(ty==3){ // vertical whip pan (camera tilts up)
    float e=ease(p); vec3 c=vec3(0);
    for(int i=0;i<12;i++){
      float k=(float(i)/11.-.5)*.18*sin(p*PI);
      float y=uv.y+e+k;
      c+=y<1.?A(vec2(uv.x,y)):B(vec2(uv.x,y-1.));
    }
    col=c/12.;
  } else if(ty==4){ // gravitational swirl
    vec2 c=uv-.5; c.x*=uRes.x/uRes.y;
    float r=length(c); float s=sin(p*PI);
    float ang=s*6.*exp(-r*3.);
    vec2 q=rot(ang)*c*(1.-.35*s*exp(-r*4.));
    q.x/=uRes.x/uRes.y; q+=.5;
    col=mix(A(q),B(q),smoothstep(.3,.75,p));
    col*=1.-.9*s*exp(-r*r*40.);
  } else if(ty==5){ // pixel dissolve
    float s=sin(p*PI); float px=max(1.,floor(s*s*90.));
    vec2 g=(floor(uv*uRes/px)+.5)*px/uRes;
    float r=hash21(floor(uv*uRes/max(px,8.)));
    col=mix(A(g),B(g),step(r,smoothstep(.2,.8,p)));
    col*=.85+.3*step(.5,fract(gl_FragCoord.y*.25));
  } else if(ty==6){ // white flash
    col=mix(A(uv),B(uv),smoothstep(.4,.6,p))+vec3(1.,.97,.92)*exp(-pow((p-.48)*5.,2.))*1.8;
  } else col=mix(A(uv),B(uv),p);
  fragColor=vec4(col,1);
}`);

const postFS = fsProgram(`
uniform sampler2D uTex, uBloomTex; uniform float uFade, uGlitch, uScan, uAberr, uBloom, uExpo, uGrain, uBars, uFrame;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){
  vec2 uv=vUv;
  float fr=floor(uFrame/2.);
  if(uGlitch>0.){
    float row=hash21(vec2(floor(uv.y*48.),fr));
    if(row<uGlitch*.55) uv.x+=(hash21(vec2(floor(uv.y*48.),fr+9.))-.5)*.14*uGlitch;
    float blk=hash21(floor(uv*vec2(20.,12.))+fr);
    if(blk<uGlitch*.12) uv=floor(uv*vec2(40.,24.))/vec2(40.,24.)+.01;
  }
  vec2 d=uv-.5;
  float ab=uAberr*(.0015+dot(d,d)*.014)+uGlitch*.02;
  vec3 col=vec3(texture(uTex,uv-d*ab).r,texture(uTex,uv).g,texture(uTex,uv+d*ab).b);
  col+=texture(uBloomTex,uv).rgb*uBloom*.16;
  col*=uExpo;
  col=aces(col);
  col*=mix(1.,smoothstep(1.25,.25,length(d*vec2(1.,.9))*1.35),.65);
  col*=1.-uScan*(.5+.5*sin(gl_FragCoord.y*1.7))*.3;
  col=pow(col,vec3(1./2.2));
  col+=(hash21(gl_FragCoord.xy+fract(uFrame*.618)*311.)-.5)*uGrain;
  col*=uFade;
  float bar=uBars*.06;
  if(vUv.y<bar||vUv.y>1.-bar) col=vec3(0);
  fragColor=vec4(col,1);
}`);

// global FX envelope
function spike(t, c, w) { return Math.exp(-Math.pow((t - c) / w, 2)); }
function fx(t) {
  let fade = sstep(0.0, 0.9, t);
  fade *= 1 - sstep(K.eyes + 0.25, K.eyes + 0.75, t) * (t < K.open ? 1 : 0);
  fade *= 1 - sstep(K.cut + 0.05, K.cut + 0.35, t);
  const glitch = Math.min(1, 0.9 * spike(t, K.fake + 0.12, 0.12) + 0.8 * spike(t, K.projection + 0.2, 0.18) + 0.6 * spike(t, K.late + 0.1, 0.1)
    + 0.4 * spike(t, K.seen + 0.05, 0.07) + 0.9 * spike(t, K.cut, 0.12) + 0.5 * spike(t, K.open, 0.06) + 0.35 * spike(t, K.moment, 0.05));
  const scan = sstep(K.universe1 - 0.5, K.projection, t) * (1 - sstep(K.humans - 0.3, K.humans + 0.2, t)) + 0.3 * sstep(K.title, K.title + 0.5, t);
  const bloom = 1 + 0.4 * sstep(K.edge - 0.5, K.edge + 1, t) * (1 - sstep(K.humans - 0.5, K.humans, t)) + 0.5 * sstep(K.dying, K.stars2, t) * (1 - sstep(K.so, K.so + 1, t));
  return { fade, glitch, scan, bloom, aberr: 1 + glitch * 2, expo: 1.0, grain: 0.035, bars: 1 };
}

function sceneIndexAt(t) { let i = 0; for (const tr of TRANS) if (t >= tr.at) i++; return i; }

let frameNo = 0;
function renderGL(t) {
  let tr = null, ti = -1;
  TRANS.forEach((x, i) => { if (Math.abs(t - x.at) < x.dur / 2) { tr = x; ti = i; } });
  gl.clearColor(0, 0, 0, 1);
  if (tr) {
    const A = tgt(SCENES[ti].scale || 1).A, B = tgt(SCENES[ti + 1].scale || 1).B;
    bindTarget(A); gl.clear(gl.COLOR_BUFFER_BIT); SCENES[ti].draw(t);
    bindTarget(B); gl.clear(gl.COLOR_BUFFER_BIT); SCENES[ti + 1].draw(t);
    bindTarget(TC);
    drawFS(transFS, { uA: { tex: A.tex }, uB: { tex: B.tex }, uP: clamp01((t - tr.at + tr.dur / 2) / tr.dur), uType: tr.type, uTime: t });
  } else {
    const sc = SCENES[sceneIndexAt(t)], scale = sc.scale || 1;
    if (scale === 1) { bindTarget(TC); gl.clear(gl.COLOR_BUFFER_BIT); sc.draw(t); }
    else {
      const A = tgt(scale).A; bindTarget(A); gl.clear(gl.COLOR_BUFFER_BIT); sc.draw(t);
      bindTarget(TC); drawFS(transFS, { uA: { tex: A.tex }, uB: { tex: A.tex }, uP: 0, uType: 0, uTime: t });
    }
  }
  bloomChain();
  bindTarget(SCREEN);
  const f = fx(t);
  drawFS(postFS, {
    uTex: { tex: TC.tex }, uBloomTex: { tex: BL[0].tex }, uTime: t, uFrame: frameNo, uFade: f.fade, uGlitch: f.glitch, uScan: f.scan,
    uAberr: f.aberr, uBloom: f.bloom, uExpo: f.expo, uGrain: f.grain, uBars: f.bars,
  });
}

async function boot() {
  const faces = ['300 48px "Cormorant Garamond"', 'italic 300 48px "Cormorant Garamond"', 'italic 400 48px "Cormorant Garamond"',
    '500 48px "Cormorant Garamond"', '400 48px Cinzel', '600 48px Cinzel'];
  await Promise.all(faces.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  S6.init();
  window.DURATION = DURATION;
  window.K = K;
}
window.ready = boot();
window.renderAt = (t, frame) => {
  frameNo = frame === undefined ? Math.round(t * 30) : frame;
  renderGL(t);
  drawOverlay(t);
  gl.finish();
  return true;
};
