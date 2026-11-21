import json, sys, numpy as np
sys.path.insert(0, 'work'); import cva_reel as m
from math import sqrt, pi, erf
v = m.swap_values(10_000); ee = m.exposure(v); pd = m.default_prob(); dpd = np.diff(pd, prepend=0)
df = np.exp(-m.r * m.t); contrib = (1 - m.R) * df * ee * dpd; c = m.cva()
lam = m.S / (1 - m.R)
ee_an = m.N * (m.T - m.t) * m.VOL * np.sqrt(m.t) / sqrt(2 * pi)
cva_an = (1 - m.R) * np.sum(df * ee_an * dpd)
pfe = np.percentile(v, 95, axis=0)
ann = sum(np.exp(-m.r * k) for k in range(1, 6))
k = int(np.argmax(ee))
rng = np.random.default_rng(7); z = rng.normal(size=(10_000, 60))
dx = m.VOL * np.sqrt(m.T / 60) * z.cumsum(1)
sel = list(range(40))
out = dict(
  N=m.N, T=m.T, VOL=m.VOL, R=m.R, S=m.S, r=m.r, paths=10_000, seed=7, months=60,
  lam=lam, pd5=float(pd[-1]), cva_m=float(c), cva_usd=float(c * 1e6), cva_bp=float(c / m.N * 1e4),
  running_bp=float(c / (m.N * ann) * 1e4), annuity=float(ann), cva_analytic_m=float(cva_an),
  ee_peak_m=float(ee[k]), ee_peak_t=float(m.t[k]), ee_an_peak_m=float(ee_an.max()), ee_an_peak_t=float(m.t[int(np.argmax(ee_an))]),
  pfe_peak_m=float(pfe.max()), pfe_peak_t=float(m.t[int(np.argmax(pfe))]),
  share_paths_owing_at_peak=float((v[:, k] > 0).mean()),
  t=[round(float(x), 4) for x in m.t],
  ee=[round(float(x), 5) for x in ee], ee_an=[round(float(x), 5) for x in ee_an], pfe95=[round(float(x), 5) for x in pfe],
  pd=[round(float(x), 6) for x in pd], dpd=[round(float(x), 7) for x in dpd], df=[round(float(x), 6) for x in df],
  contrib=[round(float(x), 7) for x in contrib], cum=[round(float(x), 6) for x in np.cumsum(contrib)],
  rate_paths_pct=[[round(float(x) * 100, 4) for x in dx[i]] for i in sel],
  value_paths_m=[[round(float(x), 4) for x in v[i]] for i in sel],
)
json.dump(out, open('work/numbers.json', 'w'))
for kk in ['lam','pd5','cva_m','cva_usd','cva_bp','running_bp','annuity','cva_analytic_m','ee_peak_m','ee_peak_t','ee_an_peak_m','ee_an_peak_t','pfe_peak_m','pfe_peak_t','share_paths_owing_at_peak']:
    print(f'{kk:28s} {out[kk]}')
print('EE at 1y, 2.5y, 4y:', [round(float(ee[i]),4) for i in (11, 29, 47)])
