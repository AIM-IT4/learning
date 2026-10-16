// Scenes 4-7: dead stars, black hole hologram, borrowed atoms, the cosmic eye
'use strict';
const STARFIELD = `
vec3 starfield(vec3 rd){
  vec3 col=vec3(0);
  for(int l=0;l<3;l++){
    float fl=float(l); float sc=90.+fl*110.;
    vec3 p=rd*sc; vec3 c=floor(p); vec3 h=hash33(c+fl*17.);
    vec3 sp=c+.25+.5*h; float d=length(p-sp);
    float b=pow(hash31(c*1.7+fl),9.+fl*4.)*(1.6-fl*.35);
    float tw=.7+.3*sin(uTime*(1.5+h.x*5.)+h.y*30.);
    vec3 sc_=mix(vec3(.65,.75,1.),vec3(1.,.82,.6),h.z);
    col+=sc_*b*tw*(exp(-d*d*60.)*2.2+exp(-d*d*8.)*.05);
  }
  return col;
}
vec3 milky(vec3 rd, vec3 n){
  float x=dot(rd,n); float band=exp(-x*x/.03);
  float dust=fbm3(rd*4.5); float lanes=smoothstep(.45,.72,fbm3(rd*9.+3.));
  float m=band*(.25+dust*dust*1.6)*(1.-.8*lanes*smoothstep(.2,1.,band));
  return mix(vec3(.18,.22,.4),vec3(.95,.78,.6),band*dust)*m*.55;
}`;

// ───────────────────────── Scene 4 : ghosts made of light ─────────────────────────
const S4 = (() => {
  const fs = fsProgram(STARFIELD + `
uniform vec3 uF, uR, uU; uniform vec3 uSA, uSB, uSC; uniform vec3 uDeath; uniform float uRing, uHi;
vec3 hstar(vec3 rd, vec3 s, float td){
  float age=uTime-td;
  float life=age<0.?1.:(1.+3.5*exp(-age*9.))*exp(-age*3.2);
  vec3 dv=rd-s; float d=length(dv);
  float core=exp(-d*d*4e6)*3.+.00002/(d*d+.000002)*.6;
  float sx=dot(dv,uR), sy=dot(dv,uU);
  float spikes=exp(-abs(sx)*2600.)*exp(-abs(sy)*55.)+exp(-abs(sy)*2600.)*exp(-abs(sx)*55.);
  vec3 c=vec3(1.,.93,.85)*(core+spikes*.6)*life*uHi;
  if(age>0.){
    float R=age*.03; float ring=exp(-pow((d-R)/.0012,2.))*exp(-age*.55);
    float ghost=.000003/(d*d+.000003)*.45*(.6+.4*sin(uTime*3.+td));
    c+=vec3(.5,.72,1.)*(ring*.9+ghost)*uRing;
  }
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 rd=normalize(uv.x*uR+uv.y*uU+1.5*uF);
  vec3 col=vec3(.002,.003,.008)+vec3(.0,.01,.025)*smoothstep(.6,0.,rd.y);
  col+=starfield(rd)*1.1+milky(rd,normalize(vec3(.75,.35,-.55)));
  float extra=exp(-pow(dot(rd,normalize(vec3(.75,.35,-.55))),2.)/.02);
  vec3 p=rd*420.; vec3 cc=floor(p); vec3 hh=hash33(cc);
  col+=vec3(.9,.9,1.)*pow(hh.x,6.)*extra*smoothstep(.35,0.,length(fract(p)-.5))*.5;
  col+=hstar(rd,uSA,uDeath.x)+hstar(rd,uSB,uDeath.y)+hstar(rd,uSC,uDeath.z);
  // horizon silhouette + airglow
  float el=asin(clamp(rd.y,-1.,1.)); float az=atan(rd.x,rd.z);
  float ridge=.035+.06*fbm2(vec2(az*2.6,1.3))+.015*noise2(vec2(az*18.,4.));
  col+=vec3(.03,.09,.16)*exp(-max(el-ridge,0.)*10.)*.8;
  col=mix(col,vec3(.0015,.002,.003),smoothstep(ridge+.002,ridge-.002,el));
  fragColor=vec4(col,1);
}`);
  function pose(t) {
    const k = easeInOut((t - K.lookup + 0.35) / 2.4);
    const pitch = lerp(0.03, 0.9, k) + 0.015 * Math.sin(t * 0.4), yaw = 0.25 + (t - K.lookup) * 0.012;
    const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const r = v3.norm(v3.cross(f, [0, 1, 0])), u = v3.cross(r, f);
    return { f, r, u };
  }
  const P1 = pose(K.ghosts);
  const dirFromUV = (x, y) => v3.norm(v3.add(v3.add(v3.scale(P1.r, x), v3.scale(P1.u, y)), v3.scale(P1.f, 1.5)));
  const SITES = [[-0.43, 0.15], [0.37, -0.07], [0.06, 0.27]].map(([x, y]) => dirFromUV(x, y));
  const DEATH = [K.gone - 0.55, K.gone - 0.1, K.gone + 0.35];
  return {
    SITES, DEATH,
    draw(t) {
      const p = pose(t);
      drawFS(fs, {
        uTime: t, uF: p.f, uR: p.r, uU: p.u, uSA: SITES[0], uSB: SITES[1], uSC: SITES[2], uDeath: DEATH,
        uRing: sstep(K.gone - 0.6, K.ghosts, t), uHi: sstep(K.lookup + 0.6, K.some, t),
      });
    },
    labels(t) {
      const p = pose(t);
      return SITES.map((s) => {
        const z = v3.dot(s, p.f);
        return { x: W / 2 + v3.dot(s, p.r) * 1.5 / z * H, y: H / 2 - v3.dot(s, p.u) * 1.5 / z * H };
      });
    },
  };
})();

// ───────────────────────── Scene 5 : black hole, information on the surface ─────────────────────────
const S5 = (() => {
  const scale = 0.6667;
  const fs = fsProgram(STARFIELD + `
uniform vec3 uRo; uniform float uHolo, uProj, uDisk, uFl;
float bits(vec3 n, float cells){
  float th=acos(clamp(n.y,-1.,1.)); float ph=atan(n.z,n.x)+uTime*.04;
  vec2 g=vec2(ph/PI*cells,th/PI*cells); vec2 id=floor(g), f=fract(g);
  float b=step(.78,hash21(id+floor(uTime*4.+hash21(id+3.)*4.)));
  float sq=smoothstep(.42,.3,max(abs(f.x-.5),abs(f.y-.5)));
  vec2 fw=fwidth(g); vec2 gl=1.-smoothstep(vec2(0.),fw*1.2+.02,abs(f-.5)*-1.+.5);
  float wave=.5+.5*sin(th*7.-uTime*2.5+ph*2.);
  return sq*b*(.35+.65*wave)+max(gl.x,gl.y)*.1;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=uRo; vec3 rd=camRay(uv,ro,vec3(0,0,0),uFl);
  vec3 p=ro, v=rd;
  vec3 hv=cross(p,v); float h2=dot(hv,hv);
  vec3 col=vec3(0); float trans=1.;
  bool captured=false;
  for(int i=0;i<150;i++){
    float r=length(p);
    float dt=clamp(.075*r,.018,2.2);
    vec3 acc=-1.5*h2*p/pow(r,5.);
    v+=acc*dt; vec3 np=p+v*dt;
    if(p.y*np.y<0.){
      vec3 q=mix(p,np,p.y/(p.y-np.y)); float rq=length(q.xz);
      if(rq>2.3 && rq<10.5){
        float ang=atan(q.z,q.x)+uTime*1.5*pow(rq,-1.5);
        vec3 nq=vec3(cos(ang)*rq,sin(ang)*rq,rq*.35);
        float tex=fbm3l(nq*1.1);
        float rings=.6+.4*sin(rq*7.+tex*6.);
        float I=pow(2.4/rq,2.)*smoothstep(2.3,3.1,rq)*(1.-smoothstep(7.,10.5,rq))*(.3+tex*1.4)*rings;
        vec3 vd=normalize(vec3(-q.z,0.,q.x))*sqrt(.5/rq);
        float gam=1./sqrt(1.-dot(vd,vd));
        float D=1./(gam*(1.-dot(vd,-normalize(v))));
        I*=pow(D,3.)*uDisk;
        vec3 dc=mix(vec3(1.,.38,.1),vec3(1.,.82,.55),smoothstep(0.,.7,I));
        dc=mix(dc,vec3(.75,.85,1.),clamp((D-1.)*1.1,0.,.55));
        col+=trans*dc*I*1.55;
        trans*=1.-clamp(I*.8,0.,.9);
      }
    }
    if(uProj>0. && r<6.){
      col+=trans*uProj*vec3(.2,.85,1.)*bits(p/r,22.)*exp(-(r-1.)*1.3)*dt*.14;
    }
    p=np;
    if(length(p)<1.){ captured=true; break; }
    if(length(p)>40. && dot(p,v)>0.) break;
  }
  if(captured){
    vec3 n=normalize(p);
    col+=trans*uHolo*vec3(.15,.85,1.)*bits(n,80.)*.55;
    col+=trans*uHolo*vec3(.2,.6,1.)*.012;
  } else {
    vec3 d=normalize(v);
    col+=trans*(starfield(d)+milky(d,normalize(vec3(.2,.9,.35)))*.6);
  }
  fragColor=vec4(col,1);
}`);
  function ro(t) {
    const t0 = K.edge - 0.6;
    let D;
    if (t < K.everything) D = lerp(24, 15, easeOut((t - t0) / (K.everything - t0)));
    else if (t < K.universe1) D = lerp(15, 10.5, easeInOut((t - K.everything) / (K.universe1 - K.everything)));
    else D = lerp(10.5, 17, easeInOut((t - K.universe1) / (K.humans - K.universe1 + 0.2)));
    const a = -0.35 + (t - t0) * 0.035, e = 0.11 + 0.03 * Math.sin(t * 0.35);
    return [D * Math.sin(a) * Math.cos(e), D * Math.sin(e), -D * Math.cos(a) * Math.cos(e)];
  }
  return {
    ro, scale,
    draw(t) {
      drawFS(fs, {
        uTime: t, uRo: ro(t), uFl: 1.5, uDisk: sstep(K.edge - 0.6, K.edge + 1.2, t),
        uHolo: sstep(K.written - 0.4, K.surface + 0.2, t),
        uProj: sstep(K.universe1 - 0.4, K.projection + 0.1, t) * 1.3,
      });
    },
    labels(t) { return { hole: projectPx([0, 0, 0], ro(t), [0, 0, 0], 1.5) }; },
  };
})();

// ───────────────────────── Scene 6 : borrowed atoms ─────────────────────────
function drawHuman(x, S) {
  const u = S / 100;
  x.lineCap = 'round'; x.lineJoin = 'round';
  const limb = (pts, w0, w1, col) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const k = i / (pts.length - 1);
      x.strokeStyle = col; x.lineWidth = (w0 + (w1 - w0) * k) * u;
      x.beginPath(); x.moveTo(pts[i][0] * u, pts[i][1] * u); x.lineTo(pts[i + 1][0] * u, pts[i + 1][1] * u); x.stroke();
    }
  };
  // legs
  limb([[45.5, 56], [44.2, 75], [43.4, 94], [41, 96.5]], 8.6, 5.2, '#c9c9c9');
  limb([[54.5, 56], [55.8, 75], [56.6, 94], [59, 96.5]], 8.6, 5.2, '#c9c9c9');
  // torso
  x.fillStyle = '#e6e6e6'; x.beginPath();
  x.moveTo(38.5 * u, 24 * u); x.quadraticCurveTo(50 * u, 21 * u, 61.5 * u, 24 * u);
  x.quadraticCurveTo(59 * u, 40 * u, 56.5 * u, 50 * u); x.quadraticCurveTo(60 * u, 55 * u, 59.5 * u, 60 * u);
  x.lineTo(40.5 * u, 60 * u); x.quadraticCurveTo(40 * u, 55 * u, 43.5 * u, 50 * u); x.quadraticCurveTo(41 * u, 40 * u, 38.5 * u, 24 * u);
  x.fill();
  // arms
  limb([[40, 25], [35.5, 40.5], [33.2, 55], [32.6, 58.5]], 6.4, 4.2, '#dadada');
  limb([[60, 25], [64.5, 40.5], [66.8, 55], [67.4, 58.5]], 6.4, 4.2, '#dadada');
  // neck + head
  limb([[50, 17], [50, 23]], 4.6, 4.6, '#e0e0e0');
  x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(50 * u, 11.5 * u, 5.4 * u, 6.6 * u, 0, 0, Math.PI * 2); x.fill();
}
function sampleEmoji(ch, n, seed, height) {
  const S = 400, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  if (ch === 'human') drawHuman(x, S);
  else {
    x.font = `${Math.round(S * 0.82)}px "Noto Color Emoji"`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, S / 2, S / 2 + S * 0.05);
  }
  const d = x.getImageData(0, 0, S, S).data;
  const px = [];
  let x0 = S, x1 = 0, y0 = S, y1 = 0;
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const i = (y * S + xx) * 4;
    if (d[i + 3] > 150) {
      px.push([xx, y, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255]);
      x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (!px.length) throw new Error('emoji did not render: ' + ch);
  const r = rng(seed), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sc = Math.min(height / (y1 - y0), 3.4 / (x1 - x0));
  const pos = new Float32Array(n * 3), lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = px[Math.floor(r() * px.length)];
    pos[i * 3] = -(p[0] + r() - 0.5 - cx) * sc;
    pos[i * 3 + 1] = -(p[1] + r() - 0.5 - cy) * sc;
    pos[i * 3 + 2] = (r() - 0.5) * 0.28;
    lum[i] = p[2];
  }
  return { pos, lum };
}
const S6 = (() => {
  let cloud = null, N = 52000;
  const fs = fsProgram(`
uniform vec2 uStarUV; uniform float uStarR, uStarHot, uNovaAge, uBg;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 col=vec3(.003,.0035,.007)*uBg+vec3(.012,.008,.02)*exp(-dot(uv,uv)*4.)*uBg;
  for(int l=0;l<2;l++){
    float fl=float(l); vec2 g=uv*(40.+fl*35.)+vec2(uTime*(.25+fl*.2),0.); vec2 id=floor(g); vec2 h=hash22(id+fl*9.);
    float d=length(fract(g)-.2-.6*h);
    col+=vec3(.6,.7,1.)*step(.82,hash21(id+5.+fl))*smoothstep(.07,0.,d)*.5*uBg*(.6+.4*sin(uTime*2.+h.x*20.));
  }
  vec2 d=uv-uStarUV; float r=length(d);
  vec3 sc=mix(vec3(1.,.92,.75),vec3(1.,.32,.12),uStarHot);
  col+=sc*(smoothstep(uStarR,uStarR*.55,r)*5.+uStarR*.05/(r*r+.0008))*step(.0001,uStarR);
  if(uNovaAge>0.){
    float a=uNovaAge; float R=a*.62;
    float ring=exp(-pow((r-R)/(.01+.04*a),2.))*exp(-a*.7)*3.;
    float ang=atan(d.y,d.x);
    float ej=fbm2(vec2(ang*5.,r*7.-a*2.5))*smoothstep(R*1.05,R*.2,r)*exp(-a*.6)*2.5;
    col+=vec3(.6,.75,1.)*ring+mix(vec3(1.,.5,.3),vec3(.5,.6,1.),r/max(R,.01))*ej;
    col+=vec3(1.,.95,.9)*exp(-a*3.5)*4.*exp(-r*r*3.);
  }
  fragColor=vec4(col,1);
}`);
  const SEQ = [[K.humans - 0.6, 0], [K.animals - 0.15, 1], [K.living - 0.2, 2], [K.living + 0.6, 3], [K.pattern - 0.35, 0]];
  function weights(t) {
    const w = [0, 0, 0, 0];
    let cur = SEQ[0][1], prev = SEQ[0][1], k = 1;
    for (const [ts, s] of SEQ) if (t >= ts) { prev = cur; cur = s; k = easeInOut((t - ts) / 0.55); }
    w[prev] += 1 - k; w[cur] += k;
    return w;
  }
  const STAR = [0, 0.35, 0];
  function cam(t) { return { ro: [0.9 * Math.sin(0.28 * t + 1), 0.12, -4.5 + 0.15 * Math.sin(t * 0.2)], ta: [0, 0.05, 0] }; }
  function init() {
    const shapes = [['human', 2.4], ['\u{1F98C}', 2.05], ['\u{1F98B}', 2.0], ['\u{1F333}', 2.35]].map(([ch, h], i) => sampleEmoji(ch, N, 100 + i, h));
    const r = rng(5), rnd = new Float32Array(N * 4), lum = new Float32Array(N * 4);
    for (let i = 0; i < N * 4; i++) rnd[i] = r();
    for (let i = 0; i < N; i++) for (let s = 0; s < 4; s++) lum[i * 4 + s] = shapes[s].lum[i];
    cloud = makeCloud(`
in vec3 aS0; in vec3 aS1; in vec3 aS2; in vec3 aS3; in vec4 aR; in vec4 aL;
uniform vec4 uW; uniform float uFlux, uGather, uNovaAge, uForm; uniform vec3 uStar;
out vec3 vCol; out float vA;
void main(){
  vec3 p=aS0*uW.x+aS1*uW.y+aS2*uW.z+aS3*uW.w;
  float act=1.-max(max(uW.x,uW.y),max(uW.z,uW.w));
  vec3 rn=normalize(aR.xyz-.5+1e-3);
  p+=rn*act*1.2*(.3+aR.w);
  // assemble from the void at the start
  vec3 far=rn*(5.+aR.w*5.);
  float form=clamp(uForm*1.6-aR.w*.6,0.,1.); form=form*form*(3.-2.*form);
  p=mix(far,p,form);
  float alpha=form;
  // flux: atoms are borrowed and given back
  if(uFlux>0. && aR.y<.55){
    float ph=fract(uTime*.2+aR.x*3.);
    vec3 fin=p+rn*3.5+vec3(0,1.,0)*aR.z, fout=p+normalize(aR.zxy-.5)*3.5;
    float fi=smoothstep(0.,.2,ph), fo=smoothstep(.8,1.,ph);
    vec3 q=mix(mix(fin,p,fi),fout,fo);
    p=mix(p,q,uFlux); alpha*=mix(1.,fi*(1.-fo),uFlux);
  }
  // carbon returns to its star
  float g=clamp(uGather*1.7-aR.z*.7,0.,1.); g=g*g*(3.-2.*g);
  vec3 toS=p-uStar; float sw=g*5.;
  toS.xz=rot(sw)*toS.xz;
  p=uStar+toS*(1.-g)+rn*.05*g;
  // supernova
  if(uNovaAge>0.){ p=uStar+rn*(uNovaAge*(1.2+aR.w*2.4))+rn*.05; alpha*=exp(-uNovaAge*.7); }
  float z; gl_Position=project(p,z);
  gl_PointSize=clamp((.0065+.005*aR.x)*uFl/z*uRes.y,1.,7.);
  vec3 c0=vec3(1.,.7,.4), c1=vec3(.4,.85,1.), c2=vec3(.8,.5,1.), c3=vec3(.55,1.,.55);
  float l=dot(aL,uW);
  vec3 c=(c0*uW.x+c1*uW.y+c2*uW.z+c3*uW.w)*(.35+1.1*l);
  c=mix(c,vec3(1.,.85,.6)*1.6,g); if(uNovaAge>0.) c=mix(vec3(1.,.9,.8),vec3(.5,.65,1.),clamp(uNovaAge,0.,1.))*2.;
  vCol=c*1.3; vA=alpha*(.5+.5*aR.x);
}`, {
      aS0: { data: shapes[0].pos, size: 3 }, aS1: { data: shapes[1].pos, size: 3 }, aS2: { data: shapes[2].pos, size: 3 },
      aS3: { data: shapes[3].pos, size: 3 }, aR: { data: rnd, size: 4 }, aL: { data: lum, size: 4 },
    }, N);
  }
  const NOVA = K.stars2 + 0.05;
  return {
    init, cam, STAR,
    draw(t) {
      const c = cam(t);
      const gather = clamp01((t - K.carbon + 0.1) / 2.0);
      const starUV = projectPx(STAR, c.ro, c.ta, 1.6);
      const novaAge = Math.max(0, t - NOVA) * (t > NOVA ? 1 : 0);
      drawFS(fs, {
        uTime: t, uBg: 1, uStarUV: [(starUV.x - W / 2) / H, (H / 2 - starUV.y) / H],
        uStarR: t < NOVA ? 0.004 + 0.03 * sstep(K.carbon + 0.2, K.dying, t) + 0.045 * sstep(K.dying - 0.1, NOVA, t) * (1 + 0.15 * Math.sin(t * 40)) : 0,
        uStarHot: sstep(K.dying - 0.3, NOVA, t), uNovaAge: t > NOVA ? novaAge : 0,
      });
      cloud.draw({
        uTime: t, uRo: c.ro, uTa: c.ta, uFl: 1.6, uW: weights(t), uForm: clamp01((t - K.humans + 0.75) / 1.1),
        uFlux: sstep(K.pattern - 0.2, K.borrowing + 0.3, t) * (1 - sstep(K.carbon - 0.3, K.carbon + 0.4, t)),
        uGather: gather, uStar: STAR, uNovaAge: t > NOVA ? novaAge : 0,
      });
    },
    labels(t) { const c = cam(t); return { chest: projectPx([0.05, 0.5, 0], c.ro, c.ta, 1.6), star: projectPx(STAR, c.ro, c.ta, 1.6) }; },
  };
})();

// ───────────────────────── Scene 7 : galaxy → the eye that watches ─────────────────────────
const S7 = (() => {
  const N = 72000, r = rng(77);
  const G = new Float32Array(N * 4), R = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    let rr, th, h, type;
    if (r() < 0.2) { rr = Math.abs(gauss(r)) * 0.2; th = r() * Math.PI * 2; h = gauss(r) * 0.09 * Math.exp(-rr * 3); type = 0; }
    else {
      const arm = r() < 0.5 ? 0 : 1;
      rr = 0.12 + Math.pow(r(), 0.85) * 1.38;
      th = arm * Math.PI + Math.log(rr / 0.12) / Math.tan(0.3) + gauss(r) * 0.3 * (0.45 + 0.55 * (1 - rr / 1.5));
      h = gauss(r) * 0.022; type = r() < 0.035 ? 2 : 1;
    }
    G.set([rr, th, h, type], i * 4); R.set([r(), r(), r(), r()], i * 4);
  }
  const galaxy = makeCloud(`
in vec4 aG; in vec4 aR; uniform float uA, uGrow; out vec3 vCol; out float vA;
void main(){
  float rr=aG.x*uGrow; float th=aG.y+uTime*.16/(.35+aG.x);
  vec3 p=vec3(rr*cos(th),aG.z,rr*sin(th));
  float z; gl_Position=project(p,z);
  float big=aG.w==0.?1.6:aG.w==2.?2.2:1.;
  gl_PointSize=clamp(.0055*big*(.6+aR.x)*uFl/z*uRes.y,1.,8.);
  vec3 c=aG.w==0.?vec3(1.,.78,.5):aG.w==2.?vec3(1.,.35,.6)*1.8:mix(vec3(.55,.7,1.),vec3(.95,.95,1.),aR.y);
  vCol=c*1.25; vA=uA*(.35+.65*aR.z);
}`, { aG: { data: G, size: 4 }, aR: { data: R, size: 4 } }, N);
  const eye = fsProgram(`
uniform float uEye, uOpen, uPupil, uScale; uniform vec2 uLook; uniform vec2 uCoreUV; uniform float uCore;
float lidTop(float x){ return uOpen*.56*pow(max(1.-x*x,0.),.85)-(1.-uOpen)*.015; }
float lidBot(float x){ return -uOpen*.40*pow(max(1.-x*x,0.),.95)-(1.-uOpen)*.015; }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 col=vec3(0);
  // galaxy core haze
  vec2 cd=uv-uCoreUV; col+=vec3(1.,.8,.55)*(.0016/(dot(cd,cd)+.0025))*uCore;
  if(uEye>0.){
    vec2 e=uv/uScale; e.y+=.015;
    vec3 skin=vec3(.011,.009,.011)*(.6+.8*fbm2(e*16.));
    skin*=1.-.6*smoothstep(.3,1.5,length(e*vec2(.7,1.2)));
    float yt=lidTop(e.x), yb=lidBot(e.x);
    float crease=exp(-pow((e.y-(.56*pow(max(1.-e.x*e.x,0.),.8)+.12))*28.,2.))*smoothstep(1.1,.3,abs(e.x));
    skin+=vec3(.012,.01,.012)*crease;
    float inside=smoothstep(-.008,.008,yt-e.y)*smoothstep(-.008,.008,e.y-yb)*step(abs(e.x),1.);
    vec2 ic=uLook; float d=length(e-ic); float a=atan(e.y-ic.y,e.x-ic.x);
    float IR=.4, PR=.12*uPupil;
    vec3 scl=vec3(.05,.055,.075)*(1.-.65*smoothstep(.15,1.,length(e*vec2(1.,1.7))));
    scl+=vec3(.05,.006,.006)*smoothstep(.62,.72,fbm2(e*8.+3.))*smoothstep(.45,.95,abs(e.x));
    float fib=fbm2(vec2(a*9.,d*14.)), fib2=noise2(vec2(a*64.,d*3.));
    float sp=fbm2(vec2(a*1.5+log(d+.03)*3.2-uTime*.12,d*4.));
    vec3 icol=mix(vec3(.95,.5,.18),vec3(.12,.36,.45),smoothstep(PR+.01,PR+.09,d));
    icol=mix(icol,vec3(.05,.12,.38),smoothstep(PR+.1,IR,d));
    float crypt=smoothstep(.35,.6,fbm2(vec2(a*5.,d*9.)+4.));
    icol*=(.15+1.4*pow(fib,1.8)+.35*fib2)*(.35+1.3*sp*sp)*(.55+.45*crypt)*.62;
    icol*=1.-.8*smoothstep(IR-.07,IR,d);
    vec2 sc=e*95.; float sh=hash21(floor(sc));
    icol+=vec3(.8,.9,1.)*step(.982,sh)*smoothstep(.3,0.,length(fract(sc)-.5))*2.5*step(d,IR);
    vec3 pcol=vec3(.02,.01,.04)*(1.-d/max(PR,.001))+vec3(.6,.7,1.)*step(.994,hash21(floor(e*170.)))*.8;
    vec3 ball=mix(scl,icol,smoothstep(IR+.006,IR-.006,d));
    ball=mix(ball,pcol,smoothstep(PR+.012,PR-.004,d));
    ball*=.3+.7*smoothstep(0.,.13,yt-e.y);
    vec2 h1=e-ic-vec2(-.12,.13), h2=e-ic-vec2(.1,-.08);
    ball+=vec3(1.)*exp(-dot(h1,h1)*1100.)*1.5+vec3(.7,.8,1.)*exp(-dot(h2,h2)*2600.)*.6;
    float wet=exp(-pow((e.y-yb)*140.,2.))*smoothstep(1.,.3,abs(e.x))*uOpen;
    vec3 ec=mix(skin,ball,inside)+vec3(.35,.3,.32)*wet*.25;
    col=mix(col,ec,uEye);
  }
  fragColor=vec4(col,1);
}`);
  function cam(t) {
    const t0 = K.stars2 + 0.3;
    const el = lerp(0.62, 1.5, easeInOut((t - K.maybe2) / (K.strangest + 0.6 - K.maybe2)));
    const D = lerp(3.2, 5.2, easeInOut((t - t0) / (K.strangest + 0.6 - t0)));
    const az = 0.4 + (t - t0) * 0.06;
    return { ro: [D * Math.cos(el) * Math.sin(az), D * Math.sin(el), -D * Math.cos(el) * Math.cos(az)], ta: [0, 0, 0] };
  }
  return {
    draw(t) {
      const c = cam(t);
      const galA = sstep(K.stars2 + 0.4, K.so, t) * (1 - sstep(K.universe2, K.something + 0.2, t));
      const coreP = projectPx([0, 0, 0], c.ro, c.ta, 1.6);
      let open = 1, scale, pupil = 1, eyeA = sstep(K.strangest - 0.2, K.something - 0.3, t);
      scale = lerp(1.12, 0.66, easeInOut((t - K.universe2) / (K.wonder + 0.4 - K.universe2)));
      pupil = 1 + 0.45 * sstep(K.wonder - 0.1, K.wonder + 0.6, t);
      if (t > K.close) open = 1 - easeInOut((t - K.eyes) / 0.42);
      if (t >= K.open) {
        open = easeOut((t - K.open) / 0.24);
        pupil = lerp(1.7, 0.85, easeOut((t - K.open) / 0.6));
        scale = lerp(0.8, 0.72, easeOut((t - K.open) / 3));
        eyeA = 1;
      }
      drawFS(eye, {
        uTime: t, uEye: eyeA, uOpen: open, uPupil: pupil, uScale: scale, uLook: [0.015 * Math.sin(t * 0.7), 0.01 * Math.sin(t * 0.5)],
        uCoreUV: [(coreP.x - W / 2) / H, (H / 2 - coreP.y) / H], uCore: galA,
      });
      if (galA > 0) galaxy.draw({ uTime: t, uRo: c.ro, uTa: c.ta, uFl: 1.6, uA: galA, uGrow: lerp(0.25, 1, easeOut((t - K.stars2 - 0.4) / 2.2)) });
    },
  };
})();

const SCENES = [S0, S1, S2, S3, S4, S5, S6, S7];
