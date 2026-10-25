# Hatsune Miku V6 — model attribution

- Title: Hatsune Miku V6
- Author: not_here01-39 — https://sketchfab.com/not_here01-39
- Source: https://sketchfab.com/3d-models/hatsune-miku-v6-14c9c7a0348842d79973bd1c9da29bb4
- License declared in the supplied GLB: CC BY 4.0 — http://creativecommons.org/licenses/by/4.0/
- User-supplied source: `3D/hatsune_miku_v6.glb`
- SHA-256: `19f9f7e48e8224e961c9b6dc870fe8c5585be3de6903ce505c45919dc17e5287`

The static runtime GLB is byte-identical to the supplied source. Geometry, UVs and material assignments are retained. A parent transform changes display scale and position. For offline preview, the 13 embedded PNG images are extracted into `textures/` and limited to 2048 pixels on their longest side; their colors and material image-slot assignments are retained. The original GLB and original embedded images are not overwritten.

After the user approved the appearance, separate `hatsune_miku_v6-rigged.glb` and `hatsune_miku_v6-animated.glb` derivatives were authored for the motion sample. They add a 27-joint skeleton, skin attributes, blink/smile morph targets and seven authored animation clips while preserving all original base geometry accessor bytes, UVs and material assignments. These additions are project-authored work and are not claimed to have existed in the supplied model. The static preview continues to use the original unrigged asset.

Three.js and its loaders have a separate MIT license in `../vendor/three/LICENSE`.
