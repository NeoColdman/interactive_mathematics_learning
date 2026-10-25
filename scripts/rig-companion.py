#!/usr/bin/env python3
"""Add an authored, measured skin to the unchanged imported Miku geometry.

The source has no skeleton. This deterministic offline authoring step appends a
new skeleton and weights to a *copy*, and reads that copy with the character
plugin before recording runtime authority. It does not author animation clips
or facial targets. Original BIN bytes and all original accessors are retained.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".img2threejs/imported-glb/animation"
SOURCE = ROOT / "3D/hatsune_miku_v6.glb"
OUTPUT = ROOT / "public/companion/hatsune_miku_v6-rigged.glb"
PLUGIN = Path.home() / ".img2/plugins/character/tools"
VALIDATOR = Path.home() / ".codex/skills/img2threejs/forge/stage5_rig/validate_rig_payload.py"
sys.path.insert(0, str(PLUGIN))
import rig_glb_reference as reference
import rig_mesh_parity as parity
import rig_skin_conditioning as conditioning

GRID = 4096


def snap(p):
    return [round(x * GRID) / GRID for x in p]


# Measured from mesh components, cross-sections, and front/profile reference.
# +X is the character's anatomical left (viewer-right in the +Z front view).
# Translation-only rest frames keep joint rotation axes equal to the GLB axes.
JOINT_SPEC = [
    ("hips", None, (0, 1.020, 0.010), "humanoid"),
    ("spine", "hips", (0, 1.160, 0.015), "humanoid"),
    ("chest", "spine", (0, 1.290, 0.004), "humanoid"),
    ("neck", "chest", (0, 1.360, 0.004), "humanoid"),
    ("head", "neck", (0, 1.455, 0.006), "humanoid"),
    ("leftClavicle", "chest", (0.060, 1.320, 0), "humanoid"),
    ("leftUpperArm", "leftClavicle", (0.112, 1.320, -0.003), "humanoid"),
    ("leftForeArm", "leftUpperArm", (0.294, 1.176, -0.012), "humanoid"),
    ("leftHand", "leftForeArm", (0.474, 1.035, -0.013), "humanoid"),
    ("rightClavicle", "chest", (-0.060, 1.320, 0), "humanoid"),
    ("rightUpperArm", "rightClavicle", (-0.112, 1.320, -0.003), "humanoid"),
    ("rightForeArm", "rightUpperArm", (-0.294, 1.176, -0.012), "humanoid"),
    ("rightHand", "rightForeArm", (-0.474, 1.035, -0.013), "humanoid"),
    ("leftThigh", "hips", (0.061, 0.984, 0.013), "humanoid"),
    ("leftShin", "leftThigh", (0.055, 0.558, 0.007), "humanoid"),
    ("leftFoot", "leftShin", (0.061, 0.094, -0.020), "humanoid"),
    ("rightThigh", "hips", (-0.061, 0.984, 0.013), "humanoid"),
    ("rightShin", "rightThigh", (-0.055, 0.558, 0.007), "humanoid"),
    ("rightFoot", "rightShin", (-0.061, 0.094, -0.020), "humanoid"),
    ("leftHair1", "head", (0.122, 1.575, -0.087), "hair-auxiliary"),
    ("leftHair2", "leftHair1", (0.220, 1.240, -0.140), "hair-auxiliary"),
    ("leftHair3", "leftHair2", (0.295, 0.830, -0.245), "hair-auxiliary"),
    ("leftHair4", "leftHair3", (0.320, 0.400, -0.270), "hair-auxiliary"),
    ("rightHair1", "head", (-0.122, 1.575, -0.087), "hair-auxiliary"),
    ("rightHair2", "rightHair1", (-0.220, 1.240, -0.140), "hair-auxiliary"),
    ("rightHair3", "rightHair2", (-0.295, 0.830, -0.245), "hair-auxiliary"),
    ("rightHair4", "rightHair3", (-0.320, 0.400, -0.270), "hair-auxiliary"),
]
NAMES = [entry[0] for entry in JOINT_SPEC]
JID = {name: i for i, name in enumerate(NAMES)}
WORLD = [snap(entry[2]) for entry in JOINT_SPEC]
PARENTS = [None if entry[1] is None else JID[entry[1]] for entry in JOINT_SPEC]
LOCAL = [[p[k] - (WORLD[parent][k] if parent is not None else 0) for k in range(3)]
         for p, parent in zip(WORLD, PARENTS)]


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def accessor(document, binary, index):
    a = document["accessors"][index]
    v = document["bufferViews"][a["bufferView"]]
    fmt, width = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
                  5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}[a["componentType"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    offset = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", count * width)
    return [list(struct.unpack_from("<" + fmt * count, binary, offset + i * stride))
            for i in range(a["count"])]


def accessor_bytes(document, binary, index):
    a = document["accessors"][index]
    v = document["bufferViews"][a["bufferView"]]
    size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[a["componentType"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    offset = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", count * size)
    return b"".join(binary[offset + i * stride:offset + i * stride + count * size]
                    for i in range(a["count"]))


def geometry_payload(document, binary):
    out = {"meshes": []}
    amap = {"POSITION": "position", "NORMAL": "normal", "TEXCOORD_0": "uv",
            "JOINTS_0": "skinIndex", "WEIGHTS_0": "skinWeight"}
    for mesh in document["meshes"]:
        for pi, p in enumerate(mesh["primitives"]):
            item = {"name": mesh["name"] + (f"/primitive{pi}" if pi else ""), "attributes": {}}
            for key, value in p["attributes"].items():
                if key in amap:
                    item["attributes"][amap[key]] = [n for row in accessor(document, binary, value) for n in row]
            item["index"] = [n[0] for n in accessor(document, binary, p["indices"])]
            out["meshes"].append(item)
    return out


def components(positions, triangles):
    """Connectivity inventory only; never weld or modify the mesh geometry."""
    parent = list(range(len(positions)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    for a, b, c in zip(triangles[0::3], triangles[1::3], triangles[2::3]):
        union(a, b)
        union(b, c)
    coincidence = {}
    for i, p in enumerate(positions):
        key = tuple(round(v, 5) for v in p)
        if key in coincidence:
            union(i, coincidence[key])
        else:
            coincidence[key] = i
    groups = {}
    for i in range(len(positions)):
        groups.setdefault(find(i), []).append(i)
    labels = [None] * len(positions)
    report = []
    for label, ids in enumerate(sorted(groups.values(), key=len, reverse=True)):
        for i in ids:
            labels[i] = label
        report.append({"component": label, "vertexCount": len(ids),
                       "min": [min(positions[i][k] for i in ids) for k in range(3)],
                       "max": [max(positions[i][k] for i in ids) for k in range(3)]})
    return labels, report


def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    out = {key: value * (1 - t) for key, value in a.items()}
    for key, value in b.items():
        out[key] = out.get(key, 0) + value * t
    return out


def torso(p):
    y = p[1]
    levels = [(1.055, "hips"), (1.170, "spine"), (1.290, "chest"), (1.365, "neck"), (1.415, "head")]
    if y <= levels[0][0]:
        return {"hips": 1}
    for (ya, a), (yb, b) in zip(levels, levels[1:]):
        if y < yb:
            return {a: 1 - smooth(ya, yb, y), b: smooth(ya, yb, y)}
    return {"head": 1}


def arm(p):
    side = "left" if p[0] >= 0 else "right"
    q = [abs(p[0]), p[1], p[2]]
    sh, el, wr = [WORLD[JID["left" + name]] for name in ["UpperArm", "ForeArm", "Hand"]]
    axis = [wr[k] - sh[k] for k in range(3)]
    length = math.sqrt(sum(v * v for v in axis))
    axis = [v / length for v in axis]
    s = sum((q[k] - sh[k]) * axis[k] for k in range(3))
    elbow_s = sum((el[k] - sh[k]) * axis[k] for k in range(3))
    shoulder = smooth(-0.055, 0.065, s)
    if shoulder < 1:
        # One field across cloth/skin and a small clavicle contribution.
        trunk = torso(p)
        return mix(trunk, {side + "UpperArm": .88, side + "Clavicle": .12}, shoulder)
    elbow = smooth(elbow_s - .065, elbow_s + .065, s)
    wrist = smooth(length - .035, length + .020, s)
    return mix({side + "UpperArm": 1 - elbow, side + "ForeArm": elbow}, {side + "Hand": 1}, wrist)


def leg(p):
    side = "left" if p[0] >= 0 else "right"
    hip = smooth(.915, 1.040, p[1])
    knee = 1 - smooth(.495, .625, p[1])
    ankle = 1 - smooth(.085, .190, p[1])
    limb = mix({side + "Thigh": 1 - knee, side + "Shin": knee}, {side + "Foot": 1}, ankle)
    return mix(limb, {"hips": 1}, hip)


def hair(p):
    side = "left" if p[0] >= 0 else "right"
    y = p[1]
    levels = [(0.38, side + "Hair4"), (.79, side + "Hair3"), (1.21, side + "Hair2"),
              (1.535, side + "Hair1"), (1.625, "head")]
    if y <= levels[0][0]:
        return {levels[0][1]: 1}
    for (ya, a), (yb, b) in zip(levels, levels[1:]):
        if y < yb:
            t = smooth(ya, yb, y)
            return {a: 1 - t, b: t}
    return {"head": 1}


def body(p):
    if p[1] < 1.04:
        if abs(p[0]) > .25:
            return arm(p)
        return leg(p)
    # Arm surfaces lie well outside the torso except at the measured shoulder.
    if abs(p[0]) > .095 or (p[1] > 1.23 and abs(p[0]) > .040):
        return arm(p)
    return torso(p)


def weights_for(mesh, p):
    if mesh == 9:
        return hair(p)
    if mesh in [10, 11, 13] or 19 <= mesh <= 29:
        return {"head": 1}
    if mesh in [0, 7]:
        return torso(p)
    if mesh in [2, 3, 4, 5, 6]:
        return {"hips": 1}
    if mesh in [14, 15, 16]:
        return leg(p)
    if mesh in [17, 18, 30]:
        return arm(p)
    if mesh == 12:
        if p[1] > 1.40:
            return {"head": 1}
        if p[1] < .4:
            return leg(p)
        if abs(p[0]) > .14:
            return arm(p)
        if p[1] < 1.10:
            return {"hips": 1}
        return torso(p)
    return body(p)


def pack_weights(raw):
    chosen = sorted(((JID[name], max(0., value)) for name, value in raw.items() if value > 1e-9),
                    key=lambda pair: (-pair[1], pair[0]))[:4]
    total = sum(value for _, value in chosen)
    ids = [pair[0] for pair in chosen] + [0] * (4 - len(chosen))
    values = [pair[1] / total for pair in chosen] + [0.] * (4 - len(chosen))
    return ids, exact_weights(values)


def exact_weights(values):
    # Power-of-two quantisation is representable exactly in float32, with an
    # exactly-one sum. This avoids even a tiny neutral-pose scale residual.
    denominator = 1 << 20
    total = sum(values)
    packed = [round(value / total * denominator) for value in values]
    dominant = max(range(len(packed)), key=lambda i: packed[i])
    packed[dominant] += denominator - sum(packed)
    return [value / denominator for value in packed]


def design(source_document):
    node_start = len(source_document["nodes"])
    return {"schemaVersion": 1, "provenance": {"skeleton": "authored offline from static source landmarks",
              "sourceHadSkin": False, "sourceHadAnimation": False, "generator": "scripts/rig-companion.py"},
            "coordinateSystem": {"up": "Y", "forward": "+Z", "left": "+X", "handedness": "right", "unit": "source-model-unit"},
            "bind": {"meshBindMatrix": "identity", "jointOrderAuthority": "GLB skins[0].joints",
                     "inverseBindMatrices": "inverse(restWorld)", "restRotations": "identity",
                     "worldJointGrid": "1/4096", "originalSceneTransformChain": "retained; -90X/+90X cancels"},
            "joints": [{"name": name, "skinIndex": i, "nodeIndex": node_start + i,
                        "parent": None if PARENTS[i] is None else NAMES[PARENTS[i]],
                        "parentSkinIndex": PARENTS[i], "restWorld": WORLD[i], "restLocal": LOCAL[i],
                        "rotation": [0, 0, 0, 1], "tag": tag}
                       for i, (name, _, _, tag) in enumerate(JOINT_SPEC)],
            "landmarks": {name: node_start + JID[joint] for name, joint in {
                "hip": "hips", "head": "head", "hand.l": "leftHand", "hand.r": "rightHand",
                "foot.l": "leftFoot", "foot.r": "rightFoot"}.items()},
            "landmarkEvidence": "component connectivity, measured mesh cross-sections, front/profile static render",
            "limitations": ["No finger joints; entire hand deforms with hand joint.",
                            "Skirt is hips-bound for standing gestures.",
                            "Proximity seam conditioning does not guarantee crease-free broad articulation.",
                            "This rig authoring report does not establish animation or visual integrity gates."]}


def append_accessor(document, binary, rows, component_type, value_type, target=None):
    binary.extend(b"\x00" * (-len(binary) % 4))
    offset = len(binary)
    fmt = {5123: "H", 5126: "f"}[component_type]
    flat = [value for row in rows for value in row]
    payload = struct.pack("<" + fmt * len(flat), *flat)
    binary.extend(payload)
    view = {"buffer": 0, "byteOffset": offset, "byteLength": len(payload)}
    if target:
        view["target"] = target
    document["bufferViews"].append(view)
    a = {"bufferView": len(document["bufferViews"]) - 1, "componentType": component_type,
         "count": len(rows), "type": value_type}
    document["accessors"].append(a)
    return len(document["accessors"]) - 1


def emit_glb(path, document, binary):
    document["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    length = 12 + 8 + len(encoded) + 8 + len(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, length))
        f.write(struct.pack("<II", len(encoded), 0x4E4F534A))
        f.write(encoded)
        f.write(struct.pack("<II", len(binary), 0x004E4942))
        f.write(binary)


def row_matrix(p):
    return [1, 0, 0, p[0], 0, 1, 0, p[1], 0, 0, 1, p[2], 0, 0, 0, 1]


def build():
    source_doc, source_bin, _ = reference.parse_glb(SOURCE)
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    config = design(source_doc)
    dump(ARTIFACTS / "rig-design.json", config)
    source_rig = reference.read_rig(SOURCE).to_dict()
    source_rig["note"] = ("Original static source has no skin. The derived skeleton is authored offline, "
                          "not recovered from the source.")
    dump(ARTIFACTS / "source-rig-read.json", source_rig)

    # Freeze once before adding anything. Never replace a pre-existing freeze
    # with modified geometry; a rebuild must satisfy the original manifest.
    original = geometry_payload(source_doc, source_bin)
    freeze_path = ARTIFACTS / "geometry-freeze.json"
    if freeze_path.exists():
        freeze = parity.Manifest.from_dict(json.loads(freeze_path.read_text()))
        original_parity = parity.verify(freeze, original).to_dict()
        if original_parity["status"] != "pass":
            raise RuntimeError("Source differs from existing geometry freeze")
    else:
        freeze = parity.freeze(original)
        dump(freeze_path, freeze.to_dict())
    dump(ARTIFACTS / "geometry-freeze-summary.json", freeze.to_summary_dict())

    doc = copy.deepcopy(source_doc)
    binary = bytearray(source_bin)
    mesh_positions, mesh_indices, mesh_weights = [], [], []
    component_report = []
    for mi, mesh in enumerate(doc["meshes"]):
        primitive = mesh["primitives"][0]
        positions = accessor(source_doc, source_bin, primitive["attributes"]["POSITION"])
        triangles = [row[0] for row in accessor(source_doc, source_bin, primitive["indices"])]
        labels, comp = components(positions, triangles)
        component_report.append({"mesh": mi, "material": doc["materials"][primitive["material"]]["name"], "components": comp})
        ids, values = [], []
        for p in positions:
            i, w = pack_weights(weights_for(mi, p))
            ids.append(i)
            values.append(w)
        mesh_positions.append(positions)
        mesh_indices.append(ids)
        mesh_weights.append(values)
    dump(ARTIFACTS / "mesh-component-inventory.json", component_report)

    # Cross-part conditioning is intentionally confined to garments/skin and
    # attachments. Hair/face must not borrow arm weights where they pass nearby.
    seam_meshes = [0, 1, 4, 5, 6, 7, 8, 12, 14, 15, 16, 17, 18, 30]
    seam_positions, seam_parts, seam_i, seam_w, mapping = [], [], [], [], []
    for mi in seam_meshes:
        for vi, p in enumerate(mesh_positions[mi]):
            # Head accessories are rigidly attached to head, excluded from seam averaging.
            if mi == 12 and p[1] > 1.4:
                continue
            mapping.append((mi, vi))
            seam_positions.append(p)
            seam_parts.append(mi)
            seam_i.extend(mesh_indices[mi][vi])
            seam_w.extend(mesh_weights[mi][vi])
    height = max(p[1] for ps in mesh_positions for p in ps) - min(p[1] for ps in mesh_positions for p in ps)
    binding = conditioning.SkinBinding(seam_positions, seam_parts, seam_i, seam_w, len(NAMES))
    conditioned, report = conditioning.blend_weights(binding, height, radius=.006)
    if conditioning.validate_binding(conditioned):
        raise RuntimeError("Conditioned binding failed structural validation")
    for oi, (mi, vi) in enumerate(mapping):
        mesh_indices[mi][vi] = conditioned.skin_indices[oi * 4:oi * 4 + 4]
        values = conditioned.skin_weights[oi * 4:oi * 4 + 4]
        mesh_weights[mi][vi] = exact_weights(values)
    conditioning_report = report.to_dict()
    conditioning_report["scope"] = {"meshIndices": seam_meshes, "excluded": "head accessories; all longhair and face materials"}
    conditioning_report["evidenceBoundary"] = "structural proximity blend; crease/hole pixel counts not measured here"
    dump(ARTIFACTS / "skin-conditioning.json", conditioning_report)

    for mi, mesh in enumerate(doc["meshes"]):
        p = mesh["primitives"][0]
        p["attributes"]["JOINTS_0"] = append_accessor(doc, binary, mesh_indices[mi], 5123, "VEC4", 34962)
        p["attributes"]["WEIGHTS_0"] = append_accessor(doc, binary, mesh_weights[mi], 5126, "VEC4", 34962)
    first_joint = len(doc["nodes"])
    for i, name in enumerate(NAMES):
        children = [first_joint + j for j, parent in enumerate(PARENTS) if parent == i]
        node = {"name": name, "translation": LOCAL[i], "extras": {"companionJoint": True, "role": JOINT_SPEC[i][3]}}
        if children:
            node["children"] = children
        doc["nodes"].append(node)
    # Node 7 is the measured identity mesh container beneath the cancelling
    # importer rotations. Skeleton and mesh nodes are siblings in one bind space.
    doc["nodes"][7].setdefault("children", []).append(first_joint)
    inverse_binds = [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1] for p in WORLD]
    ibm_accessor = append_accessor(doc, binary, inverse_binds, 5126, "MAT4")
    doc["skins"] = [{"name": "MikuCompanionAuthoredSkin", "skeleton": first_joint,
                     "joints": list(range(first_joint, first_joint + len(NAMES))), "inverseBindMatrices": ibm_accessor,
                     "extras": {"provenance": "authored from static geometry; not present in source GLB"}}]
    for node in doc["nodes"][:first_joint]:
        if "mesh" in node:
            node["skin"] = 0
    doc.setdefault("extras", {})["companionRig"] = {"schemaVersion": 1, "sourceHadSkin": False,
        "sourceSha256": source_hash, "geometryPolicy": "original BIN prefix and geometry accessors byte-identical",
        "jointOrder": "skin.joints", "generator": "scripts/rig-companion.py"}
    emit_glb(OUTPUT, doc, binary)
    derived_doc, derived_bin, _ = reference.parse_glb(OUTPUT)

    # Both plugin number parity and direct accessor-byte parity are recorded.
    restored = geometry_payload(derived_doc, derived_bin)
    parity_report = parity.verify(freeze, restored).to_dict()
    dump(ARTIFACTS / "geometry-parity.json", parity_report)
    byte_report = {"sourceSha256": source_hash, "outputSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
                   "originalBinaryPrefixPreserved": derived_bin[:len(source_bin)] == source_bin,
                   "sourceAccessorCount": len(source_doc["accessors"]), "accessors": []}
    for i in range(len(source_doc["accessors"])):
        a, b = accessor_bytes(source_doc, source_bin, i), accessor_bytes(derived_doc, derived_bin, i)
        byte_report["accessors"].append({"index": i, "byteLength": len(a), "sha256": hashlib.sha256(a).hexdigest(), "identical": a == b})
    byte_report["passed"] = byte_report["originalBinaryPrefixPreserved"] and all(row["identical"] for row in byte_report["accessors"])
    dump(ARTIFACTS / "geometry-byte-parity.json", byte_report)

    # The emitted GLB is now read by the plugin; this readout is runtime authority.
    rig = reference.read_rig(OUTPUT)
    rig_result = rig.to_dict()
    rig_result["ok"] = not rig.structural_failure
    rig_result["errors"] = [rig.structural_failure] if rig.structural_failure else []
    rig_result["authoringProvenance"] = config["provenance"]
    dump(ARTIFACTS / "glb-rig-reference.json", rig_result)

    spec = importlib.util.spec_from_file_location("validate_rig_payload", VALIDATOR)
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    payload = {"schemaVersion": 1, "coordinateSystem": config["coordinateSystem"], "names": NAMES,
               "joints": WORLD, "parents": PARENTS, "matrix_local": [row_matrix(p) for p in LOCAL],
               "skinIndex": [row for mesh in mesh_indices for row in mesh],
               "skinWeight": [row for mesh in mesh_weights for row in mesh]}
    dump(ARTIFACTS / "rig-validation-payload.json", payload)
    validation = validator.validate(payload)
    dump(ARTIFACTS / "rig-validation.json", validation)
    dump(ARTIFACTS / "landmarks.json", config["landmarks"])

    # Exact rest cancellation follows from binary-grid local translations and
    # inverse binds, tested using values read from the actual output accessors.
    ibms = accessor(derived_doc, derived_bin, derived_doc["skins"][0]["inverseBindMatrices"])
    max_restore = 0.
    for i, matrix in enumerate(ibms):
        joint_node = derived_doc["nodes"][first_joint + i]
        accumulated = list(joint_node["translation"])
        parent = PARENTS[i]
        while parent is not None:
            accumulated = [accumulated[k] + LOCAL[parent][k] for k in range(3)]
            parent = PARENTS[parent]
        max_restore = max(max_restore, *(abs(accumulated[k] + matrix[12 + k]) for k in range(3)))
    summary = {"source": str(SOURCE.relative_to(ROOT)), "output": str(OUTPUT.relative_to(ROOT)),
               "sourceHadSkin": False, "jointCount": len(NAMES), "meshCount": len(doc["meshes"]),
               "vertexCount": sum(len(p) for p in mesh_positions), "figureHeight": height,
               "animationCount": len(doc.get("animations", [])), "morphTargetCount": 0,
               "geometryParity": parity_report["status"], "geometryByteParity": byte_report["passed"],
               "pluginRigRead": rig_result["ok"], "structuralValidation": validation["passed"],
               "restTranslationInverseResidual": max_restore,
               "weightSumMaximumResidual": max(abs(sum(row) - 1) for mesh in mesh_weights for row in mesh),
               "weightQuantisation": "1/1048576, exactly representable float32 and exact sum=1",
               "runtimeDeformation": "unevaluated; browser probe required", "fullRigGate": "unevaluated"}
    dump(ARTIFACTS / "rig-build-report.json", summary)
    if parity_report["status"] != "pass" or not byte_report["passed"] or not validation["passed"] or not rig_result["ok"]:
        raise RuntimeError("Rig authoring deterministic gate failed")
    print(json.dumps(summary, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--design-only", action="store_true")
    args = parser.parse_args()
    if args.design_only:
        document, _, _ = reference.parse_glb(SOURCE)
        dump(ARTIFACTS / "rig-design.json", design(document))
        print(ARTIFACTS / "rig-design.json")
    else:
        build()


if __name__ == "__main__":
    main()
