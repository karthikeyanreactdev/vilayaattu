"""
Brick-style royal chess figures for Royal Chess 3D.

Run inside Blender (Scripting tab or the MCP bridge):
    exec(open("design/blender/build_figures.py").read())
    build_all(export_dir="/tmp/figures")      # one GLB per piece and side
    build_lineup()                            # every figure side by side, for a render

Conventions shared with src/games/chess-3d/Actors.tsx:
- Z is up, figures face -Y (glTF exports that as +Z), and stand on their own feet at z = 0.
- Joints are empties named body, legL, legR, armL, armR, head, cape (people) and
  body, legFL, legFR, legBL, legBR, neck, earL, earR, trunk0-3, tail, rider (animals).
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

TEX_DIR = os.path.join(os.path.dirname(bpy.data.filepath), "chess-textures")
TAU = math.tau

# Building-block grid: stud pitch, plate height (three plates make a brick), stud size, seam gap.
P = 0.06
PLATE = 0.024
BRICK = 3 * PLATE
STUD_R = 0.017
STUD_H = 0.011
GAP = 0.004

# ---------------------------------------------------------------- materials

def _srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)


def plastic(hexc, rough=0.28):
    name = f"Brick_{hexc}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = _srgb(hexc)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = 0.25
    return m


def gold():
    m = bpy.data.materials.get("Brick_Gold")
    if m:
        return m
    m = bpy.data.materials.new("Brick_Gold")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = _srgb("#d9a634")
    b.inputs["Metallic"].default_value = 0.85
    b.inputs["Roughness"].default_value = 0.28
    return m


def bronze():
    m = bpy.data.materials.get("Brick_Bronze")
    if m:
        return m
    m = bpy.data.materials.new("Brick_Bronze")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = _srgb("#5a3d22")
    b.inputs["Metallic"].default_value = 0.75
    b.inputs["Roughness"].default_value = 0.35
    return m


def printed(name):
    """Material showing one of the painted textures in design/chess-textures."""
    key = f"Print_{name}"
    m = bpy.data.materials.get(key)
    if m:
        return m
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.3
    tex = nt.nodes.new("ShaderNodeTexImage")
    path = os.path.join(TEX_DIR, name + ".png")
    img = bpy.data.images.get(name + ".png") or bpy.data.images.load(path)
    tex.image = img
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    return m


SKIN = "#f6c624"
HAIR = "#1b1512"
RED = "#a8131c"
DRED = "#6e0d14"
TUSK = "#f2e6c8"
SIDE = {
    "w": dict(main="#f3efe6", shade="#dcd5c7", animal="#efebe2", dark="#cfc6b4", cloth="cloth_red", sari="sari_w", trim=RED),
    "b": dict(main="#232126", shade="#18161a", animal="#2e2c31", dark="#141215", cloth="cloth_dark", sari="sari_b", trim=RED),
}

# ---------------------------------------------------------------- geometry helpers

class Kit:
    """Adds parts into the current collection, parented to joint empties."""

    def __init__(self, collection, suffix=""):
        self.col = collection
        self.suffix = suffix

    def _name(self, n):
        return n + self.suffix

    def joint(self, name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
        e = bpy.data.objects.new(self._name(name), None)
        e.empty_display_size = 0.05
        self.col.objects.link(e)
        e.parent = parent
        e.location = loc
        e.rotation_euler = rot
        return e

    def _mesh(self, name, build, mat, parent, loc, rot, scale, bevel=0.0, smooth=False, uv=False):
        me = bpy.data.meshes.new(self._name(name))
        bm = bmesh.new()
        build(bm)
        if smooth:
            for f in bm.faces:
                f.smooth = True
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(self._name(name), me)
        self.col.objects.link(o)
        o.parent = parent
        o.location = loc
        o.rotation_euler = rot
        o.scale = scale
        me.materials.append(mat)
        if bevel:
            b = o.modifiers.new("Bevel", "BEVEL")
            b.width = bevel
            b.segments = 2
            b.limit_method = "ANGLE"
            b.harden_normals = False
        return o

    def box(self, name, size, loc, mat, parent=None, rot=(0, 0, 0), bevel=0.008):
        def b(bm):
            bmesh.ops.create_cube(bm, size=1)
            bmesh.ops.scale(bm, vec=size, verts=bm.verts)
        return self._mesh(name, b, mat, parent, loc, rot, (1, 1, 1), bevel)

    def cyl(self, name, r, h, loc, mat, parent=None, rot=(0, 0, 0), seg=24, r2=None, bevel=0.0):
        def b(bm):
            bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        return self._mesh(name, b, mat, parent, loc, rot, (1, 1, 1), bevel, smooth=True)

    def sphere(self, name, r, loc, mat, parent=None, scale=(1, 1, 1), rot=(0, 0, 0), seg=16):
        def b(bm):
            bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        return self._mesh(name, b, mat, parent, loc, rot, scale, smooth=True)

    def torus(self, name, R, r, loc, mat, parent=None, rot=(0, 0, 0), arc=TAU, seg=32, tube=8, scale=(1, 1, 1)):
        def b(bm):
            verts = []
            n = seg if arc >= TAU - 1e-6 else seg + 1
            for i in range(n):
                a = arc * i / seg
                ring = []
                for j in range(tube):
                    t = TAU * j / tube
                    ring.append(bm.verts.new(((R + r * math.cos(t)) * math.cos(a), (R + r * math.cos(t)) * math.sin(a), r * math.sin(t))))
                verts.append(ring)
            rows = len(verts) if arc >= TAU - 1e-6 else len(verts) - 1
            for i in range(rows):
                a, c = verts[i], verts[(i + 1) % len(verts)]
                for j in range(tube):
                    bm.faces.new((a[j], a[(j + 1) % tube], c[(j + 1) % tube], c[j]))
        return self._mesh(name, b, mat, parent, loc, rot, scale, smooth=True)

    def quad(self, name, corners, mat, parent=None, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
        """A flat printed decal from four corners (counter-clockwise seen from the front)."""
        def b(bm):
            vs = [bm.verts.new(c) for c in corners]
            f = bm.faces.new(vs)
            uv = bm.loops.layers.uv.new()
            for loop, t in zip(f.loops, uvs):
                loop[uv].uv = t
        return self._mesh(name, b, mat, parent, (0, 0, 0), (0, 0, 0), (1, 1, 1))

    def wrap(self, name, r, z0, z1, a0, a1, mat, parent=None, seg=20, r_top=None):
        """Curved printed strip round the Z axis from angle a0 to a1 (0 = -Y, the front)."""
        rt = r if r_top is None else r_top
        def b(bm):
            uv = bm.loops.layers.uv.new()
            cols = []
            for i in range(seg + 1):
                t = i / seg
                a = a0 + (a1 - a0) * t
                d0 = Vector((math.sin(a), -math.cos(a), 0))
                cols.append((bm.verts.new(d0 * r + Vector((0, 0, z0))), bm.verts.new(d0 * rt + Vector((0, 0, z1))), t))
            for i in range(seg):
                (b0, t0, u0), (b1, t1, u1) = cols[i], cols[i + 1]
                f = bm.faces.new((b0, b1, t1, t0))
                for loop, (uu, vv) in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
                    loop[uv].uv = (uu, vv)
            for f in bm.faces:
                f.smooth = True
        return self._mesh(name, b, mat, parent, (0, 0, 0), (0, 0, 0), (1, 1, 1))

    def brick(self, name, nx, ny, plates, loc, mat, parent=None, studs=True, round_=False, rot=(0, 0, 0), stud_mat=None):
        """A building block nx by ny studs and `plates` plates tall; loc is its bottom centre."""
        w, d, h = nx * P - GAP, ny * P - GAP, plates * PLATE - 0.002
        def b(bm):
            if round_:
                bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=w / 2, radius2=w / 2, depth=h)
            else:
                bmesh.ops.create_cube(bm, size=1)
                bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
            bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
            if studs:
                for i in range(nx):
                    for j in range(ny):
                        x, y = (i - (nx - 1) / 2) * P, (j - (ny - 1) / 2) * P
                        if round_ and math.hypot(x, y) > w / 2 - STUD_R:
                            continue
                        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=STUD_R, radius2=STUD_R, depth=STUD_H)
                        bmesh.ops.translate(bm, vec=(x, y, h + STUD_H / 2), verts=r["verts"])
            for f in bm.faces:
                f.smooth = False
        o = self._mesh(name, b, mat, parent, loc, rot, (1, 1, 1), bevel=0.0035)
        o.modifiers["Bevel"].segments = 1
        return o

    def stack(self, name, nx, ny, layers, loc, parent=None, studs=True, round_=False, rot=(0, 0, 0)):
        """Blocks of the same footprint stacked up; layers are (plates, material). Studs only on top."""
        x, y, z = loc
        holder = self.joint(name, parent, (x, y, z), rot)
        h = 0.0
        for i, (plates, mat) in enumerate(layers):
            self.brick(f"{name}{i}", nx, ny, plates, (0, 0, h), mat, holder, studs=studs and i == len(layers) - 1, round_=round_)
            h += plates * PLATE
        return holder, h

    def tube(self, name, pts, radius, mat, parent=None):
        """A smooth tube along points, baked to a mesh."""
        cu = bpy.data.curves.new(self._name(name) + "_curve", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = radius
        cu.bevel_resolution = 3
        cu.use_fill_caps = True
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, co in zip(sp.bezier_points, pts):
            bp.co = co
            bp.handle_left_type = bp.handle_right_type = "AUTO"
        tmp = bpy.data.objects.new("tmp_curve", cu)
        self.col.objects.link(tmp)
        bpy.context.view_layer.update()
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(tmp)
        bpy.data.curves.remove(cu)
        me.name = self._name(name)
        o = bpy.data.objects.new(self._name(name), me)
        self.col.objects.link(o)
        o.parent = parent
        me.materials.clear()
        me.materials.append(mat)
        for f in me.polygons:
            f.use_smooth = True
        return o

    def extrude(self, name, pts, depth, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
        """A flat shape (points in its XZ plane) given thickness along Y."""
        def b(bm):
            front = [bm.verts.new((x, -depth / 2, z)) for x, z in pts]
            back = [bm.verts.new((x, depth / 2, z)) for x, z in pts]
            bm.faces.new(front)
            bm.faces.new(list(reversed(back)))
            n = len(pts)
            for i in range(n):
                bm.faces.new((front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return self._mesh(name, b, mat, parent, loc, rot, (1, 1, 1))

# ---------------------------------------------------------------- shared pieces

def hand(k, name, parent, loc=(0, 0, 0)):
    return k.torus(name, 0.034, 0.016, loc, plastic(SKIN), parent, rot=(0, math.pi / 2, math.pi / 2), arc=TAU * 0.78, seg=14, tube=8)


def spear(k, parent):
    g = k.joint("spear", parent, (0, -0.02, 0.0))
    k.cyl("spearShaft", 0.011, 0.95, (0, 0, 0.12), gold(), g, seg=8)
    k.extrude("spearTip", [(0, 0), (0.035, 0.07), (0, 0.17), (-0.035, 0.07)], 0.012, gold(), g, (0, 0, 0.59))
    for z in (0.55, 0.57, -0.33):
        k.cyl(f"spearRing{z}", 0.019, 0.015, (0, 0, z), gold(), g, seg=10)
    return g


def shield(k, parent):
    g = k.joint("shield", parent, (0.02, -0.04, 0.0), (math.pi / 2, 0, 0))
    k.cyl("shieldDisc", 0.15, 0.02, (0, 0, 0), gold(), g, seg=40, r2=0.14)
    k.torus("shieldRim", 0.152, 0.012, (0, 0, 0.012), gold(), g)
    k.torus("shieldRing", 0.07, 0.009, (0, 0, 0.014), gold(), g)
    k.sphere("shieldBoss", 0.042, (0, 0, 0.018), gold(), g, scale=(1, 1, 0.8))
    k.cyl("shieldBossCap", 0.018, 0.02, (0, 0, 0.05), gold(), g, seg=12)
    for i in range(10):
        a = i / 10 * TAU
        k.sphere(f"shieldStud{i}", 0.013, (math.cos(a) * 0.112, math.sin(a) * 0.112, 0.014), gold(), g)
    return g


def talwar(k, parent):
    g = k.joint("talwar", parent, (0, -0.02, 0))
    blade = [(0.0, 0.0), (0.03, 0.0), (0.045, 0.16), (0.03, 0.32), (-0.02, 0.44), (0.0, 0.3), (0.01, 0.15), (-0.005, 0.02)]
    k.extrude("blade", blade, 0.01, gold(), g, (-0.015, 0, 0.06))
    k.box("guard", (0.11, 0.025, 0.02), (0, 0, 0.05), gold(), g)
    k.cyl("grip", 0.015, 0.09, (0, 0, 0.0), gold(), g, seg=10)
    k.sphere("pommel", 0.025, (0, 0, -0.05), gold(), g)
    return g


def bow(k, parent, arrow=True):
    g = k.joint("bow", parent, (0.0, -0.02, 0.0))
    k.torus("bowArc", 0.24, 0.011, (0.08, 0, 0), gold(), g, rot=(math.pi / 2, 0, 0), arc=math.pi * 0.95, seg=24, tube=6, scale=(0.55, 1, 1))
    k.cyl("bowGrip", 0.016, 0.07, (0.0, 0, 0), gold(), g, seg=10)
    for s in (1, -1):
        k.sphere(f"bowTip{s}", 0.014, (0.08 - 0.0, 0, 0.24 * s * 0.98), gold(), g)
    k.cyl("bowString", 0.003, 0.47, (0.09, 0, 0), plastic("#f0e6cf"), g, seg=6)
    if arrow:
        a = k.joint("arrow", g, (0.04, 0, 0), (0, math.pi / 2, 0))
        k.cyl("arrowShaft", 0.006, 0.42, (0, 0, -0.08), gold(), a, seg=6)
        k.cyl("arrowTip", 0.016, 0.05, (0, 0, -0.31), gold(), a, seg=6, r2=0.0, rot=(math.pi, 0, 0))
    return g


def quiver(k, parent):
    g = k.joint("quiver", parent, (0.06, 0.1, 0.56), (0.35, -0.35, 0))
    k.cyl("quiverBody", 0.045, 0.24, (0, 0, 0), plastic("#7a4a22"), g, seg=14)
    for z in (-0.09, 0.09):
        k.torus(f"quiverBand{z}", 0.046, 0.007, (0, 0, z), gold(), g)
    for i, (x, y) in enumerate(((-0.015, 0), (0.015, 0.01), (0, -0.015))):
        k.cyl(f"quiverArrow{i}", 0.005, 0.12, (x, y, 0.16), gold(), g, seg=6)
        k.cyl(f"quiverFletch{i}", 0.016, 0.04, (x, y, 0.23), gold(), g, seg=4, r2=0.0)
    return g


def turban(k, head, color, gem="#1d8a5a", top="finial", bands=False):
    """Wrapped turban with a gold brooch and a finial or feather plume."""
    m = plastic(color)
    g = k.joint("turban", head, (0, 0, 0.16))
    for i, (z, R, tilt) in enumerate(((0.0, 0.098, 0.0), (0.035, 0.094, 0.18), (0.068, 0.084, -0.2), (0.095, 0.064, 0.25))):
        k.torus(f"wrap{i}", R, 0.03, (0, 0, z), m, g, rot=(tilt, 0, i), tube=10)
    k.sphere("crown", 0.085, (0, 0, 0.06), m, g, scale=(1, 1, 0.75))
    if bands:
        k.torus("band1", 0.105, 0.008, (0, 0, 0.012), gold(), g)
        k.torus("band2", 0.098, 0.007, (0, 0, 0.05), gold(), g, rot=(0.18, 0, 0))
    k.sphere("broochGold", 0.032, (0, -0.1, 0.045), gold(), g, scale=(1, 0.5, 1.2))
    k.sphere("broochGem", 0.017, (0, -0.115, 0.045), plastic(gem, 0.1), g)
    if top == "finial":
        k.sphere("finialBall", 0.022, (0, 0, 0.13), gold(), g)
        k.cyl("finialSpike", 0.02, 0.07, (0, 0, 0.18), gold(), g, seg=8, r2=0.0)
        k.cyl("finialStem", 0.01, 0.04, (0, 0, 0.11), gold(), g, seg=8)
    elif top in ("plume", "royal"):
        plume = k.joint("plume", g, (0, -0.02, 0.1), (-0.3, 0, 0))
        k.cyl("plumeStem", 0.012, 0.06, (0, 0, 0), gold(), plume, seg=8)
        cols = [RED, RED, "#c7203a", RED] if top == "plume" else [RED, "#f4efe6", RED, "#f4efe6", RED]
        for i, c in enumerate(cols):
            a = (i - (len(cols) - 1) / 2) * 0.35
            k.sphere(f"feather{i}", 0.05, (math.sin(a) * 0.05, 0.02, 0.08 + math.cos(a) * 0.03), plastic(c, 0.6), plume, scale=(0.35, 0.25, 1.4), rot=(0.2, a * 0.8, 0))
    return g

# ---------------------------------------------------------------- the Raja, after the sample model

# The sample is about 3.3x the size of these figures; its head centre sits at (0, 0, 2.12).
RAJA_F = 0.095 / 0.32


def _rp(p, origin=(0, 0, 2.12), base=(0, 0, 0.095), mirror=False):
    """Sample coordinates to this figure's head (or hand) space."""
    x = -p[0] if mirror else p[0]
    return ((x - (-origin[0] if mirror else origin[0])) * RAJA_F + base[0], (p[1] - origin[1]) * RAJA_F + base[1], (p[2] - origin[2]) * RAJA_F + base[2])


def _rd(d):
    return tuple(v * RAJA_F for v in d)


def raja_head(k, head, side):
    """Modelled face, beard and a layered royal turban with a tall plume."""
    S = SIDE[side]
    black = plastic("#141110", 0.35)
    white = plastic("#fbf7ef", 0.2)
    skin = plastic(SKIN)
    ivory = plastic("#f1e7d0")
    red = plastic(RED)
    red_dark = plastic(DRED)
    gold_light = plastic("#f0c75a", 0.25)
    jewel = plastic("#b0101e", 0.08)
    for x in (-0.115, 0.115):
        k.sphere(f"eyeWhite{x}", 1, _rp((x, -0.302, 2.17)), white, head, scale=_rd((0.061, 0.028, 0.070)))
        k.sphere(f"eyePupil{x}", 1, _rp((x, -0.328, 2.17)), black, head, scale=_rd((0.026, 0.016, 0.039)))
        k.tube(f"eyebrow{x}", [_rp((x - 0.055, -0.32, 2.255)), _rp((x + 0.045, -0.32, 2.265))], 0.018 * RAJA_F, black, head)
    k.sphere("nose", 1, _rp((0, -0.34, 2.08)), skin, head, scale=_rd((0.045, 0.04, 0.05)))
    k.sphere("beard", 1, _rp((0, -0.265, 1.965)), black, head, scale=_rd((0.245, 0.11, 0.14)))
    for sd in (-1, 1):
        k.sphere(f"moustacheEnd{sd}", 1, _rp((sd * 0.12, -0.355, 2.055)), black, head, scale=_rd((0.105, 0.055, 0.045)))
    k.sphere("moustache", 1, _rp((0, -0.36, 2.045)), black, head, scale=_rd((0.10, 0.05, 0.035)))
    # Turban: ivory underwrap, crimson dome (dark for the black army), gold band and red fold across the front.
    dome = red if side == "w" else plastic("#2a1c1c")
    k.sphere("turbanUnderwrap", 1, _rp((0, 0, 2.405)), ivory if side == "w" else plastic(S["main"]), head, scale=_rd((0.39, 0.34, 0.18)))
    k.sphere("turbanDome", 1, _rp((0, -0.015, 2.47)), dome, head, scale=_rd((0.43, 0.34, 0.235)))
    k.tube("turbanBand", [_rp(p) for p in ((-0.34, -0.19, 2.43), (-0.22, -0.30, 2.49), (0, -0.34, 2.53), (0.20, -0.29, 2.49), (0.34, -0.18, 2.43))], 0.035 * RAJA_F, gold_light, head)
    k.tube("turbanFold", [_rp(p) for p in ((-0.33, -0.21, 2.48), (-0.18, -0.30, 2.56), (0.02, -0.34, 2.57), (0.22, -0.28, 2.53), (0.34, -0.17, 2.47))], 0.045 * RAJA_F, red_dark, head)
    k.sphere("jewelMount", 1, _rp((0.16, -0.325, 2.51)), gold_light, head, scale=_rd((0.12, 0.055, 0.14)))
    k.sphere("jewelRuby", 1, _rp((0.16, -0.374, 2.51)), jewel, head, scale=_rd((0.067, 0.025, 0.085)))
    k.sphere("jewelGlint", 1, _rp((0.14, -0.397, 2.54)), gold_light, head, scale=_rd((0.018, 0.012, 0.023)))
    # Tall swept plume.
    k.sphere("plumeBase", 1, _rp((0.0, -0.02, 2.66)), gold(), head, scale=_rd((0.11, 0.10, 0.12)))
    k.tube("plumeStem", [_rp(p) for p in ((0.02, 0, 2.64), (0.05, 0, 2.79), (0.13, 0, 2.96))], 0.025 * RAJA_F, gold_light, head)
    k.sphere("featherLower", 1, _rp((0.035, 0.005, 2.79)), red, head, scale=_rd((0.095, 0.055, 0.19)))
    k.sphere("featherMiddle", 1, _rp((0.09, -0.005, 2.86)), gold_light, head, scale=_rd((0.075, 0.045, 0.17)))
    k.sphere("featherEdge", 1, _rp((0.15, 0.015, 2.87)), ivory, head, scale=_rd((0.045, 0.035, 0.15)))
    k.sphere("featherTip", 1, _rp((0.12, 0.005, 2.98)), red, head, scale=_rd((0.045, 0.035, 0.09)))


def raja_talwar(k, wrist):
    """The sample's long curved talwar, held in the right hand (mirrored from the sample's left)."""
    steel = plastic("#cfd3d8", 0.18)
    steel.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.9
    gold_light = plastic("#f0c75a", 0.25)
    hand = (0.55, -0.08, 1.13)
    def hp(p):
        return _rp(p, origin=hand, base=(0, 0, 0), mirror=True)
    k.tube("talwarHandle", [hp((0.64, -0.10, 1.03)), hp((0.69, -0.10, 1.28))], 0.055 * RAJA_F, plastic(DRED), wrist)
    k.sphere("talwarPommel", 1, hp((0.64, -0.10, 1.00)), gold_light, wrist, scale=_rd((0.075, 0.065, 0.07)))
    k.tube("talwarGuard", [hp(p) for p in ((0.52, -0.10, 1.25), (0.62, -0.13, 1.30), (0.73, -0.13, 1.29), (0.82, -0.10, 1.24))], 0.035 * RAJA_F, gold(), wrist)
    blade = ((0.70, -0.10, 1.28), (0.77, -0.10, 1.48), (0.86, -0.10, 1.72), (0.94, -0.10, 1.98), (0.96, -0.10, 2.22), (0.91, -0.10, 2.43), (0.84, -0.10, 2.61))
    k.tube("talwarBlade", [hp(p) for p in blade], 0.045 * RAJA_F, steel, wrist)
    spine = ((0.73, -0.145, 1.35), (0.80, -0.145, 1.53), (0.89, -0.145, 1.77), (0.97, -0.145, 2.02), (0.99, -0.145, 2.23), (0.94, -0.145, 2.42))
    k.tube("talwarSpine", [hp(p) for p in spine], 0.009 * RAJA_F, gold_light, wrist)

# ---------------------------------------------------------------- people

def person(k, root, role, side, mini=False):
    """A minifigure in the costume of a Raja, Rani, Mantri, soldier or archer."""
    S = SIDE[side]
    base = 0.0  # no stand: the figure stands on its own feet
    body = k.joint("body", root)
    robe = {"raja": RED if side == "w" else S["main"], "rani": "#1e7a3c" if side == "w" else "#173d2a"}.get(role, S["main"])
    sleeve = plastic(robe)
    legs_m = plastic("#f3efe6" if (side == "w" and role in ("raja", "mantri", "soldier", "archer")) else S["main"])
    hip_z = base + 0.30

    # Legs, or a flared sari for the Rani.
    if role == "rani":
        skirt = k.joint("legL", body, (0, 0, hip_z + 0.04))
        k.cyl("skirt", 0.22, 0.34, (0, 0, -0.17), plastic(RED), skirt, seg=32, r2=0.14)
        k.wrap("sariPrint", 0.222, -0.34, 0.0, -math.pi, math.pi, printed(S["sari"]), skirt, seg=40, r_top=0.142)
        k.cyl("skirtHem", 0.225, 0.05, (0, 0, -0.32), gold(), skirt, seg=32)
    else:
        for s, n in ((1, "legL"), (-1, "legR")):
            leg = k.joint(n, body, (0.075 * s, 0, hip_z))
            k.box(f"{n}Thigh", (0.14, 0.17, 0.26), (0, 0, -0.13), legs_m, leg)
            k.box(f"{n}Foot", (0.14, 0.21, 0.045), (0, -0.02, -0.278), legs_m, leg)
        k.box("hips", (0.3, 0.17, 0.06), (0, 0, hip_z + 0.03), legs_m, body)
    tz = hip_z + 0.06

    # Torso: a trapezoid with the costume printed on the front.
    def torso_build(bm):
        bmesh.ops.create_cube(bm, size=1)
        for v in bm.verts:
            v.co.x *= 0.34 * (0.7 if v.co.z > 0 else 1.0)
            v.co.y *= 0.16
            v.co.z *= 0.27
    k._mesh("torso", torso_build, sleeve, body, (0, 0, tz + 0.135), (0, 0, 0), (1, 1, 1), bevel=0.006)
    k.quad("torsoPrint", [(-0.17, -0.0815, tz + 0.005), (0.17, -0.0815, tz + 0.005), (0.119, -0.0815, tz + 0.265), (-0.119, -0.0815, tz + 0.265)], printed(f"torso_{role}_{side}"), body)

    # Long robe panels and the soldier's red front cloth.
    if role in ("raja", "mantri"):
        k.box("robeFront", (0.26, 0.02, 0.26), (0, -0.092, hip_z - 0.1), plastic(S["main"] if role == "mantri" else "#f3efe6" if side == "w" else S["main"]), body)
        k.box("robeGold", (0.06, 0.025, 0.26), (0, -0.095, hip_z - 0.1), gold(), body)
    if role == "soldier":
        k.box("frontCloth", (0.08, 0.02, 0.2), (0, -0.092, hip_z - 0.07), plastic(RED), body)
        k.box("frontClothHem", (0.085, 0.022, 0.02), (0, -0.093, hip_z - 0.165), gold(), body)

    # Arms with C hands; weapons go in the right hand, shield or bow in the left.
    for s, n in ((1, "armL"), (-1, "armR")):
        arm = k.joint(n, body, (0.15 * s, 0, tz + 0.235), (0, 0, 0.1 * s))
        k.box(f"{n}Upper", (0.075, 0.085, 0.21), (0.012 * s, 0, -0.095), sleeve, arm, rot=(0, 0.08 * s, 0))
        if role in ("raja", "rani"):
            k.torus(f"{n}Bangle", 0.04, 0.012, (0.018 * s, -0.01, -0.19), gold(), arm)
        wrist = k.joint(f"{n}Hand", arm, (0.02 * s, -0.04, -0.225))
        hand(k, f"{n}Grip", wrist)
        if n == "armR":
            if role == "raja":
                raja_talwar(k, wrist)
            elif role == "soldier":
                spear(k, wrist)
            elif role == "rani":
                k.cyl("scepterRod", 0.011, 0.42, (0, -0.0, 0.08), gold(), wrist, seg=8)
                k.torus("scepterLotus", 0.04, 0.012, (0, 0, 0.3), gold(), wrist, rot=(math.pi / 2, 0, 0))
                k.sphere("scepterGem", 0.022, (0, 0, 0.3), plastic(RED, 0.1), wrist)
        else:
            if role == "soldier":
                shield(k, wrist)
            elif role in ("mantri", "archer"):
                bow(k, wrist)

    # Cape: long for royals, a short shoulder cape for soldiers.
    if role in ("raja", "rani", "mantri", "soldier"):
        cape = k.joint("cape", body, (0, 0.08, tz + 0.255))
        long = role != "soldier"
        h = 0.5 if long else 0.26
        w_top, w_bot = 0.34, (0.48 if role in ("raja", "rani") else 0.38) if long else 0.36
        def cape_build(bm, h=h, w_top=w_top, w_bot=w_bot):
            uv = bm.loops.layers.uv.new()
            seg = 8
            rows = []
            for i in range(seg + 1):
                t = i / seg
                x = -0.5 + t
                row = []
                for z, w in ((0.0, w_top), (-h, w_bot)):
                    bend = 0.05 * (1 - (2 * t - 1) ** 2) * (1 if z < 0 else 0.4)
                    row.append(bm.verts.new((x * w, bend + 0.01, z)))
                rows.append((row, t))
            for i in range(seg):
                (r0, t0), (r1, t1) = rows[i], rows[i + 1]
                f = bm.faces.new((r0[0], r1[0], r1[1], r0[1]))
                for loop, c in zip(f.loops, ((t0, 1), (t1, 1), (t1, 0), (t0, 0))):
                    loop[uv].uv = c
            for f in bm.faces:
                f.smooth = True
        o = k._mesh("capeCloth", cape_build, printed("cape"), cape, (0, 0, 0), (-0.08, 0, 0), (1, 1, 1))
        sol = o.modifiers.new("Thick", "SOLIDIFY")
        sol.thickness = 0.015
        k.box("capeClasp", (w_top + 0.02, 0.03, 0.03), (0, -0.01, 0.0), gold(), cape)
        if long:
            for s in (1, -1):
                k.box(f"capeCollar{s}", (0.08, 0.1, 0.03), (0.13 * s, -0.06, 0.005), gold() if role == "raja" else plastic(RED), cape)

    # Neck, head with a printed face, then hair and headgear.
    head = k.joint("head", body, (0, 0, tz + 0.27))
    k.cyl("neckPeg", 0.05, 0.03, (0, 0, 0.0), plastic(SKIN), head, seg=16)
    k.cyl("headCyl", 0.095, 0.165, (0, 0, 0.095), plastic(SKIN), head, seg=32, bevel=0.0)
    face = "face_rani" if role == "rani" else "face_mantri" if role in ("mantri", "archer") else "face_soldier"
    if role != "raja":  # the Raja's face is modelled, not printed
        k.wrap("face", 0.0965, 0.0125, 0.1775, -1.15, 1.15, printed(face), head)
    k.cyl("headTopRound", 0.095, 0.02, (0, 0, 0.187), plastic(SKIN), head, seg=32, r2=0.08)
    if role == "rani":
        hair = plastic(HAIR, 0.45)
        k.sphere("hairTop", 0.104, (0, 0.006, 0.14), hair, head, scale=(1, 1, 0.75))
        for i in range(7):
            for s in (1, -1, 0):
                k.sphere(f"curl{i}{s}", 0.055, (0.07 * s, 0.07 + 0.01 * abs(s), 0.08 - i * 0.06), hair, head, scale=(1, 0.8, 1))
        crown = k.joint("crown", head, (0, 0, 0.19))
        k.cyl("crownBand", 0.105, 0.045, (0, 0, 0), gold(), crown, seg=32)
        for i in range(9):
            a = i / 9 * TAU
            k.cyl(f"crownSpike{i}", 0.02, 0.06, (math.sin(a) * 0.1, -math.cos(a) * 0.1, 0.05), gold(), crown, seg=6, r2=0.0)
            k.sphere(f"crownGem{i}", 0.012, (math.sin(a) * 0.108, -math.cos(a) * 0.108, 0.0), plastic(RED if i % 2 else "#1d8a5a", 0.1), crown)
        k.sphere("crownPlume", 0.04, (0, 0.01, 0.1), plastic(RED, 0.6), crown, scale=(1, 0.7, 1.2))
        k.sphere("tikka", 0.014, (0, -0.1, -0.03), gold(), crown)
    else:
        k.box("hairBack", (0.17, 0.05, 0.12), (0, 0.075, 0.1), plastic(HAIR, 0.45), head)
        for s in (1, -1):
            k.sphere(f"hairSide{s}", 0.03, (0.09 * s, 0.03, 0.08), plastic(HAIR, 0.45), head, scale=(0.6, 1, 1.4))
        if role == "raja":
            raja_head(k, head, side)
        elif role in ("mantri", "archer"):
            turban(k, head, "#f3efe6" if side == "w" else "#2a272c", gem=RED, top="plume")
        elif side == "w":
            turban(k, head, "#f3efe6", top="finial")
        else:
            # Black army foot soldiers wear spiked helmets.
            hm = bronze()
            k.sphere("helmet", 0.108, (0, 0, 0.165), hm, head, scale=(1, 1, 0.95))
            k.torus("helmetBand", 0.104, 0.016, (0, 0, 0.16), plastic(RED), head)
            k.cyl("helmetSpike", 0.022, 0.1, (0, 0, 0.3), gold(), head, seg=8, r2=0.0)
            k.sphere("helmetGem", 0.02, (0, -0.108, 0.16), gold(), head)
    if role in ("mantri", "archer"):
        quiver(k, body)
    return body

# ---------------------------------------------------------------- animals

def tassel(k, name, parent, loc, s=1.0):
    k.sphere(name + "Knob", 0.016 * s, loc, gold(), parent)
    k.cyl(name + "Fringe", 0.022 * s, 0.06 * s, (loc[0], loc[1], loc[2] - 0.04 * s), gold(), parent, seg=10, r2=0.012 * s)


def horse(k, root, side):
    """A building-block horse: block legs, a block barrel and arched block neck, red plume mane."""
    S = SIDE[side]
    coat = plastic(S["animal"])
    base = 0.0  # no stand: the figure stands on its own feet
    body = k.joint("body", root)
    hip = base + 3 * BRICK
    for n, x, y in (("legFL", 0.06, -0.15), ("legFR", -0.06, -0.15), ("legBL", 0.06, 0.18), ("legBR", -0.06, 0.18)):
        leg = k.joint(n, body, (x, y, hip))
        k.brick(n + "Hoof", 2, 2, 2, (0, 0, -3 * BRICK), plastic(S["dark"]), leg, studs=False)
        k.brick(n + "Anklet", 2, 2, 1, (0, 0, -3 * BRICK + 2 * PLATE), gold(), leg, studs=False, round_=True)
        k.brick(n + "Shin", 2, 2, 3, (0, 0, -3 * BRICK + 3 * PLATE), coat, leg, studs=False)
        k.brick(n + "Thigh", 2, 2, 3, (0, 0, -BRICK), coat, leg, studs=False)
    k.stack("barrel", 4, 8, [(3, coat), (3, coat)], (0, 0.015, hip), body, studs=False)
    k.brick("chest", 4, 2, 6, (0, -0.27, hip), coat, body, studs=False)
    top = hip + 2 * BRICK
    # Saddle cloth: printed sun cloth both sides, red top plate with gold edging, saddle and tassels.
    for s in (1, -1):
        k.quad(f"cloth{s}", [(0.1215 * s, 0.2 * -s, hip + 0.005), (0.1215 * s, -0.1 * -s, hip + 0.005), (0.1215 * s, -0.1 * -s, top), (0.1215 * s, 0.2 * -s, top)], printed(S["cloth"]), body)
        tassel(k, f"clothTassel{s}", body, (0.127 * s, 0.05, hip - 0.005))
    k.brick("clothTop", 4, 5, 1, (0, 0.05, top), plastic(RED), body, studs=False)
    k.brick("saddle", 2, 3, 2, (0, 0.04, top + PLATE), plastic(RED), body, studs=True)
    k.brick("saddleGold", 4, 1, 1, (0, -0.1, top + PLATE), gold(), body, studs=True)
    # Long flowing tail of blocks.
    tail = k.joint("tail", body, (0, 0.27, top - 0.02), (0.35, 0, 0))
    for i in range(4):
        k.brick(f"tail{i}", 2, 1, 3, (0, 0.0, -(i + 1) * BRICK), coat, tail, studs=False, rot=(0.08 * i, 0, 0))
    # Arched neck leaning forward with a jewelled gold collar.
    neck = k.joint("neck", body, (0, -0.27, top - 0.03), (-0.55, 0, 0))
    k.stack("neckBlocks", 3, 3, [(3, coat)] * 3, (0, 0, 0), neck, studs=False)
    k.brick("collar", 4, 4, 1, (0, 0, 0.02), gold(), neck, studs=False, round_=True)
    for i in range(5):
        a = (i - 2) * 0.5
        k.brick(f"collarMedal{i}", 1, 1, 1, (math.sin(a) * 0.125, -math.cos(a) * 0.125, 0.03), gold(), neck, studs=False, round_=True, rot=(math.pi / 2, 0, -a))
    # Head: block skull and muzzle angled down, gold bridle, black eyes, block ears.
    # The head sits level on the leaning neck, nose a little down, muzzle reaching forward.
    head = k.joint("horseHead", neck, (0, -0.02, 3 * BRICK - 0.02), (0.8, 0, 0))
    k.brick("skull", 3, 3, 5, (0, 0.02, 0), coat, head, studs=False)
    k.brick("muzzle", 3, 3, 4, (0, -0.15, 0), coat, head, studs=False)
    k.brick("noseband", 3, 3, 1, (0, -0.15, 0.072), gold(), head, studs=False)
    k.brick("browband", 3, 1, 1, (0, -0.07, 0.096), gold(), head, studs=False)
    k.brick("browGem", 1, 1, 1, (0, -0.1, 0.1), plastic(RED, 0.1), head, studs=False, round_=True, rot=(math.pi / 2, 0, 0))
    for s in (1, -1):
        k.brick(f"eye{s}", 1, 1, 1, (0.091 * s, -0.02, 0.06), plastic("#111111", 0.1), head, studs=False, round_=True, rot=(0, math.pi / 2, 0))
        k.cyl(f"ear{s}", 0.028, 0.08, (0.055 * s, 0.05, 0.16), coat, head, seg=4, r2=0.0)
    # Red plume mane down the back of the neck, and a forelock.
    for i in range(6):
        k.brick(f"mane{i}", 1, 1, 3, (0, 0.1, i * 0.04 + 0.02), plastic(RED, 0.55), neck, studs=False, round_=True, rot=(0, 0, 0))
    for i, a in enumerate((-0.35, 0.0, 0.35)):
        k.cyl(f"plume{i}", 0.022, 0.13, (math.sin(a) * 0.03, 0.03, 0.18), plastic(RED, 0.55), head, seg=6, r2=0.006, rot=(-0.3, a, 0))
    return body


def elephant(k, root, side):
    """A building-block elephant with a trunk chain, block ears, caparison and an archer riding on its back."""
    S = SIDE[side]
    hide = plastic(S["animal"])
    base = 0.0  # no stand: the figure stands on its own feet
    body = k.joint("body", root)
    hip = base + 4 * BRICK
    for n, x, y in (("legFL", 0.12, -0.17), ("legFR", -0.12, -0.17), ("legBL", 0.12, 0.2), ("legBR", -0.12, 0.2)):
        leg = k.joint(n, body, (x, y, hip))
        k.brick(n + "Toe", 3, 3, 1, (0, 0, -4 * BRICK), plastic(S["dark"]), leg, studs=False, round_=True)
        k.brick(n + "Anklet", 3, 3, 1, (0, 0, -4 * BRICK + PLATE), gold(), leg, studs=False, round_=True)
        k.stack(n + "Column", 3, 3, [(3, hide), (3, hide), (3, hide), (1, hide)], (0, 0, -4 * BRICK + 2 * PLATE), leg, studs=False)
    k.stack("bodyBlocks", 7, 10, [(3, hide)] * 5, (0, 0.02, hip), body, studs=False)
    top = hip + 5 * BRICK
    for s in (1, -1):
        k.quad(f"capar{s}", [(0.2125 * s, 0.3 * -s, hip + 0.01), (0.2125 * s, -0.15 * -s, hip + 0.01), (0.2125 * s, -0.15 * -s, top), (0.2125 * s, 0.3 * -s, top)], printed(S["cloth"]), body)
        for j, y in enumerate((-0.12, 0.07, 0.26)):
            tassel(k, f"caparTassel{s}{j}", body, (0.219 * s, y, hip), 1.3)
    k.brick("caparTop", 7, 8, 1, (0, 0.07, top), plastic(RED), body, studs=False)
    k.brick("caparTopGold", 7, 1, 1, (0, -0.17, top), gold(), body, studs=True)
    # No howdah: one archer rides astride a gold-edged saddle pad.
    k.brick("saddlePad", 4, 4, 1, (0, 0.06, top + PLATE), plastic(RED), body, studs=True)
    k.brick("saddlePadGold", 4, 1, 1, (0, -0.06, top + PLATE), gold(), body, studs=True)
    rs = 0.55
    rider = k.joint("rider", body, (0, 0.07, top + 2 * PLATE - 0.3 * rs + 0.01))
    sub = Kit(k.col, k.suffix + "_r")
    person(sub, rider, "archer", side, mini=True)
    rider.scale = (rs, rs, rs)
    for n, spread in (("legL", 0.35), ("legR", -0.35)):
        leg = bpy.data.objects[sub._name(n)]
        leg.rotation_euler = (-math.pi / 2 + 0.35, 0, spread)  # astride, feet forward round the barrel
    tail = k.joint("tail", body, (0, 0.32, top - 0.05), (0.2, 0, 0))
    k.brick("tailCord", 1, 1, 6, (0, 0, -6 * PLATE), hide, tail, studs=False, round_=True)
    tassel(k, "tailTuft", tail, (0, 0, -6 * PLATE))
    # Head of blocks with a red-and-gold headdress, block ears, tusks and a trunk chain.
    neck = k.joint("neck", body, (0, -0.32, hip + 0.04))
    k.stack("headBlocks", 6, 5, [(3, hide)] * 5, (0, -0.02, 0), neck, studs=False)
    hz = 5 * BRICK
    k.brick("headdress", 6, 4, 2, (0, -0.03, hz), plastic(RED), neck, studs=True)
    k.brick("headdressGold", 6, 1, 3, (0, -0.17, hz - 0.02), gold(), neck, studs=False)
    for i in range(5):
        k.brick(f"headGem{i}", 1, 1, 1, (-0.12 + i * 0.06, -0.205, hz + 0.01), plastic("#1d8a5a" if i % 2 else RED, 0.1), neck, studs=False, round_=True, rot=(math.pi / 2, 0, 0))
    for s, n in ((1, "earL"), (-1, "earR")):
        ear = k.joint(n, neck, (0.18 * s, -0.04, hz - 0.03), (0, 0, 0.45 * s))
        k.brick(n + "Panel", 1, 5, 12, (0.03 * s, 0.1, -12 * PLATE), hide, ear, studs=False)
        for j in range(3):
            k.brick(f"{n}Stud{j}", 1, 1, 1, (0.062 * s, 0.04 + j * 0.06, -0.08), gold(), ear, studs=False, round_=True, rot=(0, math.pi / 2, 0))
    for s in (1, -1):
        k.brick(f"eye{s}", 1, 1, 1, (0.13 * s, -0.17, hz - 0.08), plastic("#111111", 0.1), neck, studs=False, round_=True, rot=(math.pi / 2, 0, 0))
        tusk = k.joint(f"tusk{s}", neck, (0.1 * s, -0.17, 0.08), (-1.0, 0, -0.25 * s))
        for j in range(4):
            k.brick(f"tuskSeg{s}{j}", 1, 1, 3, (0, 0, -BRICK), plastic(TUSK, 0.35), tusk, studs=False, round_=True)
            tusk = k.joint(f"tuskBend{s}{j}", tusk, (0, 0, -BRICK + 0.004), (-0.45, 0, 0))
    seg = k.joint("trunk0", neck, (0, -0.17, 0.06), (0.1, 0, 0))
    k.brick("trunkSeg0", 2, 2, 5, (0, 0, -5 * PLATE), hide, seg, studs=False)
    for i in range(1, 4):
        seg = k.joint(f"trunk{i}", seg, (0, 0, -5 * PLATE + 0.004), (0.14, 0, 0))
        k.brick(f"trunkSeg{i}", 2, 2, 4, (0, 0, -4 * PLATE), hide, seg, studs=False)
        k.brick(f"trunkStud{i}", 1, 1, 1, (0, -0.062, -2 * PLATE), gold(), seg, studs=False, round_=True, rot=(math.pi / 2, 0, 0))
    return body


# ---------------------------------------------------------------- assembly

PIECES = {"k": "raja", "q": "rani", "b": "mantri", "p": "soldier", "n": "horse", "r": "elephant"}


def build(piece, side, collection, suffix=""):
    """Build one figure; returns its root empty."""
    k = Kit(collection, suffix)
    root = k.joint(f"Fig_{piece}_{side}")
    kind = PIECES[piece]
    if kind == "horse":
        horse(k, root, side)
    elif kind == "elephant":
        elephant(k, root, side)
    else:
        body = person(k, root, kind, side)
        if kind == "raja":
            body.scale = (1.12, 1.12, 1.12)  # the king stands a head above the rest
        elif kind == "soldier":
            body.scale = (0.7, 0.7, 0.7)  # foot soldiers are 30% smaller
    return root


def _fresh_collection(name):
    col = bpy.data.collections.get(name)
    if col:
        for o in list(col.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def build_all(export_dir):
    """One GLB per piece and side, joints named the same in every file."""
    os.makedirs(export_dir, exist_ok=True)
    col = _fresh_collection("FigureExport")
    out = []
    for side in ("w", "b"):
        for piece in PIECES:
            for o in list(col.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            root = build(piece, side, col)
            for o in bpy.context.view_layer.objects:
                o.select_set(False)
            for o in col.objects:
                o.select_set(True)
            path = os.path.join(export_dir, f"{piece}_{side}.glb")
            bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_apply=True, export_yup=True)
            out.append(path)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return out


def build_lineup():
    """Both armies in a row (white in front, black behind) for a preview render."""
    col = _fresh_collection("Lineup")
    for row, side in enumerate(("w", "b")):
        for i, piece in enumerate(("r", "n", "b", "q", "k", "p")):
            root = build(piece, side, col, suffix=f"_{side}{piece}")
            root.location = ((i - 2.5) * 1.0, row * 1.4, 0)
    return col


# ---------------------------------------------------------------- the complete set

BACK_RANK = [("r", "ElephantLeft"), ("n", "HorseLeft"), ("b", "MantriLeft"), ("q", "Queen"), ("k", "King"), ("b", "MantriRight"), ("n", "HorseRight"), ("r", "ElephantRight")]
ROLES = {"k": "king", "q": "queen", "b": "bishop", "n": "knight", "r": "rook", "p": "pawn"}
INDIAN = {"k": "Raja", "q": "Rani", "b": "Mantri", "n": "Kudirai", "r": "Yanai", "p": "Padai Veeran"}


def _group(name, parent=None):
    e = bpy.data.objects.get(name)
    if not e:
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
    e.parent = parent
    return e


def _copy_tree(src, parent, col):
    """Linked copy of a figure: new objects that share the prototype's meshes."""
    dst = src.copy()
    col.objects.link(dst)
    dst.parent = parent
    dst.matrix_parent_inverse = src.matrix_parent_inverse.copy()
    for child in src.children:
        _copy_tree(child, dst, col)
    return dst


def build_set(scale=1.15):
    """Board, both armies in the starting position, studio lights and a camera, under named groups."""
    import json

    scene = bpy.context.scene
    root = _group("RoyalChessSet")
    root["pieceMapping"] = json.dumps({INDIAN[p]: ROLES[p] for p in INDIAN})
    # Board and battlefield under their own groups.
    for col_name, group_name in (("Board", "Chessboard"), ("Field", "Battlefield")):
        g = _group(group_name, root)
        for o in bpy.data.collections[col_name].objects:
            if o.parent is None:
                o.parent = g
    protos = _fresh_collection("Prototypes")
    bpy.context.view_layer.layer_collection.children["Prototypes"].exclude = True
    proto = {(p, s): build(p, s, protos, suffix=f"__{p}{s}") for s in ("w", "b") for p in PIECES}
    for side, army, rank_back, rank_pawn, turn in (("w", "WhiteArmy", 1, 2, math.pi), ("b", "BlackArmy", 8, 7, 0.0)):
        col = _fresh_collection(army)
        group = _group(army, root)
        placed = [(p, name, f"{'abcdefgh'[i]}{rank_back}") for i, (p, name) in enumerate(BACK_RANK)]
        placed += [("p", f"Soldier{i + 1:02d}", f"{'abcdefgh'[i]}{rank_pawn}") for i in range(8)]
        for piece, name, sq in placed:
            node = bpy.data.objects.new(f"{army}_{name}", None)
            col.objects.link(node)
            node.parent = group
            node.location = ("abcdefgh".index(sq[0]) - 3.5, int(sq[1]) - 4.5, 0)
            node.rotation_euler = (0, 0, turn)
            node.scale = (scale, scale, scale)
            node["square"] = sq
            node["chessRole"] = ROLES[piece]
            node["indianName"] = INDIAN[piece]
            node["side"] = "white" if side == "w" else "black"
            _copy_tree(proto[piece, side], node, col)
    # Studio lighting: warm key, soft fill, cool rim.
    lights = _group("Lighting", root)
    for name, kind, loc, energy, color in (
        ("KeyLight", "SUN", (6, -8, 10), 4.0, (1.0, 0.85, 0.65)),
        ("FillLight", "SPOT", (-9, -5, 6), 1800.0, (1.0, 0.92, 0.82)),
        ("RimLight", "SPOT", (0, 11, 7), 2200.0, (0.8, 0.88, 1.0)),
    ):
        o = bpy.data.objects.get(name)
        if not o:
            o = bpy.data.objects.new(name, bpy.data.lights.new(name, kind))
            scene.collection.objects.link(o)
        o.data.energy = energy
        o.data.color = color
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        if kind == "SPOT":
            o.data.spot_size = math.radians(60)
            o.data.spot_blend = 0.6
        o.parent = lights
    cams = _group("Camera", root)
    cam = bpy.data.objects.get("ShowcaseCamera")
    if not cam:
        cam = bpy.data.objects.new("ShowcaseCamera", bpy.data.cameras.new("ShowcaseCamera"))
        scene.collection.objects.link(cam)
    cam.data.lens = 35
    cam.location = (0, -13.5, 8.5)
    cam.rotation_euler = (Vector((0, 0.3, -0.2)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.parent = cams
    return root


def export_set(path):
    """Everything under RoyalChessSet into one self-contained GLB."""
    root = bpy.data.objects["RoyalChessSet"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    def select(o):
        o.select_set(True)
        for c in o.children:
            select(c)
    select(root)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_apply=True, export_yup=True,
                              export_lights=True, export_cameras=True, export_extras=True, export_image_format="AUTO")
    return path
