"""Draw the gesture illustrations used by docs/design-document.md.

Run: python docs/design/gestures.py   (writes docs/design/gestures/*.svg)
Colours are literal so the SVGs render on GitHub, where CSS variables don't exist.
"""
import pathlib

OUT = pathlib.Path(__file__).parent / "gestures"
INK, FILL, BG, DIM, ACC = "#1b1f22", "#ffffff", "#f1f3f4", "#9aa3a8", "#e0662f"

PALM = "M30 52 L70 50 L68 76 Q52 84 36 78 Z"
ARM = "M40 78 L62 78 L60 100 L42 100 Z"
POSES = {
    "open":  {"base": ["33,50 29,20", "44,47 44,12", "55,48 58,15", "66,52 72,28", "31,68 19,55 13,45"], "front": []},
    "fist":  {"base": [], "front": ["33,47 33,58", "44,45 44,57", "55,46 55,57", "66,49 65,58", "27,70 46,63"]},
    "pinch": {"base": ["33,50 25,29", "44,47 46,14", "55,48 59,17", "66,52 73,30", "31,68 18,49 23,33"], "front": []},
}
TIP = (24, 31)  # pinch contact point in hand space


def _path(pts):
    return "M" + " L".join(pts.split()).replace(",", " ")


def hand(pose, x, y, s=1.0, mirror=False, ghost=False, back=False):
    p = POSES[pose]

    def layer(lines, closed):
        ds = closed + [_path(l) for l in lines]
        return "".join(f'<path d="{d}" class="o"/>' for d in ds) + "".join(f'<path d="{d}" class="i"/>' for d in ds)

    body = layer(p["base"], [ARM, PALM]) + (layer(p["front"], []) if p["front"] else "")
    body += ('<path d="M34 56 h4 M45 54 h4 M56 55 h4 M65 58 h4" class="d"/>' if back
             else '<path d="M40 70 Q50 64 60 68" class="d"/>')
    sx, tx = (-s, x + 100 * s) if mirror else (s, x)
    op = ' opacity=".4"' if ghost else ""
    return f'<g transform="translate({tx} {y}) scale({sx} {s})"{op}>{body}</g>'


def tip(x, y, s, mirror=False):
    tx = x + (100 - TIP[0]) * s if mirror else x + TIP[0] * s
    return f'<circle cx="{tx:.1f}" cy="{y + TIP[1] * s:.1f}" r="6" class="dot"/>'


def arrow(d, dash=False):
    return f'<path d="{d}" class="a"{" stroke-dasharray=&quot;3 4&quot;" if dash else ""} marker-end="url(#m)"/>'


def ring(cx, cy, r, frac):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" class="track"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" class="prog" pathLength="100" stroke-dasharray="{frac * 100:.0f} 100" transform="rotate(-90 {cx} {cy})"/>')


def text(x, y, s, anchor="middle"):
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}">{s}</text>'


def svg(name, body, label, w=200, h=130):
    doc = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 1.4:.0f}" height="{h * 1.4:.0f}" role="img" aria-label="{label}">
<style>
.o{{fill:{INK};stroke:{INK};stroke-width:13;stroke-linecap:round;stroke-linejoin:round}}
.i{{fill:{FILL};stroke:{FILL};stroke-width:9.5;stroke-linecap:round;stroke-linejoin:round}}
.d{{fill:none;stroke:{DIM};stroke-width:1.6;stroke-linecap:round}}
.a{{fill:none;stroke:{ACC};stroke-width:2.6;stroke-linecap:round}}
.dot{{fill:{ACC}55;stroke:{ACC};stroke-width:2}}
.track{{fill:none;stroke:#d9dee1;stroke-width:4}}
.prog{{fill:none;stroke:{ACC};stroke-width:4;stroke-linecap:round}}
.box{{fill:{FILL};stroke:#c9d0d4;stroke-width:1.2}} .sel{{fill:{ACC}22;stroke:{ACC};stroke-width:1.5}} .ln{{fill:#c9d0d4}}
text{{font:600 11px system-ui,'Segoe UI',sans-serif;fill:{ACC}}}
</style>
<defs><marker id="m" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 4 L0 8 z" fill="{ACC}"/></marker></defs>
<rect width="{w}" height="{h}" rx="12" fill="{BG}"/>
{body}
</svg>
"""
    (OUT / f"{name}.svg").write_text(doc, encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    svg("arm", hand("open", 58, 14, 0.85) + ring(100, 60, 50, 0.7) + text(176, 122, "hold 0.6 s", "end"),
        "Hold an open palm still to arm")
    svg("pinch-drag", hand("pinch", 52, 28, 0.85, ghost=True) + hand("pinch", 52, 6, 0.85) + tip(52, 6, 0.85)
        + arrow("M160 108 V24") + text(170, 70, "drag", "start"),
        "Pinch and drag to scroll")
    svg("two-hand-zoom", hand("pinch", 6, 20, 0.7, mirror=True) + tip(6, 20, 0.7, mirror=True)
        + hand("pinch", 124, 20, 0.7) + tip(124, 20, 0.7)
        + arrow("M86 118 H40") + arrow("M114 118 H160") + text(100, 14, "pinch both, pull apart"),
        "Pinch with both hands and pull apart to zoom")
    svg("flip", hand("open", 10, 20, 0.7) + hand("open", 120, 20, 0.7, back=True, mirror=True)
        + '<path d="M70 26 Q100 4 130 26" class="a" marker-end="url(#m)"/>'
        + text(45, 124, "palm") + text(155, 124, "back"),
        "Turn the hand over to switch Raw and Preview")
    svg("both-palms", hand("open", 4, 18, 0.7, mirror=True) + hand("open", 126, 18, 0.7)
        + ring(100, 60, 22, 0.7) + text(100, 64, "0.5 s") + text(100, 124, "show both palms"),
        "Show both open palms to leave the file")
    svg("browse", '<rect x="112" y="12" width="78" height="104" rx="8" class="box"/>'
        + "".join(f'<rect x="120" y="{22 + k * 18}" width="{50 - (k % 2) * 12}" height="6" rx="3" class="ln"/>' for k in range(5))
        + '<rect x="116" y="51" width="70" height="16" rx="4" class="sel"/>'
        + hand("pinch", 4, 18, 0.85) + tip(4, 18, 0.85) + arrow("M98 92 V40"),
        "Pinch and drag to move through the file list")
    svg("grab", hand("open", 2, 16, 0.75) + arrow("M84 62 H112") + hand("fist", 112, 16, 0.75)
        + text(100, 124, "open, then close"),
        "Close an open hand to open the highlighted file")


if __name__ == "__main__":
    main()
