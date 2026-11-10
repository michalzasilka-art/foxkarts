# FoxKarts crates — three loot crates rendered to transparent PNGs (run: Blender -b --python crates.py -- <out_dir>)
# PAINT crate (blue, splashes of paint on the front), TYRE crate (purple, a tyre on the front), KART crate (gold, a
# steering wheel on the front). Same body for all three: a chunky rounded crate with a lid, metal corners and bands,
# a glowing seam under the lid. Rendered with EEVEE, three-quarter view, soft studio light.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/crates'
os.makedirs(OUT, exist_ok=True)

def lin(h):
    c = tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)
def mat(name, col, rough=.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*lin(col), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1); b.inputs['Emission Strength'].default_value = strength
    return m
def to_obj(bm, name, m, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    me.materials.append(m); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob
def xf(bm, loc=(0, 0, 0), rot=(0, 0, 0)):
    M = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
def rbox(sx, sy, sz, loc=(0, 0, 0), rot=(0, 0, 0), m=None, bevel=.05, segs=4, name='box'):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=min(bevel, sx / 2.05, sy / 2.05, sz / 2.05), segments=segs, profile=.5, affect='EDGES', clamp_overlap=True)
    xf(bm, loc, rot); return to_obj(bm, name, m)
def cyl(r, h, loc=(0, 0, 0), rot=(0, 0, 0), m=None, seg=32, name='cyl'):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=h); xf(bm, loc, rot); return to_obj(bm, name, m)
def torus(R, r, loc=(0, 0, 0), rot=(0, 0, 0), m=None, name='torus', seg=40, rseg=16):
    bm = bmesh.new(); vs = []
    for i in range(seg):
        a = i / seg * math.tau; ring = []
        for j in range(rseg):
            b = j / rseg * math.tau; ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        vs.append(ring)
    for i in range(seg):
        for j in range(rseg): bm.faces.new((vs[i][j], vs[(i + 1) % seg][j], vs[(i + 1) % seg][(j + 1) % rseg], vs[i][(j + 1) % rseg]))
    xf(bm, loc, rot); return to_obj(bm, name, m)
def blob(r, loc, m, name='blob'):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
    for v in bm.verts: v.co.y *= .35
    xf(bm, loc); return to_obj(bm, name, m)

def crate(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    body_col, trim_col, glow_col = {'paint': ('#2a7bff', '#14307a', '#7af8ff'), 'tyre': ('#8a3ae8', '#3a1478', '#ff7af5'), 'kart': ('#f5b320', '#7a4a08', '#fff2a0')}[kind]
    M = {'body': mat('Body', body_col, .35, .05), 'trim': mat('Trim', trim_col, .4, .2), 'metal': mat('Metal', '#c9d0da', .22, .9), 'dark': mat('Dark', '#1a1d26', .5),
         'glow': mat('Glow', glow_col, .3, 0, glow_col, 6.0), 'rubber': mat('Rubber', '#1c1e24', .8), 'white': mat('White', '#f4f6fa', .3)}
    W, D, H = 1.3, 1.0, .95
    rbox(W, D, H * .72, (0, 0, H * .36), m=M['body'], bevel=.09, name='base')
    rbox(W * 1.04, D * 1.04, H * .3, (0, 0, H * .86), m=M['body'], bevel=.1, name='lid')
    rbox(W * 1.045, D * 1.045, .05, (0, 0, H * .72), m=M['glow'], bevel=.02, name='seam')
    for z in (.12, .58):   # two dark bands round the base
        rbox(W * 1.02, D * 1.02, .07, (0, 0, z * H), m=M['trim'], bevel=.03, name='band')
    for sx in (-1, 1):     # metal corner caps
        for sy in (-1, 1):
            for z, h in ((.1, .22), (.86, .3)):
                rbox(.2, .2, h, (sx * W / 2, sy * D / 2, z * H), m=M['metal'], bevel=.06, name='corner')
    rbox(.26, .08, .2, (0, -D / 2 - .04, H * .74), m=M['metal'], bevel=.03, name='latch')
    cyl(.05, .06, (0, -D / 2 - .09, H * .74), rot=(math.pi / 2, 0, 0), m=M['dark'], seg=20, name='lock')
    fy = -D / 2 - .02   # the front face
    if kind == 'paint':
        cols = ['#ff3a3a', '#ffd23a', '#3ad85a', '#ff5db1', '#ffffff', '#3a9aff']
        for i, (x, z, r) in enumerate([(-.3, .42, .17), (.05, .5, .2), (.33, .36, .15), (-.1, .26, .12), (.22, .2, .1), (-.38, .2, .09)]):
            m = mat(f'P{i}', cols[i], .25)
            blob(r, (x, fy, z * H / .95 * .95), m); blob(r * .35, (x + r * .5, fy, z - r * 1.1), m); cyl(r * .18, r * 1.2, (x + r * .5, fy + .01, z - r * .55), m=m, seg=12)
    elif kind == 'tyre':
        torus(.27, .09, (0, fy - .02, .38), rot=(math.pi / 2, 0, 0), m=M['rubber'], name='tyre')
        cyl(.2, .08, (0, fy - .02, .38), rot=(math.pi / 2, 0, 0), m=M['metal'], name='rim')
        torus(.205, .018, (0, fy - .07, .38), rot=(math.pi / 2, 0, 0), m=M['glow'], name='led')
        for k in range(5):
            a = k / 5 * math.tau; rbox(.05, .03, .18, (math.sin(a) * .09, fy - .07, .38 + math.cos(a) * .09), rot=(0, a, 0), m=M['white'], bevel=.01, name='spoke')
        cyl(.05, .1, (0, fy - .08, .38), rot=(math.pi / 2, 0, 0), m=M['dark'], seg=6, name='nut')
    else:
        torus(.25, .045, (0, fy - .02, .38), rot=(math.pi / 2, 0, 0), m=M['dark'], name='wheel')
        for a in (math.pi / 2, -math.pi / 2, math.pi):
            rbox(.05, .04, .22, (math.sin(a) * .12, fy - .03, .38 + math.cos(a) * .12), rot=(0, a, 0), m=M['dark'], bevel=.015, name='wspoke')
        cyl(.07, .06, (0, fy - .04, .38), rot=(math.pi / 2, 0, 0), m=M['glow'], name='hubglow')
        rbox(.5, .05, .1, (0, fy - .01, .82), m=M['white'], bevel=.03, name='flagbar')
    # camera, lights, render
    cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (1.85, -2.75, 1.75); cam_d.lens = 52
    d = Vector((0, 0, .45)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    for loc, e, size in (((2.5, -2.5, 3.5), 900, 3), ((-3, -1.5, 2), 350, 4), ((0, 3, 3), 500, 3)):
        L = bpy.data.lights.new('l', 'AREA'); L.energy = e; L.size = size; o = bpy.data.objects.new('l', L); o.location = loc; sc.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, .4)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (.35, .38, .5, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 512
    try: sc.eevee.use_bloom = True
    except Exception: pass
    sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = os.path.join(OUT, f'crate-{kind}.png'); bpy.ops.render.render(write_still=True)
    print('rendered', kind)

for k in ('paint', 'tyre', 'kart'): crate(k)
