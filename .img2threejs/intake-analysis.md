# Static Miku preview intake evidence

Recorded 2026-10-24. Reference: images/Hatsune_Miku_V2.png, technically WEBP despite filename, 1028×1199. Original and landmark guide were opened with image-capable tools; 3×3 crops were generated. User accepted reference-proportioned cartoon style and inferred hidden surfaces in Q2, and explicitly requested static appearance approval before motion.

## Layer 1: identification
A single anime humanoid character in a reference outfit, primaryDomain character; turquoise twin tails, eyes, white sleeveless fitted blouse, turquoise tie and edging, dark arm sleeves, pleated skirt and thigh-high boots. Classification confidence 0.96. Name is supplied by user and image; no external asset identity inferred.

## Layer 2: silhouette and proportions
Near frontal full body, organic smooth outline, bilateral paired limbs with small pose asymmetry. Crown-to-chin roughly 1/6.3 posed full height. Broad twin-tail arcs span most of width and descend toward lower-leg level. Long legs, short skirt, slim waist; arms extend diagonally down/out. Reference may be normalized to neutral mirrored standing for static volume review. Head/neck/torso segment values are observations with confidence 0.83, while depth is inferred.

## Layer 3: hierarchy
Root → torso/neck/head → scalp, bangs, twin tails, earphones, hairbands and face; torso → arm/sleeve/hand; root → skirt/thighs/boots/feet. Core face/body are continuous lofts, not disconnected body blocks; fitted clothing and flared sleeves are shells, hair is closed tapered ribbon volume. Hand fingers and skirt pleats are repeated systems. Details have 17 mapsTo entries in the authored spec.

## Layer 4: spatial relationships
Twin-tail roots embed into high temporal scalp under rectangular bands. Scalp covers crown and occiput; bangs overlap root shell without covering both irises. Earphones contact temporal head; thin microphone follows cheek. Blouse follows torso; collar borders the neck; tie lies on front. Sleeves surround forearms and flare at wrists; hands emerge at cuff. Skirt sits over hips, boot openings follow upper thighs; feet overlap boot shafts. Contact contracts include bounded embed/gap values.

## Layer 5: materials
Base color regions represent cel-illustration skin, hair and cloth, not observed physical PBR. Skin/white-cloth/dark-cloth/hair have no recoverable grain or pores in this image. Evidence-bearing textureless declarations prevent fabrication of maps. Roughness and toon light response are chosen look-dev parameters. Front-face eye/mouth pixels are separately sourced graphical albedo, with de-lighting uncertainty retained in face reports.

## Layer 6: palette
Skin warm pale pink; hair medium turquoise with darker roots and lighter longitudinal bands; garment white; sleeves/skirt/boots dark charcoal; tie and hems saturated turquoise; hair ornaments pink accents. No metallic claim. Exact chosen swatches are in spec.materials; single-image lighting is not treated as neutral measured reflectance.

## Layer 7: identity details
Dark-pink hairbands; earphone rim and cheek microphone; separated fringe tips; high-root broad tapered tails; large turquoise irises with highlights and dark upper lashes; white folded cyan-rim collar; cyan tie and two dark clips; blouse waist/hem paneling; flared cyan-rim cuffs; sleeve control strip; upper-arm 01; pleated cyan-rim skirt; cyan top boot band and sole trim. Small markings are simplified under user Q14 and attached to named surfaces.

## Layer 8: uncertainty
No side or back reference, so cranial depth, rear hairstyle cross-section and rear clothing seams are inferred with confidence around 0.48–0.5. User accepted reasonable hidden-side continuation; these are recorded as accepted assumptions, not unresolved prerequisites or observed evidence. Static multi-angle captures are still required and user visual confirmation remains pending.

## Suitability verdict
character-conditional → stylized. Isolation and silhouette support reconstruction; exact all-view geometry and physical skin/hair response are not recoverable. This is the user's accepted stylized route, not maximum-likeness photogrammetry or a downloaded model.

## Contracts read
Read image_analysis.md, validation_rubric.md, quality_contract.md, local_spec_search.md, detail_inventory.md, reconstruction.md, likeness_maximization.md, structure_decomposition.md, head_construction.md, stylized_hair_threejs.md, surface_topology.md and standard_character_pipeline.md in the installed base skill; read the installed character plugin SKILL.md. Future rig contracts remain pending until user accepts static appearance.

## Local search
Official assessment API performed BM25 retrieval using core_3d original JSONL snapshots and recorded SHA256 in assessment.localSpecSearch.workspaceCacheAdaptation. Only project_root for corpus/cache was relocated into the writable project because installed skill root is read-only; query/scoring/validation were not changed.
