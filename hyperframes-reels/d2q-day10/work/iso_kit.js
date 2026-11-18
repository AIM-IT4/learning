// ISO KIT v1: isometric toy-world drawing on a 2D canvas, matching the Flow dioramas' look.
// Copy this block verbatim into a scene's <script> (inside its IIFE). World units: x to the right-back, y to the left-back,
// z up. P(x, y, z) -> frame px. Visible faces of a box: top, the face at y+d (front-left) and the face at x+w (front-right).
// Draw back to front: sort what you draw by (x + y) ascending, then z ascending (painter's order).
const ISO = (function () {
  const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
  const MAT = {
    white: { top: "#ffffff", left: "#e3ebfb", right: "#c9d8f5" },
    blue:  { top: "#7fb0ff", left: "#3b82f6", right: "#2563eb" },
    navy:  { top: "#4f6fe0", left: "#1e40af", right: "#1e3a8a" },
    sky:   { top: "#dbeafe", left: "#bfdbfe", right: "#93c5fd" },
    rose:  { top: "#fda4af", left: "#f43f5e", right: "#e11d48" },
    gold:  { top: "#fde68a", left: "#f59e0b", right: "#d97706" },
    grey:  { top: "#f1f5f9", left: "#cbd5e1", right: "#94a3b8" },
    wood:  { top: "#f3c58f", left: "#d99a5b", right: "#b97a3f" },
  };
  function make(g, ox, oy, u) {
    const P = (x, y, z) => [ox + (x - y) * C30 * u, oy + (x + y) * S30 * u - (z || 0) * u];
    function poly(pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1.5; g.stroke(); }
    }
    function box(x, y, z, w, d, h, mat, edge) {
      if (h <= 0 || w <= 0 || d <= 0) return;
      edge = edge === undefined ? "rgba(15,35,90,0.14)" : edge;
      poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], mat.left, edge);
      poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], mat.right, edge);
      poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], mat.top, edge);
    }
    // a soft contact shadow on the floor plane z
    function shadow(x, y, z, w, d, a) {
      const c = P(x + w / 2, y + d / 2, z); const rx = (w + d) * C30 * u * 0.55, ry = (w + d) * S30 * u * 0.55;
      const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], rx);
      gr.addColorStop(0, `rgba(30,64,175,${a || 0.18})`); gr.addColorStop(1, "rgba(30,64,175,0)");
      g.save(); g.translate(c[0], c[1]); g.scale(1, ry / rx); g.translate(-c[0], -c[1]);
      g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], rx, 0, 6.2832); g.fill(); g.restore();
    }
    // the floating platform: white top slab, blue band, white band, blue base (like the dioramas), its top at z = 0
    function platform(x, y, w, d) {
      box(x, y, -1.5, w, d, 0.42, MAT.blue);
      box(x, y, -1.08, w, d, 0.3, MAT.white);
      box(x, y, -0.78, w, d, 0.28, MAT.blue);
      box(x, y, -0.5, w, d, 0.5, MAT.white);
    }
    // a 2D affine matrix that maps a flat w x h DOM element onto a face given three projected corners (TL, TR, BL)
    function faceMatrix(tl, tr, bl, w, h) {
      const a = (tr[0] - tl[0]) / w, b = (tr[1] - tl[1]) / w, c = (bl[0] - tl[0]) / h, d = (bl[1] - tl[1]) / h;
      return `matrix(${a.toFixed(5)},${b.toFixed(5)},${c.toFixed(5)},${d.toFixed(5)},${tl[0].toFixed(2)},${tl[1].toFixed(2)})`;
    }
    return { P, poly, box, shadow, platform, faceMatrix, u };
  }
  return { make, MAT };
})();
