"""Convert a locally acquired Mixamo character and matching animations to game GLB.

Input FBX files stay outside the public repository. Run using Python with bpy 4.2.
Example:
  python convert-mixamo.py --model Josh-Tpose.fbx --clip idle=Josh-Idle.fbx \
    --clip walk=Josh-Walking.fbx --clip work=Josh-Typing.fbx --output josh.glb
Only use animations downloaded for this exact character/skeleton.
"""
import argparse
import json
import io
import struct
from PIL import Image
from pathlib import Path
import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model', required=True, type=Path)
parser.add_argument('--clip', action='append', default=[])
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--texture-size', type=int, default=1024)
parser.add_argument('--triangle-budget', type=int, default=12000)
args = parser.parse_args()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(args.model.resolve()), use_anim=False,
                         ignore_leaf_bones=True)
rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
if len(rigs) != 1:
    raise RuntimeError(f'Expected one base armature, found {len(rigs)}')
rig = rigs[0]
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError('Base character has no meshes')
# Join compatible clothing/body pieces to one draw per material.
for material in list(bpy.data.materials):
    group = [o for o in bpy.context.scene.objects if o.type == 'MESH' and len(o.material_slots) == 1 and o.material_slots[0].material == material]
    if len(group) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.join()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
ratio = min(1, args.triangle_budget / max(1, triangles))
for obj in meshes:
    if ratio < 1:
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Browser mesh budget', 'DECIMATE')
        modifier.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=modifier.name)
for material in bpy.data.materials:
    is_hair = 'hair' in material.name.lower()
    material.blend_method = 'CLIP' if is_hair else 'OPAQUE'
    material.alpha_threshold = 0.4
    shader = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if shader:
        for socket in ['Specular IOR Level', 'Specular Tint', 'Roughness']:
            for link in list(shader.inputs[socket].links):
                material.node_tree.links.remove(link)
        shader.inputs['Specular IOR Level'].default_value = 0.3
        shader.inputs['Metallic'].default_value = 0
        shader.inputs['Roughness'].default_value = 0.82
        if not is_hair:
            for link in list(shader.inputs['Alpha'].links):
                material.node_tree.links.remove(link)
            shader.inputs['Alpha'].default_value = 1
base_objects = set(bpy.data.objects)
rig.animation_data_create()
clips = []
for spec in args.clip:
    name, filename = spec.split('=', 1)
    before = set(bpy.data.objects)
    previous_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(Path(filename).resolve()), use_anim=True,
                             ignore_leaf_bones=True)
    imported = set(bpy.data.objects) - before
    clip_rigs = [o for o in imported if o.type == 'ARMATURE']
    if len(clip_rigs) != 1:
        raise RuntimeError(f'{name}: expected one armature')
    source = clip_rigs[0]
    if set(source.pose.bones.keys()) != set(rig.pose.bones.keys()):
        raise RuntimeError(f'{name}: skeleton differs from base; re-download for the same character')
    if not source.animation_data or not source.animation_data.action:
        raise RuntimeError(f'{name}: no animation action')
    action = source.animation_data.action.copy()
    action.name = name
    action.use_fake_user = True
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_range[0]), action)
    strip.action_frame_start = action.frame_range[0]
    strip.action_frame_end = action.frame_range[1]
    clips.append({'name': name, 'frames': list(action.frame_range)})
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for extra in set(bpy.data.actions) - previous_actions - {action}:
        if extra.users == 0:
            bpy.data.actions.remove(extra)

# The NLA exporter emits each named track as a separate clip, not their combined pose.
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
# Preserve authored skin/clothing color maps; limit texture memory for a browser game.
for image in bpy.data.images:
    if image.size[0] and max(image.size) > args.texture_size:
        ratio = args.texture_size / max(image.size)
        image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
    if image.size[0]:
        image.pack()
for obj in bpy.context.scene.objects:
    obj.select_set(obj in base_objects)
bpy.context.view_layer.objects.active = rig
rig.data.pose_position = 'POSE'
for track in rig.animation_data.nla_tracks:
    track.mute = False
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format='GLB',
    use_selection=True, export_animations=bool(clips), export_animation_mode='NLA_TRACKS',
    export_anim_slide_to_zero=True, export_force_sampling=True,
    export_materials='EXPORT', export_image_format='AUTO', export_yup=True,
    export_cameras=False, export_lights=False, export_extras=False)
# Repack embedded textures for browser delivery. Keep normal data lossless and
# alpha-cutout edges; use JPEG only for opaque color/roughness maps.
blob = args.output.read_bytes()
json_len = struct.unpack_from('<I', blob, 12)[0]
doc = json.loads(blob[20:20+json_len])
binary_start = 28 + json_len
old_binary = blob[binary_start:]
replacements = {}
normal_images = {doc['textures'][m['normalTexture']['index']]['source']
                 for m in doc.get('materials', []) if 'normalTexture' in m}
for index, image in enumerate(doc.get('images', [])):
    view = doc['bufferViews'][image['bufferView']]
    offset = view.get('byteOffset', 0)
    bitmap = Image.open(io.BytesIO(old_binary[offset:offset+view['byteLength']]))
    output = io.BytesIO()
    if index in normal_images:
        bitmap.thumbnail((512,512), Image.Resampling.LANCZOS)
        bitmap.save(output, format='PNG', optimize=True)
        image['mimeType'] = 'image/png'
    elif bitmap.mode == 'RGBA' and bitmap.getextrema()[3][0] < 255:
        bitmap.quantize(colors=192).save(output, format='PNG', optimize=True)
        image['mimeType'] = 'image/png'
    else:
        bitmap.convert('RGB').save(output, format='JPEG', quality=88, optimize=True)
        image['mimeType'] = 'image/jpeg'
    replacements[image['bufferView']] = output.getvalue()
for material in doc.get('materials', []):
    if 'hair' in material.get('name', '').lower():
        material['alphaMode'] = 'MASK'
        material['alphaCutoff'] = 0.4
new_binary = bytearray()
for index, view in enumerate(doc['bufferViews']):
    offset = view.get('byteOffset', 0)
    payload = replacements.get(index, old_binary[offset:offset+view['byteLength']])
    new_binary.extend(b'\0' * (-len(new_binary) % 4))
    view['byteOffset'] = len(new_binary)
    view['byteLength'] = len(payload)
    new_binary.extend(payload)
new_binary.extend(b'\0' * (-len(new_binary) % 4))
doc['buffers'][0]['byteLength'] = len(new_binary)
json_bytes = json.dumps(doc, separators=(',', ':')).encode()
json_bytes += b' ' * (-len(json_bytes) % 4)
args.output.write_bytes(struct.pack('<III', 0x46546C67, 2, 28+len(json_bytes)+len(new_binary))
    + struct.pack('<II', len(json_bytes), 0x4E4F534A) + json_bytes
    + struct.pack('<II', len(new_binary), 0x004E4942) + new_binary)
print(json.dumps({'file': args.output.name, 'bytes': args.output.stat().st_size,
    'meshes': len(meshes), 'materials': len({s.material for m in meshes for s in m.material_slots if s.material}),
    'triangles': sum(sum(len(p.vertices)-2 for p in m.data.polygons) for m in meshes),
    'bones': len(rig.pose.bones), 'clips': clips}, indent=2))

