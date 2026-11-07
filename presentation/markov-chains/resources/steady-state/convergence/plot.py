"""RPS state distribution x_t converging to pi. Writes data.csv, convergence.png, convergence.gif."""
import csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter

HERE = Path(__file__).parent
M = np.array([[.7, .4, .2], [.2, .5, .1], [.1, .1, .7]])
NAMES = ["Rock", "Paper", "Scissors"]
COLORS = ["#2a78d6", "#d9572b", "#1b9e77"]
MARKERS = ["o", "s", "^"]
T = 20

xs = [np.array([1., 0., 0.])]
for _ in range(T):
    xs.append(M @ xs[-1])
xs = np.array(xs)
with open(HERE / "data.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["t", "rock", "paper", "scissors"])
    for t, x in enumerate(xs):
        w.writerow([t, *np.round(x, 6)])


def base():
    fig, ax = plt.subplots(figsize=(10, 5.6), dpi=150)
    ax.set_xlim(0, T + 3.5)
    ax.set_ylim(0, 1.02)
    ax.set_xticks(range(0, T + 1, 5))
    ax.set_xlabel("Transitions, t", color="#52514e")
    ax.set_ylabel("Probability", color="#52514e")
    ax.grid(axis="y", color="#e6e5e0", lw=.8)
    ax.set_axisbelow(True)
    ax.tick_params(colors="#52514e", length=0)
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color("#b5b4ad")
    ax.axhline(.5, color="#8a8981", lw=1, ls="--")
    ax.axhline(.25, color="#8a8981", lw=1, ls="--")
    ax.text(T + .4, .5, "Rock 0.50", va="center", color="#0b0b0b", bbox=dict(fc="white", ec="none", pad=2))
    ax.text(T + .4, .25, "Paper, Scissors\n0.25", va="center", color="#0b0b0b", bbox=dict(fc="white", ec="none", pad=2))
    return fig, ax


# Static chart
fig, ax = base()
for i in range(3):
    ax.plot(range(T + 1), xs[:, i], color=COLORS[i], lw=2, marker=MARKERS[i], ms=5,
            markevery=5, label=NAMES[i])
ax.legend(frameon=False, loc="upper right", ncol=3)
fig.tight_layout()
fig.savefig(HERE / "convergence.png")
plt.close(fig)

# Animated version: the same chart drawn one transition per frame
fig, ax = base()
lines = [ax.plot([], [], color=COLORS[i], lw=2, marker=MARKERS[i], ms=5, markevery=[-1],
                 label=NAMES[i])[0] for i in range(3)]
ax.legend(frameon=False, loc="upper right", ncol=3)
label = ax.text(.97, .85, "", transform=ax.transAxes, ha="right", va="top", color="#0b0b0b")
fig.tight_layout()


def draw(n):
    n = min(n, T)
    for i, line in enumerate(lines):
        line.set_data(range(n + 1), xs[:n + 1, i])
    label.set_text(f"t = {n}\nRock {xs[n, 0]:.3f}\nPaper {xs[n, 1]:.3f}\nScissors {xs[n, 2]:.3f}")
    return (*lines, label)


FuncAnimation(fig, draw, frames=T + 9, blit=False).save(
    HERE / "convergence.gif", writer=PillowWriter(fps=3), dpi=72)
plt.close(fig)
