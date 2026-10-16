// Scenes 0-3: matter dissolve, atom, quantum field, perception
'use strict';
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
};
// project a world point to canvas pixels with the camRay() camera
function projectPx(p, ro, ta, fl) {
  const f = v3.norm(v3.sub(ta, ro)), r = v3.norm(v3.cross(f, [0, 1, 0])), u = v3.cross(r, f);
  const v = v3.sub(p, ro), z = v3.dot(v, f);
  const qx = v3.dot(v, r) * fl / z, qy = v3.dot(v, u) * fl / z;
  return { x: W / 2 + qx * H, y: H / 2 - qy * H, z };
}

// ───────────────────────── Scene 0 : solid matter that dissolves ─────────────────────────
const S0 = (() => {
  const fs = fsProgram(`
uniform float uPush, uDis, uRot, uEdge;
vec3 bg(vec3 rd){
  float n=fbm3(rd*2.2+vec3(0,0,uTime*.015));
  vec3 c=vec3(.002,.003,.007)+vec3(.012,.018,.04)*pow(n,3.)*2.;
  vec3 p=rd*220.; vec3 cell=floor(p); vec3 h=hash33(cell);
  float d=length(fract(p)-.5-(h-.5)*.6);
  c+=vec3(.8,.85,1.)*pow(h.x,22.)*smoothstep(.12,0.,d)*3.;
  return c;
}
float disN(vec3 p){ return fbm3(p*2.2+vec3(4.1,1.3,7.7)); }
vec3 stone(vec3 p, vec3 op, vec3 rd, float inner){
  vec3 nor=normalize(p)*(inner>.5?-1.:1.);
  float e=.015; vec3 q=op*5.;
  float f0=fbm3(q);
  vec3 g=vec3(fbm3(q+vec3(e,0,0))-f0, fbm3(q+vec3(0,e,0))-f0, fbm3(q+vec3(0,0,e))-f0)/e;
  nor=normalize(nor-.06*(g-nor*dot(g,nor)));
  float vein=pow(1.-abs(sin(fbm3(op*2.6)*14.)),10.);
  vec3 alb=mix(vec3(.025,.026,.03), vec3(.16,.15,.14), f0*f0)+vec3(.5,.42,.32)*vein*.35;
  vec3 L=normalize(vec3(-.6,.65,-.55));
  float dif=max(dot(nor,L),0.);
  float spec=pow(max(dot(reflect(rd,nor),L),0.),48.)*.9;
  float rim=pow(1.-max(dot(nor,-rd),0.),3.);
  vec3 c=alb*(vec3(1.,.9,.78)*dif*1.6+vec3(.03,.04,.06))+vec3(1.,.95,.85)*spec+vec3(.25,.5,1.)*rim*.5;
  return inner>.5? c*.25 : c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=vec3(0,0,-4.6+uPush); vec3 rd=camRay(uv,ro,vec3(0),1.6);
  vec3 col=bg(rd);
  float b=dot(ro,rd), c=dot(ro,ro)-1., h=b*b-c;
  float dmin=length(ro-rd*dot(ro,rd));
  vec3 core=vec3(.5,.7,1.)*(.006/(dmin*dmin+.004))*uEdge;
  if(h>0.){
    h=sqrt(h); float t0=-b-h, t1=-b+h;
    mat2 R=rot(uRot);
    vec3 p=ro+rd*t0; vec3 op=p; op.xz=R*op.xz;
    float n=disN(op);
    if(n>uDis){
      col=stone(p,op,rd,0.);
      col+=vec3(1.,.42,.12)*6.*smoothstep(.05,0.,n-uDis)*uEdge;
    } else {
      vec3 p2=ro+rd*t1; vec3 op2=p2; op2.xz=R*op2.xz; float n2=disN(op2);
      col=col+core;
      if(n2>uDis){
        col=stone(p2,op2,rd,1.)+core*.3;
        col+=vec3(1.,.42,.12)*4.*smoothstep(.05,0.,n2-uDis)*uEdge;
      }
    }
  } else col+=core*.5;
  fragColor=vec4(col,1);
}`);
  const N = 36000, r = rng(11);
  const dir = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const v = v3.norm([gauss(r), gauss(r), gauss(r)]);
    dir.set(v, i * 3); rnd.set([r(), r(), r(), r()], i * 4);
  }
  const embers = makeCloud(`
in vec3 aDir; in vec4 aRnd;
uniform float uRot, uT0, uD;
out vec3 vCol; out float vA;
void main(){
  vec3 d=normalize(aDir);
  float n=fbm3(d*2.2+vec3(4.1,1.3,7.7));
  float tr=uT0+uD*(n+.1)/1.2; float age=uTime-tr;
  vCol=vec3(0); vA=0.;
  if(age<0.){ gl_Position=vec4(0,0,2,1); return; }
  vec3 wp=d; wp.xz=rot(-uRot)*d.xz;
  vec3 vel=wp*(.25+.6*aRnd.x)+(aRnd.yzw-.5)*.6+vec3(0,.1,0);
  wp+=vel*age*(1.+age*.35)+.18*age*vec3(sin(age*2.1+aRnd.x*6.),cos(age*1.7+aRnd.y*6.),sin(age*1.3+aRnd.z*6.));
  float z; gl_Position=project(wp,z);
  gl_PointSize=clamp((.004+.007*aRnd.w)*uFl/z*uRes.y,1.,9.);
  vA=exp(-age*.75)*(.5+.5*aRnd.x)*smoothstep(0.,.04,age);
  vCol=mix(vec3(1.,.5,.2)*2.6,vec3(.45,.7,1.)*1.4,clamp(age*.7,0.,1.));
}`, { aDir: { data: dir, size: 3 }, aRnd: { data: rnd, size: 4 } }, N);
  const T0 = K.dissolve - 0.15, D = 1.7;
  function cam(t) { return { push: 1.75 * easeInOut(t / (K.atoms + 0.4)) }; }
  return {
    draw(t) {
      const push = cam(t).push, rotA = 0.6 + t * 0.12;
      const dis = -0.1 + 1.2 * clamp01((t - T0) / D);
      drawFS(fs, { uTime: t, uPush: push, uDis: dis, uRot: rotA, uEdge: sstep(T0 - 0.2, T0 + 0.1, t) });
      embers.draw({ uTime: t, uRot: rotA, uT0: T0, uD: D, uRo: [0, 0, -4.6 + push], uTa: [0, 0, 0], uFl: 1.6 });
    },
  };
})();

// ───────────────────────── Scene 1 : the atom is empty ─────────────────────────
const S1 = (() => {
  const scale = 0.6667;
  const fs = fsProgram(`
uniform vec3 uRo, uTa, uC1, uC2; uniform float uW2, uDens, uOverlap, uNuc, uRotA, uSpark;
float orb(vec3 p){
  float r=length(p)+1e-4; float ct=p.y/r;
  float d3=r*r*exp(-r/3.)*(3.*ct*ct-1.);
  float p2=r*exp(-r/2.)*(p.x/r);
  return .0026*d3*d3+.03*p2*p2+.25*exp(-2.*r);
}
vec3 nucleusGlow(vec3 c, vec3 ro, vec3 rd, vec2 uv, float fl){
  vec3 f=normalize(uTa-ro), r=normalize(cross(f,vec3(0,1,0))), u=cross(r,f);
  vec3 v=c-ro; float z=dot(v,f); if(z<.1) return vec3(0);
  vec2 sp=vec2(dot(v,r),dot(v,u))*fl/z; vec2 d=uv-sp;
  float dd=dot(d,d);
  float g=.00002/(dd+.000004)+.0009/(dd+.0012)*.5;
  float streak=exp(-abs(d.y)*900.)*exp(-abs(d.x)*7.)*.8;
  return vec3(1.,.82,.65)*g+vec3(.55,.75,1.)*streak;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=uRo; float fl=1.5; vec3 rd=camRay(uv,ro,uTa,fl);
  vec3 col=vec3(.0015,.002,.004);
  // dust stars
  vec3 sp=rd*160.; vec3 cell=floor(sp); vec3 hh=hash33(cell);
  col+=vec3(.7,.8,1.)*pow(hh.x,24.)*smoothstep(.1,0.,length(fract(sp)-.5))*2.;
  mat2 RA=rot(uRotA), RB=rot(-uRotA*1.3+1.);
  float j=hash21(gl_FragCoord.xy+fract(uTime)*91.);
  // atom 1 (also carries the contact glow); atom 2 integrated separately - emission only, so the sums add
  for(int a=0;a<2;a++){
    if(a==1 && uW2<.001) break;
    vec3 cen=a==0?uC1:uC2;
    vec3 oc=ro-cen; float b=dot(oc,rd), c=dot(oc,oc)-23.*23., h=b*b-c;
    if(h<=0.) continue;
    h=sqrt(h); float t0=max(-b-h,0.), t1=-b+h; if(t1<=0.) continue;
    const int STEPS=50; float dt=(t1-t0)/float(STEPS);
    vec3 acc=vec3(0);
    for(int i=0;i<STEPS;i++){
      vec3 p=ro+rd*(t0+(float(i)+j)*dt);
      vec3 q1=p-uC1; q1.xz=RA*q1.xz; q1.yz=rot(.35)*q1.yz;
      vec3 q2=p-uC2; q2.xz=RB*q2.xz; q2.xy=rot(.5)*q2.xy;
      float r1=a==0?orb(q1):0.;
      float r2=a==1?orb(q2)*uW2:0.;
      float sh=.8+.4*noise3(p*.35+vec3(0,uTime*.25,0));
      float dens=(r1+r2)*uDens*sh;
      vec3 cc=mix(vec3(.03,.12,.9),vec3(.35,.85,1.),clamp(dens*2.5,0.,1.));
      acc+=cc*dens*sqrt(dens)*dt*.5;
      if(a==0 && uOverlap>0.) acc+=vec3(1.,.5,.2)*sqrt(r1*orb(q2)*uW2)*uOverlap*dt*3.;
      vec3 sp3=p*2.4; vec3 sc3=floor(sp3); vec3 sj=hash33(sc3+floor(uTime*10.)*.37);
      float sd=length(fract(sp3)-.2-.6*sj);
      acc+=vec3(.65,.88,1.)*step(.8,sj.x)*smoothstep(.16,.0,sd)*min(dens*3.,1.)*uSpark*dt*7.;
    }
    col+=acc;
  }
  col+=nucleusGlow(uC1,ro,rd,uv,fl)*uNuc;
  if(uW2>.001) col+=nucleusGlow(uC2,ro,rd,uv,fl)*uNuc*uW2;
  fragColor=vec4(col,1);
}`);
  // camera + atom positions as functions of time
  function state(t) {
    const tw = K.never - 0.25;
    const sepF = t < tw ? 170 :
      t < K.force ? lerp(170, 33, easeOut((t - tw) / (K.force - tw))) :
      t < K.pushing ? lerp(33, 30.5, easeOut((t - K.force) / (K.pushing - K.force))) :
      t < K.pushing + 0.7 ? lerp(30.5, 41, easeOut((t - K.pushing) / 0.7)) :
      lerp(41, 190, easeIn((t - K.pushing - 0.7) / 1.4));
    const mm = sstep(tw - 0.3, tw + 1.4, t) * (1 - sstep(K.pushing + 0.6, K.go + 0.2, t));
    const c1x = -0.5 * Math.min(sepF, 41) * mm;
    const C1 = [c1x, 0, 0], C2 = [c1x + sepF, 0, 0];
    const taX = c1x + 0.5 * Math.min(sepF, 41) * mm;
    let D;
    if (t < K.every + 1.2) D = lerp(7, 31, easeOut((t - K.atoms + 0.6) / (K.every + 1.8 - K.atoms)));
    else if (t < tw) D = lerp(31, 34, (t - K.every - 1.2) / (tw - K.every - 1.2));
    else if (t < K.pushing + 0.6) D = lerp(34, 64, easeInOut((t - tw) / 2.2));
    else D = lerp(64, 2.2, easeIn((t - K.pushing - 0.6) / (K.go + 0.9 - K.pushing - 0.6)));
    const a = 0.35 + t * 0.045, e = 0.18 + 0.05 * Math.sin(t * 0.3);
    const ta = [taX, 0, 0];
    const ro = [ta[0] + D * Math.sin(a) * Math.cos(e), D * Math.sin(e), ta[2] - D * Math.cos(a) * Math.cos(e)];
    return { C1, C2, ta, ro, mm, sep: sepF };
  }
  return {
    state, scale,
    draw(t) {
      const s = state(t);
      const touch = Math.exp(-Math.pow((t - K.force - 0.15) / 0.35, 2));
      const overlap = sstep(K.never + 1.2, K.force, t) * (1 - sstep(K.pushing + 0.3, K.pushing + 1.0, t)) * (0.6 + 1.8 * touch);
      const emptyK = sstep(K.every + 0.4, K.empty, t) * (1 - sstep(K.never - 0.5, K.never + 0.6, t));
      drawFS(fs, {
        uTime: t, uRo: s.ro, uTa: s.ta, uC1: s.C1, uC2: s.C2, uW2: s.mm,
        uDens: lerp(1.0, 0.32, emptyK) * sstep(K.atoms - 0.7, K.atoms + 0.2, t), uOverlap: overlap,
        uNuc: lerp(1.0, 2.6, emptyK) + 2.5 * sstep(K.pushing + 0.8, K.go + 0.6, t), uRotA: t * 0.12, uSpark: 0.4 + emptyK * 1.6,
      });
    },
    labels(t) {
      const s = state(t);
      return { nucleus: projectPx(s.C1, s.ro, s.ta, 1.5) };
    },
  };
})();

// ───────────────────────── Scene 2 : quantum fields ─────────────────────────
const PACKETS = [
  [0, 3, K.balls + 0.15, 0.55], [-3.5, 6.5, K.ripples + 0.1, 0.42], [4.2, 7.5, K.ripples + 0.7, 0.38],
  [-5.5, 10.5, K.fields - 0.3, 0.5], [2.5, 12, K.fields + 0.3, 0.42], [6.5, 4.5, K.clouds - 0.2, 0.3],
  [0, 3, K.seen + 0.08, 0.6], [-6, 3.5, K.matter, 0.35],
];
const S2 = (() => {
  const fs = fsProgram(`
uniform vec3 uRo, uTa; uniform vec4 uPk[8]; uniform float uBall, uBallDis, uLayer2, uCloud, uCollapse, uFade;
float field(vec2 xz, float t){
  float h=.05*sin(xz.x*.7+t*.8)*sin(xz.y*.6-t*.6)+.03*sin(xz.x*1.7-xz.y*1.3+t*1.2);
  for(int i=0;i<8;i++){
    vec4 k=uPk[i]; float age=t-k.z; if(age<0.) continue;
    float r=length(xz-k.xy); float x=r-age*2.3;
    h+=k.w*exp(-x*x*.55)*exp(-age*.22)*cos(x*4.2)/(1.+r*.12);
  }
  return h;
}
vec3 gridCol(vec2 xz, float hgt, float dist, vec3 tint, float scale){
  vec2 g=xz*scale; vec2 fw=fwidth(g);
  vec2 d=abs(fract(g-.5)-.5);
  vec2 l=1.-smoothstep(vec2(0.),fw*1.3+.015,d);
  float line=max(l.x,l.y);
  float alias=smoothstep(.18,.55,max(fw.x,fw.y));
  line=mix(line,.12,alias);
  float energy=.18+2.8*abs(hgt);
  vec3 c=tint*line*energy+tint*.012;
  c+=vec3(1.,.95,.9)*line*smoothstep(.25,.6,abs(hgt))*.8;
  return c*exp(-dist*.085);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=uRo; vec3 rd=camRay(uv,ro,uTa,1.45);
  vec3 col=vec3(.0015,.002,.005)+vec3(.01,.004,.02)*(1.-abs(uv.y)*1.5);
  // layer 1 heightfield
  float t=0.; bool hit=false;
  if(rd.y<-.005){
    float h=0.;
    for(int i=0;i<7;i++){ t=(ro.y-h)/-rd.y; vec3 p=ro+rd*t; h=mix(h,field(p.xz,uTime),.85); }
    t=(ro.y-h)/-rd.y; hit=t<90.;
  }
  // layer 2 (another field, below)
  if(rd.y<0.){
    float t2=(ro.y+1.4)/-rd.y; vec3 p2=ro+rd*t2;
    float h2=.6*field(p2.xz*.8+3.,uTime-.4);
    p2=ro+rd*((ro.y+1.4-h2)/-rd.y);
    col+=gridCol(p2.xz+.25,h2,t2,vec3(.9,.2,1.)*.8,1.6)*uLayer2*.8;
  }
  if(hit){ vec3 p=ro+rd*t; col+=gridCol(p.xz,p.y,t,vec3(.15,.6,1.),2.); }
  // the "ball" that turns out not to be a ball
  if(uBall>0.){
    vec3 bc=vec3(0,.62+.04*sin(uTime*2.),3.); float br=.45;
    vec3 oc=ro-bc; float b=dot(oc,rd), c=dot(oc,oc)-br*br, h=b*b-c;
    if(h>0.){
      float tb=-b-sqrt(h); vec3 p=ro+rd*tb; vec3 n=normalize(p-bc);
      float dn=fbm3(n*2.5+3.);
      if(dn>uBallDis && (!hit || tb<t)){
        float fr=pow(1.-max(dot(n,-rd),0.),2.5);
        vec3 bcol=vec3(.06,.08,.12)+vec3(.5,.8,1.)*fr*1.6+vec3(1.)*pow(max(dot(reflect(rd,n),normalize(vec3(-.4,.8,-.3))),0.),30.);
        bcol+=vec3(.3,.7,1.)*5.*smoothstep(.06,0.,dn-uBallDis)*step(-.05,uBallDis);
        col=mix(col,bcol,uBall);
      }
    }
  }
  // probability cloud glow + collapse flash
  vec3 cc=vec3(0,1.15,3.); float dm=length(cross(rd,cc-ro));
  col+=vec3(.35,.3,1.)*exp(-dm*dm*1.6)*uCloud*.35;
  col+=vec3(.9,.95,1.)*(.0015/(dm*dm+.0012))*uCollapse;
  fragColor=vec4(col*uFade,1);
}`);
  const N = 14000, r = rng(23);
  const rnd = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) rnd[i] = r();
  const cloud = makeCloud(`
in vec4 aR; uniform float uSig, uA, uQ; out vec3 vCol; out float vA;
void main(){
  vec3 g=vec3(0);
  for(int k=0;k<3;k++){ float fk=float(k); g+=vec3(hash21(aR.xy*97.+uQ+fk*1.3),hash21(aR.yz*91.+uQ*1.7+fk),hash21(aR.zw*89.+uQ*2.3+fk*2.));}
  g=(g-1.5)*1.15;
  vec3 p=vec3(0,1.15,3.)+g*uSig*vec3(1.,.75,1.);
  float z; gl_Position=project(p,z);
  gl_PointSize=clamp(.012*uFl/z*uRes.y,1.,6.);
  vA=uA*(.4+.6*aR.w); vCol=mix(vec3(.45,.35,1.),vec3(.7,.9,1.),aR.x)*1.6;
}`, { aR: { data: rnd, size: 4 } }, N);
  function cam(t) {
    const t0 = K.go + 0.3;
    const k = easeOut((t - t0) / 3.2);
    const ro = [0.6 * Math.sin(t * 0.21), lerp(7.5, 2.3, k), lerp(-1.0, -5.6, k) + (t - t0) * 0.22];
    const ta = [0, lerp(-2.5, 0.25, k), ro[2] + lerp(4.5, 9, k)];
    return { ro, ta };
  }
  const pk = new Float32Array(32);
  PACKETS.forEach((p, i) => pk.set(p, i * 4));
  return {
    cam,
    draw(t) {
      const c = cam(t);
      const collapseT = K.seen + 0.05;
      const sig = t < collapseT ? 1.05 + 0.08 * Math.sin(t * 3) : lerp(1.05, 0.006, easeOut((t - collapseT) / 0.18));
      gl.useProgram(fs); gl.uniform4fv(fs.loc('uPk'), pk);
      drawFS(fs, {
        uTime: t, uRo: c.ro, uTa: c.ta, uFade: sstep(K.go + 0.2, K.go + 1.4, t),
        uBall: sstep(K.particles - 0.5, K.particles, t), uBallDis: -0.1 + 1.25 * clamp01((t - K.balls + 0.05) / 0.6),
        uLayer2: sstep(K.fields - 0.6, K.fields + 0.4, t),
        uCloud: sstep(K.clouds - 0.4, K.clouds + 0.4, t) * (1 - sstep(collapseT, collapseT + 0.2, t)),
        uCollapse: t > collapseT ? (2.5 * Math.exp(-(t - collapseT) * 6) + 0.6) : 0,
      });
      cloud.draw({
        uTime: t, uRo: c.ro, uTa: c.ta, uFl: 1.45, uQ: Math.floor(t * 30) * 0.731, uSig: sig,
        uA: sstep(K.clouds - 0.4, K.clouds + 0.3, t) * (t < collapseT ? 0.55 : 2.0),
      });
    },
    labels(t) { const c = cam(t); return { cloud: projectPx([0, 1.15, 3], c.ro, c.ta, 1.45) }; },
  };
})();

// ───────────────────────── Scene 3 : perception ─────────────────────────
const S3 = (() => {
  const fs = fsProgram(`
uniform float uWaves, uDots, uDark;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 col=vec3(.004,.004,.005)*(1.-uDark)+vec3(.006,.0,.002)*uDark*(1.-length(uv));
  if(uWaves>0.){
    for(int i=0;i<5;i++){
      float fi=float(i); float y0=.25-fi*.125; float lam=.21-fi*.03;
      float y=y0+.03*sin(TAU/lam*uv.x-uTime*2.4+fi*1.3);
      float d=abs(uv.y-y);
      float g=exp(-d*d*6e4)*1.1+exp(-d*d*1.8e3)*.1;
      g*=ss(-.92,-.55,uv.x)*(1.-ss(.45,.7,uv.x));
      col+=vec3(.92,.93,.96)*g*uWaves;
    }
  }
  if(uDots>0.){
    float s=.026, A=.011, k=TAU/.36, w=uTime*3.2;
    float x0=uv.x-A*sin(k*uv.x-w);
    float cx=floor(x0/s+.5); float cy=floor(uv.y/s+.5);
    float px=cx*s+A*sin(k*cx*s-w);
    float d=length(uv-vec2(px,cy*s));
    float comp=.5+.5*cos(k*cx*s-w);
    col+=vec3(.85)*smoothstep(.0042,.0018,d)*uDots*(.25+.75*comp)*(1.-ss(.3,.46,abs(uv.y)))*(1.-ss(.65,.85,abs(uv.x)));
  }
  fragColor=vec4(col,1);
}`);
  // neurons in two hemispheres
  const r = rng(7), N = 1500;
  const pos = [];
  while (pos.length < N) {
    const p = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1];
    const rr = Math.hypot(p[0], p[1], p[2]);
    if (rr > 1 || rr < 0.35 && r() < 0.8) continue;
    const side = r() < 0.5 ? -1 : 1;
    pos.push([side * 0.52 + p[0] * 0.9, p[1] * 0.78 + 0.05 * Math.sin(p[2] * 6), p[2] * 1.2]);
  }
  const nPos = new Float32Array(N * 3), nR = new Float32Array(N * 4);
  pos.forEach((p, i) => { nPos.set(p, i * 3); nR.set([r(), r(), r(), r()], i * 4); });
  const edges = [];
  for (let i = 0; i < N; i++) {
    const ds = [];
    for (let j = 0; j < N; j++) if (j !== i) { const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1], pos[i][2] - pos[j][2]); ds.push([d, j]); }
    ds.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) if (i < ds[k][1] || k === 0) edges.push([i, ds[k][1]]);
  }
  const E = edges.length;
  const lPos = new Float32Array(E * 6), lR = new Float32Array(E * 8);
  const pA = new Float32Array(E * 3), pB = new Float32Array(E * 3), pR = new Float32Array(E * 4);
  edges.forEach(([a, b], i) => {
    lPos.set(pos[a], i * 6); lPos.set(pos[b], i * 6 + 3);
    const rr = [r(), r(), r(), r()]; lR.set(rr, i * 8); lR.set(rr, i * 8 + 4);
    pA.set(pos[a], i * 3); pB.set(pos[b], i * 3); pR.set([r(), r(), r(), r()], i * 4);
  });
  const COLOR = `
uniform float uPaint, uPaintT;
vec3 paint(vec3 p, float seed){
  float front=uPaintT*1.4; float k=uPaint*smoothstep(front,front-.5,length(p));
  vec3 c=hsv(fract(.55+p.x*.18+p.y*.25+p.z*.12+seed*.15),.75,1.);
  return mix(vec3(.75,.77,.8),c,k);
}`;
  const neurons = makeCloud(COLOR + `
in vec3 aP; in vec4 aR; uniform float uA; uniform vec3 uMask; out vec3 vCol; out float vA;
void main(){
  float z; gl_Position=project(aP,z);
  float fire=pow(hash11(floor(uTime*5.+aR.x*40.)+aR.y*13.),10.);
  gl_PointSize=clamp((.02+.02*aR.z+.05*fire)*uFl/z*uRes.y,1.,14.);
  vCol=paint(aP,aR.w)*(1.+fire*5.)*uMask; vA=uA*(.25+.5*aR.z);
}`, { aP: { data: nPos, size: 3 }, aR: { data: nR, size: 4 } }, N);
  const lines = makeCloud(COLOR + `
in vec3 aP; in vec4 aR; uniform float uA; uniform vec3 uMask; out vec3 vCol; out float vA;
void main(){ float z; gl_Position=project(aP,z); vCol=paint(aP,aR.w)*uMask; vA=uA*.10; }`,
    { aP: { data: lPos, size: 3 }, aR: { data: lR, size: 4 } }, E * 2, gl.LINES);
  const pulses = makeCloud(COLOR + `
in vec3 aA; in vec3 aB; in vec4 aR; uniform float uA; uniform vec3 uMask; out vec3 vCol; out float vA;
void main(){
  float ph=fract(uTime*(.35+.6*aR.x)+aR.y); vec3 p=mix(aA,aB,ph);
  float z; gl_Position=project(p,z);
  gl_PointSize=clamp(.03*uFl/z*uRes.y,1.,10.);
  vCol=paint(p,aR.w)*2.2*uMask; vA=uA*sin(ph*PI)*step(.45,aR.z);
}`, { aA: { data: pA, size: 3 }, aB: { data: pB, size: 3 }, aR: { data: pR, size: 4 } }, E);
  function cam(t) {
    const a = 0.4 + t * 0.12;
    const D = lerp(5.6, 4.0, easeOut((t - K.brain + 0.5) / 4));
    return { ro: [Math.sin(a) * D, 0.7, -Math.cos(a) * D], ta: [0, 0, 0] };
  }
  return {
    draw(t) {
      const brainA = sstep(K.brain - 0.7, K.brain + 0.3, t);
      drawFS(fs, {
        uTime: t, uWaves: sstep(K.color - 0.3, K.color + 0.2, t) * (1 - sstep(K.sound - 0.35, K.sound + 0.1, t)),
        uDots: sstep(K.sound - 0.2, K.sound + 0.3, t) * (1 - sstep(K.brain - 0.4, K.brain + 0.2, t)),
        uDark: brainA,
      });
      if (brainA <= 0) return;
      const echo = sstep(K.shows - 0.2, K.world + 0.3, t);
      const paintU = { uPaint: sstep(K.paints - 0.2, K.paints + 0.4, t), uPaintT: Math.max(0, t - K.paints + 0.2) };
      const passes = echo > 0 ? [[0, [1, 0.25, 0.25]], [0.11, [0.25, 1, 0.25]], [0.22, [0.25, 0.25, 1]]] : [[0, [1, 1, 1]]];
      for (const [dly, mask] of passes) {
        const m = echo > 0 ? mask.map((c) => lerp(1, c, echo) * (dly ? echo : 1)) : mask;
        const tt = t - dly * echo, c = cam(tt);
        const u = Object.assign({ uTime: tt, uRo: c.ro, uTa: c.ta, uFl: 1.7, uA: brainA, uMask: m }, paintU);
        lines.draw(u); neurons.draw(u); pulses.draw(u);
      }
    },
  };
})();
