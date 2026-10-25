# Imported Miku animation validation

The source GLB is static: 0 skins, 0 morph targets and 0 clips. The animation candidate must be a derived GLB with a real skin. Source buffer parity and source texture preservation remain separate from animation performance. No absent input is a pass.

## Contract and twelve checks

Read on 2026-10-24: `/Users/zhenyu/.img2/plugins/character/SKILL.md`, `reference/animation-contract.md`, `reference/character-rigging-animation-1.5.2.md`, `tools/gate_rigging.py`, and `tools/rig_gate_core.py`. No applicable `AGENTS.md` was found in the workspace or its parent directories.

The plugin says four measurements have no producer. The current core explicitly consumes browser/host measurements for five checks, including the easy-to-produce visibility count. Its prose still sometimes says ten, but its actual roster contains twelve checks. This project must report all twelve independently.

| Check | Producer / evidence | Acceptance and outstanding limitations |
| --- | --- | --- |
| G1 binding reaches node | Browser harness compares every track's interpolant with bound node values at ≥5 times per clip; independently measures deformed vertices. | ≤2^-23 binding delta. A clip name, nonzero bone transform or mixer action alone does not prove deformation. Crossfade/controller overlays are measured separately from isolated clip binding. |
| G2 finite deformation | Browser harness uses `SkinnedMesh.getVertexPosition`, including skin and morph, on every vertex at 25 times per state. | All finite; at least 64 vertices per mesh/frame. Small meshes are reported with actual coverage rather than padded counts. |
| G3 bind restore | Browser harness records rest transforms/deformed vertices, samples each action, invokes `reset`, and compares. | ≤1e-12 transform delta; rest position error also reported relative to H. If reset is not a rest/stop operation, this check stays unevaluated until a stop operation exists. |
| G4 weights | Derived GLB producer; browser checks all four influences on every vertex. | Finite nonnegative values; every sum within 2e-7 of 1. |
| G5 indices | Derived GLB producer; browser checks all four indices on every vertex against its own `skeleton.bones`. | Integers in range. Skin order comes from GLB `skin.joints`, not traversal. |
| G6 all visible meshes bound | Browser traverses actual loaded model and checks inherited visibility. | Visible mesh count equals visible SkinnedMesh count. Exemptions are explicit findings, not silent passes. |
| G7 side convention | Parent task explicitly supplied the source-approved front convention (+Z facing, +X character left); browser exports authored-name side labels independently of measured X. | left anchor X > 0 > right anchor X. Assigning labels from measured X would make the check tautological; the external claim is retained in provenance. |
| G8 foot contact | Author explicitly declared both feet planted for the full duration of all seven standing gestures; browser supplies 25 world-space landmark samples per clip. | ≤0.01H during declared stance. The declaration is explicit rather than inferred from a gesture name. |
| G9 joint scale | Browser samples every bone scale at all 25 times and exports sampled clips. | No authored joint scale; no source-scale exemption exists for this static source. |
| G10 skin integrity | Multi-view screenshot sweep supplies visual evidence; no automatic split/crease baseline producer exists yet. | At least 7 clips × 4 times × 2 sides × 2 azimuths = 112 frames for the full gate. Need measured same-subject baseline and separate holes/creases. Screenshots alone do not make G10 pass. |
| G11 frozen buffer parity | Rig producer freezes original positions/normals/UVs/indices before rigging and verifies after. | Byte-identical frozen buffers. Skin indices, skin weights and additive morph targets are legal additions. No re-freezing after a mismatch. |
| G12 rig reference | `rig_glb_reference.py` reads the derived GLB's actual skin order, inverse binds and channels. | Own GLB skeleton and supported interpolation, or an explicit complete correspondence. The static source cannot pass as a rig reference. |

## Actual runtime checks

`node scripts/verify-companion-motion.mjs --playwright /Users/zhenyu/dev/physics/inclined-plane-lab/node_modules/playwright-core --out .img2threejs/imported-glb/animation/validation --url http://127.0.0.1:3211/companion-animation.html`

Run after the root agent explicitly confirms the model and runtime are ready. Browser launch on this macOS host needs the approved external execution route; do not retry a known MachPort failure through the ordinary shell route.

The harness only opens the local supplied URL. It records and fails on any external HTTP request, CSP/runtime/failed texture request, and saves JSON evidence plus screenshots. Network collection uses read-only listeners. The full synchronous sampler recorded an `ERR_ABORTED` on the streamed GLB despite a successfully loaded model, while the separate head/UI probe did not; removing interception did not resolve that discrepancy. Keep this finding rather than attributing it to an unproven cause. The measured figure height H is computed from actual deformed rest vertices in world space; thresholds never assume a unit-height model.

All seven states (`idle`, `wave`, `encourage`, `correct`, `retry`, `thinking`, `celebrate`) are sampled at 25 times including endpoints. Every vertex of every mesh is evaluated; maximum/RMS delta, changed-vertex counts and finite bounding envelopes are recorded. Each must produce a nonzero vertex delta. Per-bone changes, landmark trajectories and skin influence neighborhoods for hands, shoulders, knees and hair are recorded. A broad no-explosion envelope is a numerical guard, not an aesthetic stress verdict.

Every ordered state transition records vertex delta immediately after `play(next)`, after `update(0)`, and after one 60 Hz step. The no-time discontinuity check is separate from intentional movement during elapsed time. This does not assume a hard-reset or crossfade design; its actual result is retained.

Facial morph checks isolate each morph weight (all others zero), compare actual deformed vertices at weight 0 and 1, and restore the pose afterward. This proves a named blink/expression target changes geometry. The state sweep also records actual runtime morph weights so a dormant target cannot masquerade as a working expression. Hair checks require both nonzero chain transform changes and actual vertices affected by those bones to move.

Pause, reset, reduced-motion and page-hidden checks compare pose and render counters across bounded wall-clock intervals. Missing counters or an unsupported visibility test are marked unevaluated. Screenshots include each state at keyframes, front/side/back views, and dedicated shoulder/hand/knee stress frames. Visual integrity and likeness remain review items until the images are inspected.

## Reporting

The report separates pass, fail, measured-only and unevaluated. `ok` is only a runtime smoke-check result, never a claim that all twelve plugin gates pass. The plugin gate payload omits unmeasured blocks deliberately so the real gate can report missing evidence honestly. Source/rest parity and G10 visual integrity must not be inferred from names or screenshots. The author's supplied laterality and stance claims are stated explicitly and then numerically tested.

Object_13 has 48 vertices and Object_16 has 34 vertices. The harness exhaustively tests their actual vertices; it never repeats vertices to claim 64 distinct samples. The current plugin's literal ≥64 threshold therefore conflicts with complete coverage of these small meshes and can report G2 fail even when every existing vertex is finite. Report both facts.
