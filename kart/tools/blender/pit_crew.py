# FoxKarts pit crew — built in Blender from this script (run: Blender -b --python pit_crew.py -- <out.glb> [preview_dir])
# A detailed pit-crew member in plain grey overalls and a silver helmet, on a 15-bone skeleton, with looping actions
# (idle, walk, walk_carry, walk_jack, fuel, jack, kneel, look, cheer), plus the props: fuel rig, nozzle, wheel gun,
# trolley jack (handle and saddle as their own parts) and a spare tyre. Exported as one GLB for the game (kart/models).
# Every body part follows one bone rigidly (a figure made of pieces, like an action figure), so nothing ever stretches.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/pit-crew.glb'
PREV = argv[1] if len(argv) > 1 else None
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
coll = scene.collection

# ---------------------------------------------------------------- materials
def mat(name, col, rough=.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = tuple(int(col[i:i + 2], 16) / 255 for i in (1, 3, 5))
    c = tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)   # sRGB → linear
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*c, 1)
    return m
MT = {
    'suit': mat('Suit', '#8a9099', .6), 'suit2': mat('SuitDark', '#5c6169', .7), 'trim': mat('Reflective', '#cdd2d9', .35, .25),
    'helm': mat('Helmet', '#b4b9c1', .28, .25), 'visor': mat('Visor', '#10141c', .06, .6), 'glove': mat('Glove', '#3f434b', .7),
    'boot': mat('Boot', '#2d3037', .65), 'sole': mat('Sole', '#16181c', .9), 'steel': mat('Steel', '#8d939c', .3, .75),
    'rubber': mat('Rubber', '#1b1d22', .92), 'red': mat('RigRed', '#d8392f', .45), 'orange': mat('JackOrange', '#f08a1c', .4),
    'screen': mat('Screen', '#1d3a4a', .2, .1), 'hub': mat('Hub', '#c3c9d1', .25, .8),
}

# ---------------------------------------------------------------- mesh helpers (bmesh shapes → objects)
def to_obj(bm, name, m, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob
def xf(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    M = Matrix.Translation(loc) @ (Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')) @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
def capsule(r1, r2, length, loc=(0, 0, 0), rot=(0, 0, 0), m=None, name='cap', seg=18, rings=12, sy=1.0):
    """a capsule along Z: radius r1 at the bottom, r2 at the top, `length` between the two cap centres"""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1, calc_uvs=True)
    for v in bm.verts:
        x, y, z = v.co
        r = r2 if z >= 0 else r1
        v.co = Vector((x * r, y * r * sy, z * r + (length / 2 if z >= 0 else -length / 2)))
    xf(bm, loc, rot); return to_obj(bm, name, m)
def rbox(sx, sy, sz, loc=(0, 0, 0), rot=(0, 0, 0), m=None, name='box', bevel=.02, segs=3, taper=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
        if taper and v.co.z > 0: v.co.x *= taper[0]; v.co.y *= taper[1]
    if bevel > 0: bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=min(bevel, sx / 2.05, sy / 2.05, sz / 2.05), segments=segs, profile=.5, affect='EDGES', clamp_overlap=True)
    xf(bm, loc, rot); return to_obj(bm, name, m)
def ellip(rx, ry, rz, loc=(0, 0, 0), rot=(0, 0, 0), m=None, name='ell', seg=18, rings=12):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1, calc_uvs=True)
    for v in bm.verts: v.co = Vector((v.co.x * rx, v.co.y * ry, v.co.z * rz))
    xf(bm, loc, rot); return to_obj(bm, name, m)
def cyl(r, h, loc=(0, 0, 0), rot=(0, 0, 0), m=None, name='cyl', seg=20, r2=None, sy=1.0):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts: v.co.y *= sy
    xf(bm, loc, rot); ob = to_obj(bm, name, m)
    return ob
def ring(r_out, r_in, h, loc=(0, 0, 0), rot=(0, 0, 0), m=None, name='ring', seg=24, sy=1.0):
    """a flat ring band (a tube): for belts, cuffs and stripes round a limb"""
    bm = bmesh.new()
    for z in (-h / 2, h / 2):
        pass
    vs = []
    for k, (r, z) in enumerate([(r_out, -h / 2), (r_out, h / 2), (r_in, h / 2), (r_in, -h / 2)]):
        vs.append([bm.verts.new((math.cos(a) * r, math.sin(a) * r * sy, z)) for a in [i / seg * math.tau for i in range(seg)]])
    for k in range(4):
        A, B = vs[k], vs[(k + 1) % 4]
        for i in range(seg): bm.faces.new((A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    xf(bm, loc, rot); return to_obj(bm, name, m)

# ---------------------------------------------------------------- the skeleton (Z up, the figure faces −Y; its left is +X)
BONES = [  # name, head, tail, parent
    ('hips', (0, 0, .95), (0, 0, 1.06), None),
    ('spine', (0, 0, 1.06), (0, 0, 1.5), 'hips'),
    ('neck', (0, 0, 1.5), (0, 0, 1.6), 'spine'),
    ('head', (0, 0, 1.6), (0, 0, 1.86), 'neck'),
    ('upperarm_L', (.245, 0, 1.46), (.255, 0, 1.18), 'spine'), ('forearm_L', (.255, 0, 1.18), (.262, 0, .93), 'upperarm_L'), ('hand_L', (.262, 0, .93), (.262, 0, .82), 'forearm_L'),
    ('upperarm_R', (-.245, 0, 1.46), (-.255, 0, 1.18), 'spine'), ('forearm_R', (-.255, 0, 1.18), (-.262, 0, .93), 'upperarm_R'), ('hand_R', (-.262, 0, .93), (-.262, 0, .82), 'forearm_R'),
    ('thigh_L', (.1, 0, .93), (.1, 0, .52), 'hips'), ('shin_L', (.1, 0, .52), (.1, 0, .1), 'thigh_L'), ('foot_L', (.1, 0, .1), (.1, -.14, .03), 'shin_L'),
    ('thigh_R', (-.1, 0, .93), (-.1, 0, .52), 'hips'), ('shin_R', (-.1, 0, .52), (-.1, 0, .1), 'thigh_R'), ('foot_R', (-.1, 0, .1), (-.1, -.14, .03), 'shin_R'),
]
arm_data = bpy.data.armatures.new('CrewRig'); rig = bpy.data.objects.new('CrewRig', arm_data); coll.objects.link(rig)
bpy.context.view_layer.objects.active = rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in BONES:
    b = arm_data.edit_bones.new(n); b.head = h; b.tail = t; b.roll = 0
    if p: b.parent = arm_data.edit_bones[p]; b.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- the body: every piece follows one bone
# (v164, the user: "make them simpler") a clean, rounded figure. (v177, the user) an OUTFIT per map, chosen by the
# third argument: alps (grey overalls + helmet), beach (palm shirt, pink swim shorts, sun hat, sunglasses, flip-flops),
# city (neon mechanic overalls: navy with glowing cyan and magenta stripes, dark helmet), mines (miner: hard hat with a
# lamp, hi-vis vest, work trousers), space (white space suit, gold-visor helmet, life-support pack).
OUTFIT = argv[2] if len(argv) > 2 else 'alps'
def emat(name, col, strength=2.5):
    m = mat(name, col, .4); b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Emission Color'].default_value = b.inputs['Base Color'].default_value; b.inputs['Emission Strength'].default_value = strength; return m
SKIN = mat('Skin', '#d9a07a', .7)
def palm_print():
    import numpy as np
    W = 256; a = np.zeros((W, W, 4), np.float32); a[..., :3] = (0.05, 0.55, 0.62); a[..., 3] = 1
    yy, xx = np.mgrid[0:W, 0:W]
    def disk(cx, cy, r, col):
        m = (xx - cx) ** 2 + (yy - cy) ** 2 < r * r; a[m, :3] = col
    def seg(x0, y0, x1, y1, w, col):
        for t in np.linspace(0, 1, 40): disk(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, col)
    for (cx, cy) in ((60, 70), (190, 60), (125, 180), (30, 210), (220, 200)):
        seg(cx, cy, cx + 8, cy - 55, 4, (0.45, 0.28, 0.12))                 # trunk
        for ang in (-2.6, -2.0, -1.2, -.4, .3, .9):                          # leaves
            ex, ey = cx + 8 + math.cos(ang) * 34, cy - 55 + math.sin(ang) * 22
            seg(cx + 8, cy - 55, ex, ey, 5, (0.55, 0.85, 0.2))
    for (cx, cy) in ((110, 40), (20, 120), (240, 120), (160, 110), (80, 240)):   # hibiscus
        for k in range(5): disk(cx + math.cos(k * 1.257) * 8, cy + math.sin(k * 1.257) * 8, 6, (1.0, 0.35, 0.6))
        disk(cx, cy, 4, (1.0, 0.9, 0.2))
    img = bpy.data.images.new('PalmShirt', W, W); img.pixels = a[::-1].ravel().tolist(); img.pack()
    m = mat('PalmShirt', '#ffffff', .75); nt = m.node_tree; tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(tex.outputs['Color'], nt.nodes.get('Principled BSDF').inputs['Base Color']); return m
O = {   # the materials each part takes
    'alps':  dict(top=MT['suit'], arm=MT['suit'], fore=MT['suit'], hand=MT['glove'], hip=MT['suit'], thigh=MT['suit'], shin=MT['suit'], foot=MT['boot'], belt=MT['suit2'], neck=MT['suit2']),
    'beach': dict(top=None, arm=None, fore=SKIN, hand=SKIN, hip=mat('Shorts', '#ff4fa3', .7), thigh=None, shin=SKIN, foot=SKIN, belt=None, neck=SKIN),
    'city':  dict(top=mat('Navy', '#1f2552', .6), arm=None, fore=None, hand=mat('BlackGlove', '#15161c', .6), hip=None, thigh=None, shin=None, foot=mat('BlackBoot', '#121318', .5), belt=mat('Navy2', '#12163a', .6), neck=None),
    'mines': dict(top=mat('HiVis', '#ff7a14', .7), arm=mat('Work', '#3d4350', .85), fore=None, hand=mat('Leather', '#8a5a2e', .8), hip=None, thigh=None, shin=None, foot=mat('BrownBoot', '#5a3a1e', .7), belt=mat('Belt', '#2a2018', .7), neck=SKIN),
    'space': dict(top=mat('SpaceWhite', '#eef1f6', .55), arm=None, fore=None, hand=mat('SpaceGlove', '#ff8a1e', .6), hip=None, thigh=None, shin=None, foot=mat('SpaceBoot', '#d8dde6', .5), belt=mat('SpaceGrey', '#9aa2b0', .5), neck=mat('SpaceRing', '#9aa2b0', .3, .6)),
}[OUTFIT]
if OUTFIT == 'beach': O['top'] = O['arm'] = palm_print(); O['thigh'] = O['hip']; O['belt'] = O['hip']
for k in ('arm', 'fore', 'hip', 'thigh', 'shin'):
    if O[k] is None: O[k] = (O['arm'] if OUTFIT == 'mines' else O['top'])   # (the miner wears dark work sleeves and trousers under the vest)
if O['neck'] is None: O['neck'] = O['belt']
PARTS = []
def part(ob, bone): PARTS.append((ob, bone)); return ob
# (v180, the user: "improve the visuals") a sturdier cartoon build: thicker rounded limbs that meet without ball joints,
# a chest that tapers to the waist, chunky gloves and boots, a collar, a chest badge, knee pads and, where there is a
# face, ears, a smile and hair. Accent colours per outfit so the crew read against the road.
ACC = {'alps': mat('AccOrange', '#ff8a1e', .5), 'beach': mat('AccWhite', '#ffffff', .6), 'city': emat('AccCyan', '#2bf0ff', 2.2),
       'mines': mat('AccReflect', '#e8ecf2', .3, .4), 'space': mat('AccOrangeS', '#ff8a1e', .5)}[OUTFIT]
DARK = {'alps': mat('PanelDark', '#4e535b', .8), 'beach': O['hip'], 'city': mat('NavyDark', '#12163a', .6), 'mines': O['arm'], 'space': mat('SpaceGrey2', '#b9c0cc', .5)}[OUTFIT]
BADGE = mat('Badge', '#8a4ae8', .4)
for s, side in ((1, 'L'), (-1, 'R')):
    x = .1 * s
    # leg: thigh tapers into the knee, the shin carries on from it (the knee sphere is the same size, so no "ball joint")
    part(capsule(.082, .095, .3, (x, 0, .73), m=O['thigh'], name='thigh', seg=18, rings=12), 'thigh_' + side)
    part(ellip(.082, .084, .08, (x, 0, .52), m=O['shin'] if OUTFIT != 'beach' else O['thigh'], name='knee', seg=16, rings=10), 'shin_' + side)
    part(capsule(.066, .079, .3, (x, 0, .3), m=O['shin'], name='shin', seg=18, rings=12), 'shin_' + side)
    if OUTFIT in ('alps', 'mines', 'space', 'city'):   # knee pads
        part(rbox(.12, .05, .13, (x, -.07, .52), m=DARK, name='kneepad', bevel=.03), 'shin_' + side)
    if OUTFIT == 'beach':   # bare feet in flip-flops
        part(rbox(.11, .23, .06, (x, -.05, .05), m=SKIN, name='foot', bevel=.025, segs=2), 'foot_' + side)
        part(rbox(.125, .255, .025, (x, -.05, .012), m=mat('FlipFlop', '#ffd23a', .6), name='sole', bevel=.01, segs=1), 'foot_' + side)
        part(rbox(.02, .02, .05, (x, -.12, .07), m=mat('Strap', '#ff4fa3', .6), name='strap', bevel=.005, segs=1), 'foot_' + side)
    else:   # chunky boots with a toe cap and a sole
        bw = .15 if OUTFIT == 'space' else .14
        part(rbox(bw, .27, .13 if OUTFIT != 'space' else .16, (x, -.05, .075), m=O['foot'], name='boot', bevel=.05, segs=3), 'foot_' + side)
        part(rbox(bw + .012, .285, .035, (x, -.05, .018), m=MT['sole'], name='sole', bevel=.012, segs=2), 'foot_' + side)
        part(ellip(.068, .06, .05, (x, -.16, .07), m=O['foot'], name='toe', seg=14, rings=8), 'foot_' + side)
    # arm: the same idea — upper arm, elbow, forearm all round and meeting
    ax = .25 * s
    part(capsule(.07, .078, .2, (ax, 0, 1.32), m=O['arm'], name='uparm', seg=18, rings=12), 'upperarm_' + side)
    part(ellip(.07, .072, .07, (.257 * s, 0, 1.18), m=O['fore'], name='elbow', seg=16, rings=10), 'forearm_' + side)
    part(capsule(.06, .068, .17, (.258 * s, 0, 1.055), m=O['fore'], name='fore', seg=18, rings=12), 'forearm_' + side)
    # a chunky mitten glove and a thumb
    if OUTFIT != 'beach': part(ring(.07, .055, .05, (.262 * s, 0, .945), m=O['hand'], name='cuff', seg=18), 'hand_' + side)
    part(ellip(.062, .07, .082, (.262 * s, -.008, .875), m=O['hand'], name='mitten', seg=18, rings=12), 'hand_' + side)
    part(capsule(.024, .022, .035, (.262 * s + .04 * s, -.045, .9), rot=(.6, 0, 0), m=O['hand'], name='thumb', seg=12, rings=8), 'hand_' + side)
    part(ellip(.1, .1, .07, (.21 * s, 0, 1.47), m=O['arm'], name='shoulder', seg=18, rings=12), 'spine')
    if OUTFIT == 'beach': part(ring(.083, .068, .055, (ax, 0, 1.24), m=O['arm'], name='sleeve', seg=18), 'upperarm_' + side)
    if OUTFIT in ('alps', 'city', 'mines', 'space'):   # an accent band on the upper arm and the shin
        part(ring(.081, .068, .035, (ax, 0, 1.28), m=ACC, name='armband', seg=18), 'upperarm_' + side)
        part(ring(.082, .066, .035, (x, 0, .26), m=ACC, name='legband', seg=18), 'shin_' + side)
    if OUTFIT == 'beach': part(rbox(.012, .05, .2, (x + .085 * s, 0, .78), m=ACC, name='shortstripe', bevel=.004), 'thigh_' + side)
# the body: a chest that tapers to the waist, a belt, a collar
part(ellip(.19, .13, .11, (0, 0, .97), m=O['hip'], name='pelvis', seg=22, rings=12), 'hips')
part(ring(.2, .17, .055, (0, 0, 1.045), m=O['belt'], name='belt', sy=.7), 'hips')
if OUTFIT != 'beach': part(rbox(.06, .025, .045, (0, -.122, 1.045), m=MT['steel'], name='buckle', bevel=.01), 'hips')
part(ellip(.235, .15, .22, (0, 0, 1.34), m=O['top'], name='chest', seg=30, rings=18), 'spine')
part(ellip(.2, .14, .18, (0, .005, 1.14), m=O['top'], name='belly', seg=30, rings=18), 'spine')
part(capsule(.06, .06, .05, (0, 0, 1.56), m=O['neck'], name='neck', seg=16, rings=8), 'neck')
if OUTFIT == 'beach':   # an open collar
    for s in (1, -1): part(rbox(.09, .02, .07, (.06 * s, -.12, 1.5), rot=(0, s * .5, 0), m=O['top'], name='collar', bevel=.01), 'spine')
else:
    part(ring(.115, .08, .06, (0, 0, 1.53), m=DARK, name='collar', sy=.9), 'spine')
    part(cyl(.05, .015, (-.1, -.15, 1.4), rot=(math.pi / 2, 0, 0), m=BADGE, name='badge', seg=20), 'spine')   # the team badge
    part(rbox(.012, .02, .32, (0, -.15, 1.28), m=DARK, name='zip', bevel=.004), 'spine')
if OUTFIT == 'alps':   # reflective band round the chest
    part(ring(.215, .19, .04, (0, .005, 1.22), m=ACC, name='chestband', sy=.7), 'spine')
if OUTFIT == 'city':
    part(rbox(.03, .02, .34, (.12, -.142, 1.28), m=emat('NeonCyan2', '#2bf0ff'), name='stripe', bevel=.008), 'spine')
    part(rbox(.03, .02, .34, (-.12, -.142, 1.28), m=emat('NeonPink2', '#ff2d9b'), name='stripe', bevel=.008), 'spine')
if OUTFIT == 'mines':
    part(ring(.24, .21, .04, (0, 0, 1.2), m=ACC, name='band', sy=.66), 'spine')
    part(ring(.245, .215, .04, (0, 0, 1.36), m=ACC, name='band', sy=.66), 'spine')
    for s in (1, -1): part(rbox(.07, .02, .07, (.12 * s, -.142, 1.12), m=O['top'], name='pocket', bevel=.01), 'spine')
if OUTFIT == 'space':
    part(rbox(.32, .15, .38, (0, .18, 1.32), m=mat('Pack', '#d8dde6', .5), name='pack', bevel=.05), 'spine')
    part(rbox(.14, .02, .09, (.03, -.152, 1.36), m=emat('Panel', '#2bf0ff', 1.6), name='panel', bevel=.012), 'spine')
# the head
def visor(rx, ry, rz, cz, m, z0=1.665, z1=1.772, xw=.152):
    v = ellip(rx, ry, rz, (0, .008, cz), m=m, name='visor', seg=32, rings=22)
    bm = bmesh.new(); bm.from_mesh(v.data)
    kill = [q for q in bm.verts if not (q.co.y < -.04 and z0 < q.co.z < z1 and abs(q.co.x) < xw)]
    bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(v.data); bm.free()
    for p in v.data.polygons: p.use_smooth = True
    return part(v, 'head')
if OUTFIT in ('alps', 'city', 'space'):
    hm = {'alps': MT['helm'], 'city': mat('HelmNavy', '#262d5c', .25, .3), 'space': mat('HelmWhite', '#f4f6fa', .3, .1)}[OUTFIT]
    vm = {'alps': MT['visor'], 'city': mat('VisorCyan', '#0f2a3a', .06, .6), 'space': mat('VisorGold', '#d9a520', .1, .9)}[OUTFIT]
    k = 1.2 if OUTFIT == 'space' else 1.08
    part(ellip(.166 * k, .186 * k, .178 * k, (0, .008, 1.705), m=hm, name='helmet', seg=32, rings=22), 'head')
    visor(.17 * k, .19 * k, .182 * k, 1.705, vm, 1.64 if OUTFIT == 'space' else 1.66, 1.8 if OUTFIT == 'space' else 1.775, .18 if OUTFIT == 'space' else .162)
    if OUTFIT == 'alps':   # an orange stripe over the top
        st = ellip(.168 * k, .188 * k, .18 * k, (0, .008, 1.705), m=ACC, name='hstripe', seg=32, rings=22)
        bm = bmesh.new(); bm.from_mesh(st.data); kill = [q for q in bm.verts if not (abs(q.co.x) < .03 and q.co.z > 1.72)]
        bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(st.data); bm.free(); part(st, 'head')
    if OUTFIT == 'city': part(rbox(.02, .22, .015, (0, .01, 1.9), m=emat('NeonCyan3', '#2bf0ff'), name='crest', bevel=.006), 'head')
else:   # a cartoon face: skin head, ears, a smile, hair at the back, glasses
    part(ellip(.15, .155, .165, (0, 0, 1.7), m=SKIN, name='head', seg=30, rings=20), 'head')
    for s in (1, -1): part(ellip(.03, .04, .05, (.15 * s, .01, 1.7), m=SKIN, name='ear', seg=12, rings=8), 'head')
    part(ellip(.045, .035, .04, (0, -.15, 1.68), m=SKIN, name='nose', seg=14, rings=8), 'head')
    smile = ring(.05, .04, .012, (0, -.138, 1.63), rot=(math.pi / 2, 0, 0), m=mat('Mouth', '#5a2a22', .7), name='smile', seg=20)
    bm = bmesh.new(); bm.from_mesh(smile.data); kill = [q for q in bm.verts if q.co.z > 1.625]
    bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(smile.data); bm.free(); part(smile, 'head')
    for s in (1, -1): part(ellip(.03, .012, .02, (.08 * s, -.13, 1.65), m=mat('Cheek', '#e88a7a', .7), name='cheek', seg=12, rings=6), 'head')
    part(ellip(.15, .13, .11, (0, .045, 1.73), m=mat('Hair', '#5a3a22', .8), name='hair', seg=24, rings=12), 'head')
    gl = mat('Shades', '#101218', .1, .6)
    for s in (1, -1): part(ellip(.058, .02, .038, (.058 * s, -.145, 1.73), m=gl, name='lens', seg=16, rings=8), 'head')
    part(rbox(.22, .02, .016, (0, -.142, 1.748), m=gl, name='bridge', bevel=.005), 'head')
    if OUTFIT == 'beach':   # a straw sun hat
        straw = mat('Straw', '#e9c46a', .85)
        part(cyl(.28, .02, (0, 0, 1.82), m=straw, name='brim', seg=30), 'head'); part(cyl(.155, .13, (0, 0, 1.89), m=straw, name='crown', seg=26, r2=.135), 'head')
        part(cyl(.158, .035, (0, 0, 1.845), m=mat('Band', '#ff4fa3', .6), name='band', seg=26), 'head')
    else:   # a yellow hard hat with a lamp
        hat = mat('HardHat', '#ffc21a', .35)
        part(ellip(.178, .188, .135, (0, 0, 1.8), m=hat, name='hat', seg=30, rings=14), 'head'); part(cyl(.21, .022, (0, 0, 1.79), m=hat, name='hbrim', seg=30, sy=1.1), 'head')
        part(cyl(.045, .045, (0, -.18, 1.84), rot=(math.pi / 2, 0, 0), m=MT['steel'], name='lamp', seg=16), 'head')
        part(cyl(.035, .012, (0, -.205, 1.84), rot=(math.pi / 2, 0, 0), m=emat('LampGlow', '#fff2b0', 4), name='lampglass', seg=16), 'head')

# join into one mesh, each piece weighted fully to its bone
for ob, bone in PARTS:
    vg = ob.vertex_groups.new(name=bone); vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for ob, _ in PARTS: ob.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0][0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'CrewBody'; body.data.name = 'CrewBody'
body.parent = rig; mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
print('crew body:', len(body.data.polygons), 'faces,', len(body.data.vertices), 'verts')

# ---------------------------------------------------------------- the actions: poses sampled every frame
# Angles are given about the figure's own axes at rest, like the game's code: X across the body (+ = lean / swing
# forwards for the spine, backwards for a knee), Z up (yaw). A shoulder takes [forward, out].
REST = {b.name: b.matrix_local.to_quaternion() for b in arm_data.bones}
def q_axis(bone, axis, ang):
    B = REST[bone]; a = B.inverted() @ Vector(axis)
    return Quaternion(a.normalized(), ang)
def pose(P):
    out = {}
    def rx(bone, ax=0.0, az=0.0, ay=0.0):
        q = q_axis(bone, (1, 0, 0), ax)
        if az: q = q @ q_axis(bone, (0, -1, 0), az)   # (a sideways swing about the forward axis)
        if ay: q = q_axis(bone, (0, 0, 1), ay) @ q
        out[bone] = q
    rx('hips', P.get('hipTilt', 0), 0, P.get('hipYaw', 0)); rx('spine', P['spine'], P.get('spineSide', 0), P.get('spineYaw', 0)); rx('neck', P.get('neck', 0))
    rx('head', P['head'], 0, P.get('headYaw', 0))
    for s, sd in ((1, 'L'), (-1, 'R')):
        sh = P['sh' + sd]; rx('upperarm_' + sd, sh[0], sh[1] * s if False else sh[1]); rx('forearm_' + sd, P['el' + sd]); rx('hand_' + sd, P.get('wr' + sd, 0))
        rx('thigh_' + sd, P['hip' + sd], P.get('hipOut' + sd, 0)); rx('shin_' + sd, P['kn' + sd]); rx('foot_' + sd, P.get('ft' + sd, 0))
    return out, P.get('bodyY', 0)
def base():
    return {'bodyY': 0, 'spine': 0, 'head': 0, 'hipL': 0, 'hipR': 0, 'knL': 0, 'knR': 0, 'shL': [0, .1], 'shR': [0, -.1], 'elL': -.12, 'elR': -.12}
S = math.sin
def p_idle(t):
    P = base(); b = S(t * math.tau / 2) * .02; P['spine'] = b; P['head'] = -b * .5; P['shL'] = [.04 + b, .1]; P['shR'] = [.04 + b, -.1]; P['headYaw'] = S(t * math.tau / 4) * .15
    return P
def p_walk(t, carry=None):
    w = t * math.tau / .66; s = S(w); P = base()
    P['hipL'] = s * .5; P['hipR'] = -s * .5; P['knL'] = max(0, -s) * .75 + .08; P['knR'] = max(0, s) * .75 + .08
    P['ftL'] = -(P['hipL'] + P['knL']) * .55 + max(0, s) * .15; P['ftR'] = -(P['hipR'] + P['knR']) * .55 + max(0, -s) * .15   # (the foot stays level, rolls off the toe)
    P['shL'] = [-s * .45, .1]; P['shR'] = [s * .45, -.1]; P['elL'] = -.35 - max(0, s) * .2; P['elR'] = -.35 - max(0, -s) * .2
    P['bodyY'] = abs(math.cos(w)) * .035; P['spine'] = .06; P['hipYaw'] = s * .09; P['spineYaw'] = -s * .12; P['head'] = -.04; P['hipTilt'] = 0
    if carry == 'nozzle': P['shR'] = [-.75, -.12]; P['elR'] = -1.0; P['spineYaw'] *= .5
    if carry == 'jack': P['shL'] = [-.55, .16]; P['shR'] = [-.55, -.16]; P['elL'] = P['elR'] = -.35; P['spine'] = .22
    return P
def p_fuel(t):
    P = base(); w = S(t * math.tau / 2.86)
    # bent over the side of the kart, the nozzle low in the filler, the left hand steadying the hose
    P['spine'] = .42 + w * .02; P['shR'] = [-.62 + w * .04, -.12]; P['elR'] = -.62; P['wrR'] = .25; P['shL'] = [-.5, .22]; P['elL'] = -.95; P['head'] = .32; P['headYaw'] = S(t * math.tau / 5.72) * .12
    P['knL'] = .38; P['knR'] = .3; P['hipL'] = -.3; P['hipR'] = -.2; P['ftL'] = -.08; P['ftR'] = -.1; P['bodyY'] = -.07
    return P
def p_jack(t):
    P = base(); pump = S(t * math.tau / .9)
    P['spine'] = .55 + pump * .2; P['shL'] = [-.6 + pump * .35, .2]; P['shR'] = [-.6 + pump * .35, -.2]; P['elL'] = P['elR'] = -.15 - pump * .1
    P['hipL'] = -.38; P['hipR'] = .12; P['knL'] = .6; P['knR'] = .28; P['ftL'] = -.22; P['ftR'] = -.4; P['head'] = -.35 - pump * .08; P['bodyY'] = -.03 - pump * .02
    return P
def p_kneel(t):
    P = base(); g = S(t * math.tau / .185) * .045; r = S(t * math.tau / 1.2)
    P['bodyY'] = -.4; P['spine'] = .32 + r * .04; P['hipL'] = -1.45; P['knL'] = 1.5; P['ftL'] = -.05; P['hipR'] = .12; P['knR'] = 1.75; P['ftR'] = .6
    P['shL'] = [-1.25 + g, .15]; P['shR'] = [-1.15 - g, -.15]; P['elL'] = -.35; P['elR'] = -.45; P['head'] = .3; P['headYaw'] = r * .08
    return P
def p_look(t):
    P = base(); w = t * math.tau / 3
    P['spine'] = .45 + S(w * 2) * .03; P['head'] = .3; P['headYaw'] = S(w) * .45; P['spineYaw'] = S(w) * .15
    P['shL'] = [-.22, .3]; P['shR'] = [-.22, -.3]; P['elL'] = P['elR'] = -.4; P['wrL'] = P['wrR'] = .2
    P['hipL'] = P['hipR'] = -.18; P['knL'] = P['knR'] = .22; P['ftL'] = P['ftR'] = -.04
    return P
def p_cheer(t):
    P = base(); w = S(t * math.tau / .6); j = max(0, S(t * math.tau / 1.05))
    P['bodyY'] = j * .12; P['shL'] = [-2.9, .3 + w * .25]; P['shR'] = [-2.9, -.3 - w * .25]; P['elL'] = P['elR'] = -.25; P['head'] = -.25
    P['knL'] = P['knR'] = (1 - j) * .25; P['hipL'] = P['hipR'] = -(1 - j) * .12; P['ftL'] = P['ftR'] = j * .35
    return P
ACTIONS = [('idle', p_idle, 2.0), ('walk', p_walk, .66), ('walk_carry', lambda t: p_walk(t, 'nozzle'), .66), ('walk_jack', lambda t: p_walk(t, 'jack'), .66),
           ('fuel', p_fuel, 2.86), ('jack', p_jack, .9), ('kneel', p_kneel, 1.2), ('look', p_look, 3.0), ('cheer', p_cheer, 2.1)]
rig.animation_data_create()
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
made = []
for name, fn, dur in ACTIONS:
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    n = max(2, round(dur * FPS))
    for f in range(n + 1):
        t = f / FPS
        rots, dy = pose(fn(t % dur if f < n else 0.0))
        for pb in rig.pose.bones:
            q = rots.get(pb.name, Quaternion())
            pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=f + 1, group=pb.name)
            if pb.name == 'hips':
                pb.location = REST['hips'].inverted() @ Vector((0, 0, dy)); pb.keyframe_insert('location', frame=f + 1, group=pb.name)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 1, act); tr.mute = True
    rig.animation_data.action = None
    made.append(name)
print('actions:', made)

# ---------------------------------------------------------------- props (each its own object, origin where the game holds it)
def group_join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name; return o
PROPX = 3.0   # (built off to the side; the game places them)
# the fuel nozzle: held at its grip (origin), the spout points forward (−Y)
nz = [rbox(.05, .11, .06, (0, -.01, 0), m=MT['red'], name='nz', bevel=.015), rbox(.035, .06, .1, (0, .03, -.06), rot=(.35, 0, 0), m=MT['glove'], name='nzh', bevel=.012),
      cyl(.022, .3, (0, -.22, .015), rot=(math.pi / 2, 0, 0), m=MT['steel'], name='spout', seg=14), cyl(.035, .06, (0, .08, .01), rot=(math.pi / 2, 0, 0), m=MT['rubber'], name='hosecuff', seg=14),
      ring(.03, .022, .045, (0, -.07, .015), rot=(math.pi / 2, 0, 0), m=MT['glove'], name='nzring', seg=14)]
nozzle = group_join(nz, 'PropNozzle')
# the wheel gun: held at the grip, the socket points forward
wg = [cyl(.045, .2, (0, -.06, .05), rot=(math.pi / 2, 0, 0), m=MT['orange'], name='wgb', seg=16), rbox(.045, .06, .12, (0, 0, -.02), rot=(.2, 0, 0), m=MT['glove'], name='wgh', bevel=.012),
      cyl(.03, .06, (0, -.19, .05), rot=(math.pi / 2, 0, 0), m=MT['steel'], name='wgs', seg=6), cyl(.02, .05, (0, .07, .05), rot=(math.pi / 2, 0, 0), m=MT['rubber'], name='wgair', seg=12),
      rbox(.012, .03, .035, (0, -.03, -.0), m=MT['red'], name='trigger', bevel=.004)]
gun = group_join(wg, 'PropGun')
# the trolley jack: chassis, four castors, lifting arm, saddle (its own part, it rises) and handle (its own part, it pumps)
jk = [rbox(.32, .72, .1, (0, 0, .1), m=MT['orange'], name='jc', bevel=.02), rbox(.26, .3, .06, (0, -.05, .17), m=MT['orange'], name='jtop', bevel=.015),
      rbox(.08, .5, .05, (0, -.1, .2), rot=(-.18, 0, 0), m=MT['steel'], name='jarm', bevel=.012), cyl(.05, .08, (0, .3, .17), rot=(0, math.pi / 2, 0), m=MT['steel'], name='jpiv', seg=14)]
for sx in (-.13, .13):
    for sz in (-.28, .28): jk.append(cyl(.048, .04, (sx, sz, .05), rot=(0, math.pi / 2, 0), m=MT['rubber'], name='jw', seg=14))
jack = group_join(jk, 'PropJack')
pad = group_join([cyl(.09, .05, (0, 0, 0), m=MT['steel'], name='jp', seg=18, r2=.1), ring(.1, .085, .02, (0, 0, .025), m=MT['rubber'], name='jpr', seg=18)], 'PropJackPad')
handle = group_join([cyl(.024, 1.1, (0, 0, .55), m=MT['steel'], name='jh', seg=10), capsule(.034, .034, .16, (0, 0, 1.12), rot=(0, math.pi / 2, 0), m=MT['rubber'], name='jhg', seg=10, rings=6)], 'PropJackHandle')
# the fuel rig: a cabinet with a display, a hose reel, a canopy light and a step
rg = [rbox(.56, .46, 1.45, (0, 0, .725), m=MT['red'], name='rc', bevel=.03), rbox(.62, .5, .08, (0, 0, 1.49), m=MT['steel'], name='rt', bevel=.02), rbox(.6, .5, .08, (0, 0, .04), m=MT['steel'], name='rb', bevel=.02),
      rbox(.36, .02, .22, (0, -.235, 1.12), m=MT['screen'], name='rs', bevel=.01), rbox(.4, .03, .28, (0, -.24, 1.12), m=MT['glove'], name='rsf', bevel=.012),
      cyl(.17, .1, (0, -.26, .65), rot=(math.pi / 2, 0, 0), m=MT['glove'], name='reel', seg=22), cyl(.06, .14, (0, -.27, .65), rot=(math.pi / 2, 0, 0), m=MT['steel'], name='reelhub', seg=16),
      cyl(.05, .06, (.18, -.2, 1.56), m=MT['orange'], name='beacon', seg=14), rbox(.08, .02, .5, (.22, -.235, .5), m=MT['trim'], name='stripe', bevel=.006), rbox(.08, .02, .5, (-.22, -.235, .5), m=MT['trim'], name='stripe2', bevel=.006)]
fuelrig = group_join(rg, 'PropRig')
# a spare tyre: rubber with a tread, a metal wheel with five spokes (axle along X)
ty = [cyl(.27, .22, (0, 0, 0), rot=(0, math.pi / 2, 0), m=MT['rubber'], name='t', seg=28), cyl(.165, .232, (0, 0, 0), rot=(0, math.pi / 2, 0), m=MT['hub'], name='rim', seg=24),
      cyl(.05, .25, (0, 0, 0), rot=(0, math.pi / 2, 0), m=MT['steel'], name='nut', seg=6)]
for k in range(5):
    a = k / 5 * math.tau; ty.append(rbox(.03, .03, .15, (.118, math.sin(a) * .08, math.cos(a) * .08), rot=(-a, 0, 0), m=MT['steel'], name='sp', bevel=.008))
for k in range(28):
    a = k / 28 * math.tau
    for sx in (-.06, .06): ty.append(rbox(.07, .035, .022, (sx, math.sin(a) * .272, math.cos(a) * .272), rot=(-a, 0, 0), m=MT['rubber'], name='tread', bevel=.006, segs=1))
tyre = group_join(ty, 'PropTyre')
for i, o in enumerate([nozzle, gun, jack, pad, handle, fuelrig, tyre]): o.location.x += PROPX + i * .9

# ---------------------------------------------------------------- previews (Workbench renders of each action)
if PREV:
    os.makedirs(PREV, exist_ok=True)
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True; scene.display.shading.show_cavity = True
    scene.render.resolution_x = 480; scene.render.resolution_y = 640; scene.render.film_transparent = False
    world = bpy.data.worlds.new('w'); scene.world = world; world.color = (.85, .88, .92)
    cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); coll.objects.link(cam); scene.camera = cam
    cam.location = (1.75, -2.35, 1.35); cam.rotation_euler = (math.radians(86), 0, math.radians(37)); cam_d.lens = 50
    for name, fn, dur in ACTIONS:
        rig.animation_data.action = bpy.data.actions[name]
        for k, frac in enumerate((0, .25, .5)):
            scene.frame_set(1 + round(frac * dur * FPS)); scene.render.filepath = os.path.join(PREV, f'{name}_{k}.png'); bpy.ops.render.render(write_still=True)
    rig.animation_data.action = None
    # the props
    cam.location = (PROPX + 2.75, -5.6, 2.0); cam.rotation_euler = (math.radians(74), 0, 0); cam_d.lens = 32
    scene.render.resolution_x = 960; scene.render.resolution_y = 480; scene.render.filepath = os.path.join(PREV, 'props.png'); bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- export
for o in bpy.data.objects: o.select_set(o.type in ('MESH', 'ARMATURE'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_apply=False, export_yup=True, export_materials='EXPORT', export_extras=False)
print('exported', OUT, os.path.getsize(OUT), 'bytes')
