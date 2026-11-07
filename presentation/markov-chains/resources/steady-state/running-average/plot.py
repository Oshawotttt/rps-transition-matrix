"""Running average (1/N) sum_{t=0}^{N-1} x_t approaching pi. Writes data.csv, running-average.png."""
import csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
M = np.array([[.7, .4, .2], [.2, .5, .1], [.1, .1, .7]])
NAMES = ["Rock", "Paper", "Scissors"]
COLORS = ["#2a78d6", "#d9572b", "#1b9e77"]
MARKERS = ["o", "s", "^"]
N = 60

x, total, avgs = np.array([1., 0., 0.]), np.zeros(3), []
for _ in range(N):
    total = total + x
    avgs.append(total / (len(avgs) + 1))
    x = M @ x
avgs = np.array(avgs)
Ts = np.arange(1, N + 1)
with open(HERE / "data.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["N", "rock", "paper", "scissors"])
    for n, a in zip(Ts, avgs):
        w.writerow([n, *np.round(a, 6)])

fig, ax = plt.subplots(figsize=(10, 5.6), dpi=150)
for i in range(3):
    ax.plot(Ts, avgs[:, i], color=COLORS[i], lw=2, marker=MARKERS[i], ms=5, markevery=15, label=NAMES[i])
ax.axhline(.5, color="#8a8981", lw=1, ls="--")
ax.axhline(.25, color="#8a8981", lw=1, ls="--")
ax.text(N + 1, .5, "Rock 0.50", va="center", color="#0b0b0b", bbox=dict(fc="white", ec="none", pad=2))
ax.text(N + 1, .25, "Paper, Scissors\n0.25", va="center", color="#0b0b0b", bbox=dict(fc="white", ec="none", pad=2))
ax.set_xlim(0, N + 11)
ax.set_ylim(0, 1.02)
ax.set_xticks(range(0, N + 1, 15))
ax.set_xlabel("Moves averaged, N", color="#52514e")
ax.set_ylabel("Average probability", color="#52514e")
ax.grid(axis="y", color="#e6e5e0", lw=.8)
ax.set_axisbelow(True)
ax.tick_params(colors="#52514e", length=0)
for s in ["top", "right", "left"]:
    ax.spines[s].set_visible(False)
ax.spines["bottom"].set_color("#b5b4ad")
ax.legend(frameon=False, loc="upper right", ncol=3)
fig.tight_layout()
fig.savefig(HERE / "running-average.png")
