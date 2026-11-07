"""x_t split into its three eigen-components, at t = 0, 1, 3, 10. Writes data.csv, eigen-components.png."""
import csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
PI = np.array([.5, .25, .25])
V2 = np.array([2., 1., -3.])
V3 = np.array([1., -1., 0.])
COLORS = ["#2a78d6", "#d9572b", "#1b9e77"]
TS = [0, 1, 3, 10]
ROWS = [r"$\mathbf{\pi}$", r"$\frac{1}{12}(0.6)^t\mathbf{v}_2$", r"$\frac{1}{3}(0.3)^t\mathbf{v}_3$", r"$\mathbf{x}_t$"]


def parts(t):
    a, b = (.6 ** t) / 12 * V2, (.3 ** t) / 3 * V3
    return [PI, a, b, PI + a + b]


with open(HERE / "data.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["t", "component", "rock", "paper", "scissors"])
    for t in TS:
        for name, p in zip(["pi", "v2_term", "v3_term", "x_t"], parts(t)):
            w.writerow([t, name, *np.round(p, 6)])

fig, axes = plt.subplots(4, 4, figsize=(10, 5.6), dpi=150, sharex=True, sharey=True)
for c, t in enumerate(TS):
    for r, p in enumerate(parts(t)):
        ax = axes[r, c]
        ax.bar(["R", "P", "S"], p, color=COLORS, width=.55)
        ax.axhline(0, color="#8a8981", lw=.8)
        ax.set_ylim(-.3, 1.05)
        ax.set_yticks([])
        ax.tick_params(colors="#52514e", length=0)
        for s in ["top", "right", "left", "bottom"]:
            ax.spines[s].set_visible(False)
        if r == 0:
            ax.set_title(f"t = {t}", color="#0b0b0b")
        if c == 0:
            ax.set_ylabel(ROWS[r], rotation=0, ha="right", va="center", fontsize=12, color="#0b0b0b")
fig.tight_layout()
fig.savefig(HERE / "eigen-components.png")
