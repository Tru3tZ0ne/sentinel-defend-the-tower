# Office character assets

These files are game-ready derivatives for Sentinel, not an independently licensed
stock asset pack. The characters and motion capture remain Adobe/Mixamo assets.
Do not extract or redistribute them as a general-purpose character library.

Source: [Adobe Mixamo](https://www.mixamo.com/).
Usage guidance: [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html).
The FAQ permits royalty-free use of characters and animations in personal,
commercial and nonprofit projects, including video games. Retrieved 2026-10-14.
Adobe's applicable terms continue to govern the source content.

| Runtime file | Mixamo character | Geometry | Embedded animations | File size |
| --- | --- | --- | --- | --- |
| `josh.glb` | Josh | 11,997 triangles, 2 material meshes, 52 bones | `idle`, `walk`, `work` | 2,172,436 bytes |
| `martha.glb` | Martha | 11,999 triangles, 2 material meshes, 52 bones | `idle`, `walk`, `work` | 2,369,672 bytes |

Animations are retargeted downloads for each respective character:

- **Breathing Idle**: 299 source frames; exported as `idle`.
- **Walking** (description: Walking With A Swagger): 32 source frames, **In Place**
  enabled; exported as `walk`.
- **Typing** (description: Sitting At A Computer And Typing): 495 source frames;
  exported as `work`.

All animation downloads use 30 fps and no keyframe reduction. Josh's base is a
T-pose download; Martha's base is the skinned Typing export, imported without its
animation before merging the separately named clips. Each clip uses its own
character's skeleton; clips are not blindly shared between different rigs.

## Processing

`tools/convert-mixamo.py` uses Blender Python (`bpy` 4.2.23) and Pillow:

1. Import the base rig, merge mesh pieces sharing a material, and decimate to a
   12,000-triangle budget while preserving skin weights and UVs.
2. Import the matching animation rigs, validate bone names and create named NLA
   tracks on the base rig. Retain the authored sitting height and in-place motion.
3. Limit color textures to 1024 px and normal textures to 512 px. Use JPEG for
   opaque color, lossless normal PNGs and quantized cutout-alpha hair PNGs.
4. Replace legacy specular/gloss material links with neutral roughness 0.82,
   nonmetallic surfaces and alpha-tested hair. Preserve source color artwork.
5. Export self-contained glTF 2.0 binaries with no external runtime dependencies.

Runtime normalization makes standing characters approximately 1.48 world units
tall, with their bind-pose soles at the navigation root. Clothing, face, skin and
hair colors are not tinted per NPC. Geometry, materials and textures are shared;
each person has an independent skeleton and animation mixer.

Original FBX downloads, account data and temporary download URLs are deliberately
excluded from this repository. To rebuild, download the listed assets through an
authorized Mixamo account and pass local input paths to the conversion script.
No Adobe login or service access is required to run the game.

## Fidelity limits

These are textured, rigged stock business characters with realistic proportions.
They are not photogrammetry-quality digital humans or custom Sangfor uniforms.
There are two visual variants for eight NPCs. Existing office furniture, room
geometry and lighting remain separate production-art work. Sitting/standing uses
short animation crossfades rather than authored chair-entry transitions.
