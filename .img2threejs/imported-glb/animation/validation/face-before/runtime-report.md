# Actual motion validation

Runtime result: **fail**. Figure height H = 3.399999999999999. All measurements use actual morphed and skinned vertices in world space.

| State | Runtime check | Maximum vertex delta / H | Hair local rotation / rad |
| --- | --- | --- | --- |
| idle | pass | 0.228902 | 0.011698 |
| wave | pass | 0.411717 | 0.023921 |
| encourage | pass | 0.225899 | 0.023831 |
| correct | pass | 0.225899 | 0.023397 |
| retry | pass | 0.225899 | 0.023831 |
| thinking | pass | 0.378383 | 0.023921 |
| celebrate | pass | 0.390009 | 0.023921 |

- Browser, CSP, texture/network or external request findings.

G7 uses the explicitly supplied source-facing side claims. G8 uses the author's full-duration planted-feet declaration. G11 receives the original freeze manifest and actual runtime buffers when available. G10 still needs a measured split/crease pixel baseline. Object_13 (48 vertices) and Object_16 (34 vertices) are fully sampled but cannot satisfy the plugin's literal 64-vertex minimum. Native hidden visibility: unevaluated. The runtime result does not claim all twelve gates pass.

Full measurements: runtime-report.json. Actual plugin input: rig-gate-payload.json. Captured frames: 144.
