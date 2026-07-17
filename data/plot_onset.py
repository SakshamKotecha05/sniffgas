# Q1 check: does UCI #322 ethylene_CO show a sensor ramp after a step setpoint?
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

PATH = sys.argv[1]
OUT = sys.argv[2]

# format: Time(s)  CO_ppm  Ethylene_ppm  16 sensor channels
df = pd.read_csv(PATH, sep=r"\s+", skiprows=1, header=None, engine="c")
df.columns = ["t", "co", "eth"] + [f"s{i}" for i in range(16)]
print(f"rows={len(df)}  t=[{df.t.min():.1f},{df.t.max():.1f}]s  "
      f"CO setpoints={sorted(df.co.unique())[:12]}...  n_levels={df.co.nunique()}")

# find CO onsets: setpoint rises from 0 to something
co = df.co.values
onsets = np.where((co[:-1] == 0) & (co[1:] > 0))[0] + 1
print(f"CO onsets (0 -> >0): {len(onsets)}")

# hold durations: how long does each setpoint level last?
change_idx = np.where(np.diff(co) != 0)[0] + 1
seg_dur = np.diff(df.t.values[change_idx])
print(f"setpoint hold durations: median={np.median(seg_dur):.1f}s  "
      f"p10={np.percentile(seg_dur,10):.1f}s  p90={np.percentile(seg_dur,90):.1f}s")

# pick 3 onsets with a decent target ppm, spread across the file
cand = [i for i in onsets if co[min(i + 500, len(co) - 1)] >= 100]
picks = [cand[len(cand)//4], cand[len(cand)//2], cand[3*len(cand)//4]] if len(cand) >= 3 else cand[:3]

# rise-time measurement on a few channels around each pick
chans = ["s2", "s7", "s11"]
fig, axes = plt.subplots(len(picks), 1, figsize=(11, 3.2 * len(picks)), sharex=False)
if len(picks) == 1:
    axes = [axes]
for ax, idx in zip(axes, picks):
    t0 = df.t.iloc[idx]
    win = df[(df.t >= t0 - 30) & (df.t <= t0 + 180)]
    ax2 = ax.twinx()
    ax2.plot(win.t - t0, win.co, "r-", lw=2, label="CO setpoint (ppm)")
    ax2.set_ylabel("CO setpoint ppm", color="r")
    for c in chans:
        base = win[win.t < t0][c].median()
        final = win[(win.t > t0 + 120) & (win.t < t0 + 175)][c].median()
        norm = (win[c] - base) / (final - base) if final != base else win[c] * 0
        ax.plot(win.t - t0, norm, lw=0.8, label=c)
        # time to 10% and 90% of final response
        after = win[win.t >= t0]
        na = (after[c] - base) / (final - base) if final != base else None
        if na is not None:
            t10 = after.t[na >= 0.1].iloc[0] - t0 if (na >= 0.1).any() else np.nan
            t90 = after.t[na >= 0.9].iloc[0] - t0 if (na >= 0.9).any() else np.nan
            print(f"onset@{t0:.0f}s target={co[min(idx+500,len(co)-1)]:.0f}ppm "
                  f"{c}: t10={t10:.1f}s t90={t90:.1f}s")
    ax.axhline(0.5, color="gray", ls=":", lw=0.7)
    ax.set_ylabel("normalized sensor response")
    ax.set_xlabel(f"seconds since setpoint step @ t={t0:.0f}s")
    ax.legend(loc="lower right", fontsize=8)
    ax2.legend(loc="upper left", fontsize=8)
fig.suptitle("UCI #322 ethylene_CO — CO setpoint step vs raw MOX response")
fig.tight_layout()
fig.savefig(OUT, dpi=110)
print(f"saved {OUT}")
