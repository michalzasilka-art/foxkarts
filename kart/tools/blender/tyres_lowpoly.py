# FoxKarts: low-poly copies of the six LED tyre designs (the "FoxKarts LED Tyres" artifact) for the game.
# Run: Blender -b --python tyres_lowpoly.py -- <models_dir> [target_tris]
# For each models/tyre-<id>.glb it writes models/tyre-<id>-lp.glb: every mesh keeps its name and material (so the
# game can still colour the LEDs, the rim paint, the accent and the hub), small parts (LED segments, bolts) are left
# as they are, and the big ones (tread, rim, spokes) get a Decimate (collapse) so a wheel lands near the target.
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DIR = argv[0]; TARGET = int(argv[1]) if len(argv) > 1 else 4200
IDS = ['turbine', 'mesh', 'mudclaw', 'solar', 'steelie', 'starsplit']

def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

for tid in IDS:
    src = os.path.join(DIR, f'tyre-{tid}.glb'); out = os.path.join(DIR, f'tyre-{tid}-lp.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total = sum(tris(o) for o in meshes)
    keep = [o for o in meshes if tris(o) < 120]            # tiny parts stay as they are
    big = [o for o in meshes if o not in keep]
    fixed = sum(tris(o) for o in keep); bigT = sum(tris(o) for o in big)
    ratio = max(.1, min(1.0, (TARGET - fixed) / max(1, bigT)))
    for o in big:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        # glTF splits every vertex along its UV / normal seams: weld them first, or the collapse tears the tread apart
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.00015); bpy.ops.object.mode_set(mode='OBJECT')
        r = max(ratio, .45) if o.name.startswith('LED') else ratio   # the LEDs keep their clean outline
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = r; m.use_collapse_triangulate = True
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.object.modifier_apply(modifier='dec')
        try: bpy.ops.object.shade_smooth_by_angle(angle=0.7)   # smooth curves, crisp tread edges
        except Exception: bpy.ops.object.shade_flat()
    after = sum(tris(o) for o in meshes)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT')
    print(f'TYRE {tid}: {total} -> {after} triangles (ratio {ratio:.2f} on {len(big)} big parts, {len(keep)} kept)')
