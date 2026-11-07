"""0.6^t vs 0.3^t. Writes data.csv, eigen-decay.png."""
import csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
t = np.arange(0, 16)
a, b = .6 ** t, .3 ** t
with open(HERE / "data.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["t", "lambda_0.6", "lambda_0.3"])
    for row in zip(t, a, b):
        w.writerow([row[0], round(row[1], 8), round(row[2], 8)])

fig, ax = plt.subplots(figsize=(10, 5.6), dpi=150)
ax.plot(t, a, color="#6250d6", lw=2, marker="o", ms=6, label=r"$0.6^t$")
ax.plot(t, b, color="#eda100", lw=2, marker="s", ms=6, label=r"$0.3^t$")
ax.axvline(5, color="#8a8981", lw=1, ls=":")
ax.text(5.2, .3, "After 5 transitions:\n" + r"$0.6^5 \approx 0.078$" + "\n" + r"$0.3^5 \approx 0.002$",
        va="center", color="#0b0b0b", fontsize=13)
ax.set_xlim(0, 15.5)
ax.set_ylim(0, 1.02)
ax.set_xlabel("Transitions, t", color="#52514e")
ax.set_ylabel("Remaining size of component", color="#52514e")
ax.grid(axis="y", color="#e6e5e0", lw=.8)
ax.set_axisbelow(True)
ax.tick_params(colors="#52514e", length=0)
for s in ["top", "right", "left"]:
    ax.spines[s].set_visible(False)
ax.spines["bottom"].set_color("#b5b4ad")
ax.legend(frameon=False, loc="upper right", fontsize=13)
fig.tight_layout()
fig.savefig(HERE / "eigen-decay.png")
