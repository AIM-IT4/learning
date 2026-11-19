
      // ---- the HUD scene scaffold (shared by every scene; keep it as is) ----
      const { HOLO, HUD, MKM } = HOLOHUD;
      const T = HUD.theme(218, 22), WF = 1080, HF = 1920, FPS = 24;
      const holo = new HOLO.Holo(WF, HF);
      const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
      const eo = (x) => 1 - Math.pow(1 - clamp(x), 3), eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
      // HOME: every scene starts and ends on this camera, so the projector pad never jumps at a cut
      const HOME = { target: [0, 0.5, 0], yaw: 0.35, pitch: 0.32, dist: 7.6, fov: 0.62, cx: 540, cy: 1010 };
      const camMix = (a, b, k) => ({ target: a.target.map((v, i) => lerp(v, b.target[i], k)), yaw: lerp(a.yaw, b.yaw, k), pitch: lerp(a.pitch, b.pitch, k),
        dist: lerp(a.dist, b.dist, k), fov: lerp(a.fov, b.fov, k), cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k) });
      // build a model from MKM primitives in world units (no normalising: heights stay honest), ready for holo.draw
      const build = (fn) => { const m = new MKM.Model("m"); fn(m); return HOLO.prepModel(m.toJSON()); };
      // scan in over the first 0.6 s (the scan plane grows the subject), erase over the last 0.4 s; yTop = the subject's height
      const scanState = (t, yTop) => {
        const kin = clamp(t / 0.6), kout = clamp((t - (DUR - 0.42)) / 0.4);
        if (kout > 0) return { scanDown: { y: lerp(yTop + 0.1, -0.05, eio(kout)) }, plane: lerp(yTop + 0.1, -0.05, eio(kout)), planeA: 1 - 0.3 * kout };
        if (kin < 1) return { scan: { y: lerp(-0.05, yTop + 0.12, eio(kin)), band: 0.07 }, plane: lerp(-0.05, yTop + 0.12, eio(kin)), planeA: 1 };
        return {};
      };
      const P3 = (cam, x, y, z) => { const c = HOLO.makeCamera(cam, WF, HF), o = new Float32Array(3); c.project(x, y, z, o); return [o[0], o[1], o[2]]; };
