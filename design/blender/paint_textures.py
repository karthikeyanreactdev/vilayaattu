"""Paint the printed faces, costume fronts and cloths for the brick chess figures."""
import math, sys
from PIL import Image, ImageDraw
OUT = sys.argv[1]
SKIN = (246, 198, 36); BLACK = (24, 18, 14); GOLD = (214, 165, 49); GOLD2 = (240, 200, 90)
RED = (165, 18, 26); DRED = (110, 10, 18); GREEN = (24, 120, 60); WHITE = (243, 239, 230); BLK = (34, 32, 36)
S = 2  # supersample

def canvas(w, h, bg):
    im = Image.new("RGBA", (w * S, h * S), bg); return im, ImageDraw.Draw(im)
def save(im, name):
    w, h = im.size; im.resize((w // S, h // S), Image.LANCZOS).save(f"{OUT}/{name}.png")
def ell(d, cx, cy, rx, ry, fill): d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=fill)
def poly(d, pts, fill): d.polygon([(x * S, y * S) for x, y in pts], fill=fill)
def line(d, pts, fill, w): d.line([(x * S, y * S) for x, y in pts], fill=fill, width=int(w * S), joint="curve")
def rect(d, x0, y0, x1, y1, fill): d.rectangle([x0 * S, y0 * S, x1 * S, y1 * S], fill=fill)
def bez(p0, p1, p2, n=20): return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]

# ---- Faces: 512x256 decal covering the front of the head ----
def face(name, beard=True, stern=False, lady=False):
    im, d = canvas(512, 256, SKIN + (255,))
    cx = 256
    for dx in (-52, 52):
        ell(d, cx + dx, 112, 15, 19, BLACK); ell(d, cx + dx + 5, 105, 5, 5, (255, 255, 255))
    if lady:
        for dx in (-52, 52):
            for a in (-0.6, 0, 0.6):
                line(d, [(cx + dx + math.sin(a) * 14, 94), (cx + dx + math.sin(a) * 24, 84)], BLACK, 3)
            line(d, bez((cx + dx - 26, 84), (cx + dx, 66), (cx + dx + 26, 80)), BLACK, 4)
        ell(d, cx, 58, 7, 7, RED)
        poly(d, bez((cx - 34, 168), (cx, 196), (cx + 34, 168)) + bez((cx + 34, 168), (cx, 178), (cx - 34, 168)), RED)
        ell(d, cx - 70, 150, 16, 10, (240, 150, 60, 120)); ell(d, cx + 70, 150, 16, 10, (240, 150, 60, 120))
        save(im, name); return
    for s in (-1, 1):
        if stern: line(d, [(cx + s * 80, 74), (cx + s * 22, 88)], BLACK, 11)
        else: line(d, bez((cx + s * 78, 86), (cx + s * 52, 66), (cx + s * 22, 82)), BLACK, 10)
    # Moustache with curled ends.
    poly(d, bez((cx, 150), (cx - 50, 130), (cx - 98, 142)) + bez((cx - 98, 142), (cx - 50, 168), (cx, 160)) + bez((cx, 160), (cx + 50, 168), (cx + 98, 142)) + bez((cx + 98, 142), (cx + 50, 130), (cx, 150)), BLACK)
    if beard:
        poly(d, bez((cx - 112, 120), (cx - 106, 236), (cx, 252)) + bez((cx, 252), (cx + 106, 236), (cx + 112, 120)) + bez((cx + 112, 120), (cx + 74, 214), (cx, 216)) + bez((cx, 216), (cx - 74, 214), (cx - 112, 120)), BLACK)
        rect(d, cx - 30, 190, cx + 30, 216, BLACK)
    line(d, bez((cx - 18, 184), (cx, 186), (cx + 18, 184)), (90, 25, 15), 5)
    save(im, name)

face("face_soldier", beard=True)
face("face_mantri", beard=True)
face("face_raja", beard=True, stern=True)
face("face_rani", lady=True)

# ---- Costume fronts: 256x256 decal on the torso front ----
def border_band(d, x0, y0, x1, y1, col, dots=True):
    rect(d, x0, y0, x1, y1, col)
    if dots:
        step = 14
        if x1 - x0 > y1 - y0:
            for x in range(int(x0) + 7, int(x1), step): ell(d, x, (y0 + y1) / 2, 3, 3, RED)
        else:
            for y in range(int(y0) + 7, int(y1), step): ell(d, (x0 + x1) / 2, y, 3, 3, RED)

def necklace(d, cx, top, r, rows=3):
    for i in range(rows):
        pts = [(cx + math.cos(a) * (r + i * 12), top + math.sin(a) * (r + i * 12) * 0.9) for a in [math.pi * (0.15 + 0.7 * t / 30) for t in range(31)]]
        for p in pts[::2]: ell(d, p[0], p[1], 4, 4, GOLD2)
    ell(d, cx, top + r + rows * 12 + 4, 10, 12, RED); ell(d, cx, top + r + rows * 12 + 4, 14, 16, GOLD)
    ell(d, cx, top + r + rows * 12 + 4, 8, 10, RED)

def torso(name, base, kind):
    im, d = canvas(256, 256, base + (255,))
    if kind == "soldier":
        poly(d, [(60, 0), (128, 70), (196, 0)], GOLD); poly(d, [(80, 0), (128, 50), (176, 0)], base)
        poly(d, [(0, 0), (60, 0), (128, 256), (90, 256)], RED)             # diagonal sash
        line(d, [(60, 0), (128, 256)], GOLD, 5); line(d, [(0, 0), (90, 256)], GOLD, 5)
        border_band(d, 0, 200, 256, 226, GOLD); rect(d, 112, 196, 144, 230, RED); ell(d, 128, 213, 10, 10, GOLD)
        rect(d, 104, 226, 152, 256, RED)
    elif kind == "mantri":
        for x0 in (40, 150):  # red jacket panels with gold edges
            rect(d, x0, 0, x0 + 66, 256, RED); border_band(d, x0 + 54 if x0 < 100 else x0, 0, x0 + 66 if x0 < 100 else x0 + 12, 256, GOLD)
        necklace(d, 128, -30, 70, 2)
        border_band(d, 0, 196, 256, 224, GOLD); ell(d, 128, 210, 14, 14, RED); ell(d, 128, 210, 8, 8, GOLD)
        rect(d, 110, 224, 146, 256, GOLD)
    elif kind == "raja":
        rect(d, 0, 0, 256, 256, base); rect(d, 0, 0, 70, 256, RED); rect(d, 186, 0, 256, 256, RED)
        for x in (70, 180): border_band(d, x, 0, x + 6, 256, GOLD, dots=False)
        necklace(d, 128, -40, 70, 4)
        for x in (88, 168):
            for y in range(20, 190, 22): ell(d, x, y, 6, 6, GOLD2)
        border_band(d, 0, 196, 256, 228, GOLD); ell(d, 128, 212, 16, 16, GOLD); ell(d, 128, 212, 9, 9, (40, 120, 80))
        rect(d, 108, 228, 148, 256, GOLD)
    elif kind == "rani":
        poly(d, [(0, 0), (256, 0), (256, 256), (0, 256)], base)
        poly(d, [(40, 0), (110, 0), (256, 170), (256, 240)], RED)          # sari drape across the chest
        line(d, [(40, 0), (256, 240)], GOLD, 7); line(d, [(110, 0), (256, 170)], GOLD, 7)
        for t in range(1, 9):
            ell(d, 75 + t * 20, 10 + t * 22, 4, 4, GOLD2)
        necklace(d, 128, -40, 62, 2)
        border_band(d, 0, 200, 256, 230, GOLD); ell(d, 128, 215, 13, 13, RED)
    save(im, name)

for side, base in (("w", WHITE), ("b", BLK)):
    torso(f"torso_soldier_{side}", base, "soldier")
    torso(f"torso_mantri_{side}", base, "mantri")
    torso(f"torso_raja_{side}", DRED if side == "w" else BLK, "raja")
    torso(f"torso_rani_{side}", GREEN if side == "w" else (20, 60, 40), "rani")
    torso(f"torso_archer_{side}", (40, 90, 50) if side == "w" else BLK, "mantri")

# ---- Sari skirt wrap (cone UV) ----
def sari(name, body, panel):
    im, d = canvas(512, 256, body + (255,))
    for x in range(0, 512, 64):
        rect(d, x + 24, 0, x + 40, 256, panel); line(d, [(x + 22, 0), (x + 22, 256)], GOLD, 3); line(d, [(x + 42, 0), (x + 42, 256)], GOLD, 3)
        for y in range(20, 220, 36):
            ell(d, x + 8, y, 5, 7, GOLD2); ell(d, x + 56, y + 18, 5, 7, GOLD2)
    rect(d, 0, 210, 512, 256, GOLD)
    for x in range(8, 512, 16): ell(d, x, 232, 4, 4, RED)
    rect(d, 0, 0, 512, 12, GOLD)
    save(im, name)
sari("sari_w", RED, GREEN)
sari("sari_b", BLK, RED)

# ---- Caparison: red cloth, gold border and sun ----
def cloth(name, body):
    im, d = canvas(256, 256, body + (255,))
    for i, inset in enumerate((6, 26)):
        line(d, [(inset, inset), (256 - inset, inset), (256 - inset, 256 - inset), (inset, 256 - inset), (inset, inset)], GOLD, 12 if i == 0 else 4)
    for x in range(20, 240, 18): ell(d, x, 240, 4, 4, GOLD2)
    cx, cy = 128, 120
    for k in range(16):
        a = k / 16 * math.tau
        poly(d, [(cx + math.cos(a - 0.12) * 30, cy + math.sin(a - 0.12) * 30), (cx + math.cos(a) * 64, cy + math.sin(a) * 64), (cx + math.cos(a + 0.12) * 30, cy + math.sin(a + 0.12) * 30)], GOLD)
    ell(d, cx, cy, 32, 32, GOLD); ell(d, cx, cy, 18, 18, body); ell(d, cx, cy, 10, 10, GOLD)
    save(im, name)
cloth("cloth_red", RED)
cloth("cloth_dark", (60, 8, 14))

# ---- Cape: red with a gold hem ----
im, d = canvas(128, 256, RED + (255,))
rect(d, 0, 226, 128, 246, GOLD); rect(d, 0, 250, 128, 256, GOLD)
for x in range(6, 128, 12): ell(d, x, 236, 3, 3, RED)
save(im, "cape")
print("ok")
