# FoxKarts crates v2 — detailed loot crates rendered to transparent PNGs (run: Blender -b --python crates2.py -- <out_dir> [kind])
# A chunky reinforced crate: a body with recessed panels, metal corner brackets with rivets, two straps with buckles,
# a lid open a crack with light spilling out, a hexagon badge on the front carrying the crate's icon in relief:
#   PAINT (blue): a paint can tipped forward with paint spilling and dripping, splats on the panels
#   TYRE (purple): a chunky treaded tyre with a five-spoke rim and an LED ring, tread marks on the sides
#   KART (gold): a racing steering wheel, a chequered band round the lid
# Rendered with Cycles (denoised), three-quarter view, soft studio light and a coloured rim light.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/crates2'
ONLY = argv[1] if len(argv) > 1 else None
os.makedirs(OUT, exist_ok=True)

def lin(h):
    c = tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)
MATS = {}
def mat(col, rough=.45, metal=0.0, emit=None, strength=0.0, coat=0.0):
    key = (col, rough, metal, emit, strength, coat)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new('m'); m.use_nodes = True; b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*lin(col), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .08
    if emit: b.inputs['Emission Color'].default_value = (*lin(emit), 1); b.inputs['Emission Strength'].default_value = strength
    MATS[key] = m; return m
def obj(bm, m, smooth=True):
    me = bpy.data.meshes.new('o'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    me.materials.append(m); o = bpy.data.objects.new('o', me); bpy.context.scene.collection.objects.link(o); return o
def T(bm, loc=(0, 0, 0), rot=(0, 0, 0)):
    M = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
def box(sx, sy, sz, m, loc=(0, 0, 0), rot=(0, 0, 0), bev=.03, segs=3):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if bev: bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=min(bev, sx / 2.05, sy / 2.05, sz / 2.05), segments=segs, profile=.5, affect='EDGES', clamp_overlap=True)
    T(bm, loc, rot); return obj(bm, m)
def cyl(r, h, m, loc=(0, 0, 0), rot=(0, 0, 0), seg=32, r2=None):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h); T(bm, loc, rot); return obj(bm, m)
def sph(r, m, loc=(0, 0, 0), scale=(1, 1, 1), seg=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    for v in bm.verts: v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    T(bm, loc); return obj(bm, m)
def torus(R, r, m, loc=(0, 0, 0), rot=(0, 0, 0), seg=48, rseg=18, sx=1.0):
    bm = bmesh.new(); V = []
    for i in range(seg):
        a = i / seg * math.tau; ring = []
        for j in range(rseg):
            b = j / rseg * math.tau; ring.append(bm.verts.new(((R + r * math.cos(b) * sx) * math.cos(a), (R + r * math.cos(b) * sx) * math.sin(a), r * math.sin(b))))
        V.append(ring)
    for i in range(seg):
        for j in range(rseg): bm.faces.new((V[i][j], V[(i + 1) % seg][j], V[(i + 1) % seg][(j + 1) % rseg], V[i][(j + 1) % rseg]))
    T(bm, loc, rot); return obj(bm, m)
def hexplate(r, h, m, loc, rot=(math.pi / 2, 0, 0), bev=.02):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6, radius1=r, radius2=r, depth=h)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 6, 3, 'Z'))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bev, segments=3, profile=.5, affect='EDGES', clamp_overlap=True)
    T(bm, loc, rot); return obj(bm, m)

STYLE = {
    'paint': dict(body='#1f6dff', dark='#123d9e', trim='#0b1f5c', glow='#7af8ff', rim='#4fd8ff'),
    'tyre': dict(body='#8c34f0', dark='#5a1aa8', trim='#2c0b62', glow='#ff8af0', rim='#ff5ad8'),
    'kart': dict(body='#ffb820', dark='#d97a00', trim='#6a3a05', glow='#fff3a8', rim='#ffd23a'),
}

def crate(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear()
    sc = bpy.context.scene; S = STYLE[kind]
    BODY = mat(S['body'], .32, 0, coat=.6); DARK = mat(S['dark'], .45, 0, coat=.3); TRIM = mat(S['trim'], .5)
    METAL = mat('#d4dae3', .22, 1.0); STEEL = mat('#8e97a6', .3, 1.0); GLOW = mat(S['glow'], .3, 0, S['glow'], 4.0)
    BLACK = mat('#15171d', .55); WHITE = mat('#f6f8fc', .3)
    W, D, H = 1.36, 1.0, .74          # the base
    LH = .3                           # the lid
    # --- base: the shell, recessed panels on every side, a dark plinth
    box(W, D, H, BODY, (0, 0, H / 2), bev=.07, segs=4)
    box(W + .06, D + .06, .08, TRIM, (0, 0, .04), bev=.03)
    for (sx, sy, px, py, rz) in ((W - .34, .03, 0, -D / 2 - .002, 0), (W - .34, .03, 0, D / 2 + .002, 0), (D - .34, .03, -W / 2 - .002, 0, math.pi / 2), (D - .34, .03, W / 2 + .002, 0, math.pi / 2)):
        box(sx, sy, H - .3, DARK, (px, py, H / 2 + .02), (0, 0, rz), bev=.04)
    # --- metal corner brackets with rivets (base and lid)
    for cx in (-1, 1):
        for cy in (-1, 1):
            for (z0, hz) in ((.02, .26), (H - .2, .22)):
                g = (cx * (W / 2 - .07), cy * (D / 2 - .07), z0 + hz / 2)
                box(.2, .2, hz, METAL, g, bev=.04)
                for (ox, oy) in ((cx * .015, cy * .105), (cx * .105, cy * .015)):
                    sph(.022, STEEL, (g[0] + ox, g[1] + oy, g[2] + hz * .22), seg=12); sph(.022, STEEL, (g[0] + ox, g[1] + oy, g[2] - hz * .22), seg=12)
    # --- two straps over the front, with buckles
    for x in (-.5, .5):
        box(.12, D + .045, .05, STEEL, (x, 0, H - .14), bev=.015)
        box(.12, .045, H - .12, STEEL, (x, -D / 2 - .012, (H - .12) / 2 + .06), bev=.015)
        box(.16, .06, .1, METAL, (x, -D / 2 - .03, H * .3), bev=.02)
    # --- the lid, open a crack: hinged at the back, tilted 9 degrees; light spills from the gap
    tilt = math.radians(9)
    lid = bpy.data.objects.new('lid', None); sc.collection.objects.link(lid); lid.location = (0, D / 2, H); lid.rotation_euler = (-tilt, 0, 0)
    def L(o): o.parent = lid; o.location = o.location - Vector((0, D / 2, H)); return o
    L(box(W + .07, D + .07, LH, BODY, (0, 0, H + LH / 2 + .02), bev=.09, segs=4))
    L(box(W - .3, D - .3, .04, DARK, (0, 0, H + LH + .025), bev=.03))
    L(box(W + .09, D + .09, .05, TRIM, (0, 0, H + .045), bev=.02))
    L(box(.3, .1, .14, METAL, (0, -D / 2 - .04, H + .12), bev=.03))                        # the latch
    L(cyl(.045, .05, BLACK, (0, -D / 2 - .1, H + .12), (math.pi / 2, 0, 0), seg=20))
    box(W - .06, D - .06, .02, GLOW, (0, 0, H + .005), bev=.0)                             # the glowing inside
    pl = bpy.data.lights.new('in', 'POINT'); pl.energy = 30; pl.color = lin(S['glow']); po = bpy.data.objects.new('in', pl); po.location = (0, -.15, H + .08); sc.collection.objects.link(po)
    # --- the badge on the front: a metal hexagon, a coloured inset
    fy = -D / 2 - .03; bz = H * .5
    hexplate(.33, .05, METAL, (0, fy - .015, bz)); hexplate(.285, .05, TRIM, (0, fy - .04, bz), bev=.015)
    iy = fy - .07   # where the icon sits (in front of the badge)
    if kind == 'paint':
        CAN = mat('#e8ecf2', .25, .85); P1 = mat('#ff3d5a', .25, coat=.8); P2 = mat('#ffd23a', .25, coat=.8); P3 = mat('#3ad86a', .25, coat=.8)
        cz = bz - .03
        cyl(.1, .19, CAN, (0, iy - .06, cz), seg=32)                                                    # an upright paint can
        torus(.1, .012, STEEL, (0, iy - .06, cz + .095), seg=32, rseg=8); torus(.1, .012, STEEL, (0, iy - .06, cz - .095), seg=32, rseg=8)
        cyl(.103, .07, P2, (0, iy - .06, cz - .01), seg=32)                                              # its yellow label
        torus(.07, .008, STEEL, (0, iy - .06, cz + .2), (math.pi / 2, 0, 0), seg=24, rseg=6)             # the handle
        sph(.11, P1, (0, iy - .07, cz + .1), (1.05, 1.05, .32))                                          # red paint brimming over the top
        for (x, ln) in ((-.06, .1), (.0, .16), (.055, .08)):                                              # and running down the front
            cyl(.018, ln, P1, (x, iy - .162, cz + .095 - ln / 2), seg=12); sph(.024, P1, (x, iy - .163, cz + .095 - ln), seg=12)
        sph(.13, P1, (.02, iy - .12, cz - .13), (1.3, .5, .28))                                          # a puddle at its foot
        sph(.05, P3, (-.15, iy - .06, cz + .12), (1, .4, 1)); sph(.035, P2, (.16, iy - .06, cz + .15), (1, .4, 1))
        # splats on the side panels and the lid
        for (x, y, z, r, M) in ((W / 2 + .01, -.15, H * .55, .1, P2), (W / 2 + .01, .2, H * .35, .07, P3), (W / 2 + .01, .1, H * .62, .05, P1)):
            sph(r, M, (x, y, z), (.25, 1, 1))
        L(sph(.1, P3, (.3, -.1, H + LH + .05), (1, 1, .22))); L(sph(.06, P1, (.15, .15, H + LH + .05), (1, 1, .25)))
        L(cyl(.018, .1, P3, (.36, -D / 2 - .04, H + LH - .05), seg=12))                                          # a drip off the lid edge
    elif kind == 'tyre':
        RUB = mat('#1d1f26', .75); RIM = mat('#c9d1dc', .2, 1.0); LED = mat(S['glow'], .3, 0, S['glow'], 12)
        rot = (math.pi / 2, 0, 0)
        torus(.17, .075, RUB, (0, iy, bz), rot, sx=1.25)
        for k in range(22):                                                                                     # tread blocks
            a = k / 22 * math.tau; box(.075, .1, .05, RUB, (math.cos(a) * .25, iy, bz + math.sin(a) * .25), (0, -a, 0), bev=.012)
        cyl(.13, .06, RIM, (0, iy - .01, bz), rot, seg=36); torus(.135, .012, LED, (0, iy - .045, bz), rot, seg=36, rseg=8)
        for k in range(5):
            a = k / 5 * math.tau + math.pi / 2; box(.035, .03, .12, WHITE, (math.cos(a) * .06, iy - .05, bz + math.sin(a) * .06), (0, -a + math.pi / 2, 0), bev=.01)
        cyl(.035, .06, STEEL, (0, iy - .06, bz), rot, seg=6)
        for side in (-1, 1):                                                                                    # tread marks on the side panels
            for k in range(5):
                box(.02, .09, .05, BLACK, (side * (W / 2 + .012), -.22 + k * .11, H * .45 + (k % 2) * .03), (0, 0, side * .5), bev=.006)
    else:
        GRIP = mat('#1b1d24', .6); CF = mat('#2c3038', .35, .4); RED = mat('#ff3a2a', .3, 0, '#ff3a2a', 3)
        rot = (math.pi / 2, 0, 0)
        torus(.17, .03, GRIP, (0, iy, bz), rot, seg=40, rseg=12, sx=1.0)
        for a in (math.pi / 2, math.pi * 7 / 6, -math.pi / 6):
            box(.05, .025, .17, CF, (math.cos(a) * .085, iy + .005, bz + math.sin(a) * .085), (0, -a + math.pi / 2, 0), bev=.01)
        cyl(.06, .04, CF, (0, iy + .002, bz), rot, seg=24); cyl(.035, .03, GLOW, (0, iy - .02, bz), rot, seg=20)
        box(.03, .03, .05, RED, (0, iy - .01, bz + .17), bev=.008)                                               # the top marker
        # a chequered band round the lid
        n = 14
        for k in range(n):
            for row in range(2):
                c = WHITE if (k + row) % 2 == 0 else BLACK
                L(box((W + .072) / n, .02, .05, c, (-W / 2 - .036 + (k + .5) * (W + .072) / n, -D / 2 - .042, H + .14 + row * .05), bev=.0))
    # --- camera, lights, render (Cycles, transparent background)
    cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (1.95, -2.95, 1.85); cd.lens = 50
    cam.rotation_euler = (Vector((0, 0, .5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for loc, e, size, col in (((2.6, -2.6, 3.6), 1100, 3, '#ffffff'), ((-3.2, -1.2, 2.2), 380, 4, '#dfe8ff'), ((-.5, 3.2, 2.6), 900, 2.5, S['rim']), ((2.8, 1.8, 1.0), 300, 2, S['rim'])):
        Lt = bpy.data.lights.new('l', 'AREA'); Lt.energy = e; Lt.size = size; Lt.color = lin(col); o = bpy.data.objects.new('l', Lt); o.location = loc; sc.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, .45)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.32, .36, .5, 1); bg.inputs['Strength'].default_value = .4
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('gpu?', e)
    sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 640
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.filepath = os.path.join(OUT, f'crate-{kind}.png'); bpy.ops.render.render(write_still=True)
    print('rendered', kind)

for k in ('paint', 'tyre', 'kart'):
    if not ONLY or ONLY == k: crate(k)
