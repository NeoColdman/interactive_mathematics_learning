"""Add authored standing gestures and facial morphs to the frozen derived rig GLB.

Original geometry accessors and existing BIN bytes remain untouched. Motion purpose
is authored intent; independent plugin measurements and browser evidence judge playback.
"""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public/companion/hatsune_miku_v6-rigged.glb'
OUTPUT = ROOT / 'public/companion/hatsune_miku_v6-animated.glb'
EVIDENCE = ROOT / '.img2threejs/imported-glb/animation'
raw = SOURCE.read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20 + json_size])
bin_start = 20 + json_size + 8
binary = bytearray(raw[bin_start:])
original_binary = bytes(binary)
design = json.loads((EVIDENCE / 'rig-design.json').read_text())
joints = {j['name']: j for j in design['joints']}


def add_accessor(values, kind, count):
    while len(binary) % 4:
        binary.append(0)
    start = len(binary)
    binary.extend(struct.pack('<' + 'f' * len(values), *values))
    view = len(g['bufferViews'])
    g['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(values) * 4})
    accessor = {'bufferView': view, 'componentType': 5126, 'count': count, 'type': kind}
    if kind == 'SCALAR':
        accessor.update(min=[min(values)], max=[max(values)])
    elif kind == 'VEC3':
        accessor.update(min=[min(values[i::3]) for i in range(3)], max=[max(values[i::3]) for i in range(3)])
    g['accessors'].append(accessor)
    return len(g['accessors']) - 1


def positions(index):
    a = g['accessors'][index]
    v = g['bufferViews'][a['bufferView']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<fff', original_binary, offset + i * v.get('byteStride', 12)) for i in range(a['count'])]


def triangle_indices(primitive):
    a = g['accessors'][primitive['indices']]
    v = g['bufferViews'][a['bufferView']]
    fmt, width = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4)}[a['componentType']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return struct.unpack_from('<' + fmt * a['count'], original_binary, offset)


def smooth(t):
    t = min(1, max(0, t))
    return t * t * t * (10 + t * (-15 + 6 * t))


def expression_delta(material, x, y, z):
    by = sy = sx = 0.
    ex = abs(x) - .0415
    line = 1.485 + .0025 * max(0, 1 - (ex / .032) ** 2)
    if material in ('eyes19', 'eyelashes20', 'eyeLight21', 'eyesocket22', 'whiteeyes23', 'material'):
        by = (line - y) * (.96 if material == 'eyelashes20' else .98)
    elif material == 'head27' and z > .035:
        r = math.sqrt((ex / .046) ** 2 + ((y - 1.487) / .038) ** 2)
        strength = 1 - smooth((r - .70) / .65)
        by = (line - y) * strength * .98
    if material in ('mouth25', 'mouthInside26', 'tooth28'):
        sy = .0045 * min(1, (abs(x) / .014) ** 1.5)
        sx = x * .07
    elif material == 'head27' and z > .04:
        r = math.sqrt((x / .037) ** 2 + ((y - 1.430) / .025) ** 2)
        sy = .0045 * min(1, (abs(x) / .014) ** 1.5) * (1 - smooth((r - .5) / .7))
    elif material == 'eyebrow24':
        sy = .0015 * max(0, 1 - (ex / .035) ** 2)
    bz = -.0007 if material.startswith(('eyes19', 'whiteeyes23', 'eyeLight21')) else 0.
    return [0., by, bz], [sx, sy, 0.]


def normal_delta(primitive, base, delta):
    """Recompute only the deformed neighborhood, welding UV-seam duplicates.

    Keep the frozen NORMAL accessor intact and append relative morph normals.
    Zero-area eye triangles retain their original normal rather than emitting NaN.
    """
    normals = positions(primitive['attributes']['NORMAL'])
    if primitive is head_primitive:
        # This stylized asset uses deliberately smoothed face normals. Preserve
        # that authored normal field rather than revealing its long eye-rim
        # triangles when the open socket closes.
        out = []
        for i, point in enumerate(base):
            d = delta[i * 3:i * 3 + 3]
            if not any(abs(c) > 1e-12 for c in d):
                out.extend([0., 0., 0.])
                continue
            before = face_normal_field(point[0], point[1])
            after = face_normal_field(point[0] + d[0], point[1] + d[1])
            n = [normals[i][k] + after[k] - before[k] for k in range(3)]
            length = math.sqrt(sum(c*c for c in n))
            out.extend([n[k] / length - normals[i][k] for k in range(3)] if length > 1e-12 else [0., 0., 0.])
        return out
    target = [tuple(p[k] + delta[i * 3 + k] for k in range(3)) for i, p in enumerate(base)]
    keys = [tuple(round(c, 7) for c in p) for p in base]
    sums, affected = {}, set()
    indices = triangle_indices(primitive)
    for offset in range(0, len(indices), 3):
        ids = indices[offset:offset + 3]
        p, q, r = (target[i] for i in ids)
        u, v = [q[k] - p[k] for k in range(3)], [r[k] - p[k] for k in range(3)]
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        moved = any(any(abs(delta[i * 3 + k]) > 1e-12 for k in range(3)) for i in ids)
        for i in ids:
            total = sums.setdefault(keys[i], [0., 0., 0.])
            for k in range(3):
                total[k] += cross[k]
            if moved:
                affected.add(keys[i])
    out = []
    for i, key in enumerate(keys):
        n = sums.get(key, normals[i])
        length = math.sqrt(sum(c*c for c in n))
        if key not in affected or length < 1e-14:
            out.extend([0., 0., 0.])
        else:
            out.extend([n[k] / length - normals[i][k] for k in range(3)])
    return out


# The closed lash follows the closed head surface, including at the three-quarter
# view. A fixed z offset would either bury it in the lid or float it off the face.
head_primitive = g['meshes'][27]['primitives'][0]
head_base = positions(head_primitive['attributes']['POSITION'])
head_normals = positions(head_primitive['attributes']['NORMAL'])
normal_samples = list({tuple(round(v, 7) for v in (*p, *n)) for p, n in zip(head_base, head_normals)
                       if p[2] > .04 and 1.40 < p[1] < 1.56 and n[2] > .3})
normal_cache = {}


def face_normal_field(x, y):
    key = (round(x, 7), round(y, 7))
    if key not in normal_cache:
        closest = sorted((((p[0]-x)**2 + (p[1]-y)**2, p[3:]) for p in normal_samples), key=lambda p: p[0])[:16]
        weights = [1 / (d + .00004) for d, _ in closest]
        total = sum(weights)
        normal_cache[key] = [sum(n[k] * w for (_, n), w in zip(closest, weights)) / total for k in range(3)]
    return normal_cache[key]


closed_head = [tuple(p[k] + expression_delta('head27', *p)[0][k] for k in range(3)) for p in head_base]
head_indices = triangle_indices(head_primitive)
head_triangles = [tuple(closed_head[i] for i in head_indices[o:o + 3]) for o in range(0, len(head_indices), 3)]


def head_surface_z(x, y):
    hits = []
    for a, b, c in head_triangles:
        if not (min(a[0], b[0], c[0]) - 1e-7 <= x <= max(a[0], b[0], c[0]) + 1e-7 and
                min(a[1], b[1], c[1]) - 1e-7 <= y <= max(a[1], b[1], c[1]) + 1e-7):
            continue
        denominator = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
        if abs(denominator) < 1e-14:
            continue
        u = ((b[1]-c[1])*(x-c[0]) + (c[0]-b[0])*(y-c[1])) / denominator
        v = ((c[1]-a[1])*(x-c[0]) + (a[0]-c[0])*(y-c[1])) / denominator
        if min(u, v, 1-u-v) >= -1e-6:
            hits.append(u*a[2] + v*b[2] + (1-u-v)*c[2])
    return max(hits) if hits else None


def quaternion(x, y, z):
    c1, c2, c3 = math.cos(x / 2), math.cos(y / 2), math.cos(z / 2)
    s1, s2, s3 = math.sin(x / 2), math.sin(y / 2), math.sin(z / 2)
    return [s1*c2*c3+c1*s2*s3, c1*s2*c3-s1*c2*s3, c1*c2*s3+s1*s2*c3, c1*c2*c3-s1*s2*s3]


def idle(t):
    phase = 2 * math.pi * t / 4
    pose = {name: [0., 0., 0.] for name in joints}
    pose['leftUpperArm'] = [-.025, -.035, -.70 + .009 * math.sin(phase)]
    pose['rightUpperArm'] = [-.025, .035, .70 - .009 * math.sin(phase)]
    pose['leftForeArm'] = [-.025, 0, .035]
    pose['rightForeArm'] = [-.025, 0, -.035]
    pose['chest'] = [.008 * math.sin(phase), 0, 0]
    pose['head'] = [.009 * math.sin(phase), .018 * math.sin(phase), .009 * math.sin(phase)]
    for side, sign in [('left', 1), ('right', -1)]:
        for k in range(1, 5):
            pose[f'{side}Hair{k}'] = [.008 * math.sin(phase - k * .42), .003 * sign * math.sin(phase - k * .3), .008 * sign * math.sin(phase - k * .4)]
    return pose


def gesture(state, t, duration):
    if state == 'idle':
        return idle(t)
    pose = idle(0)
    envelope = smooth(t / .48) * smooth((duration - t) / .5)
    target = {name: list(v) for name, v in pose.items()}
    if state == 'wave':
        target['rightUpperArm'] = [-.08, .14, -.68]
        target['rightForeArm'] = [-.12, 0, -1.25]
        target['rightHand'] = [-.18, .15, .25 * math.sin(t * 12)]
        target['head'] = [-.02, -.09, -.045]
    elif state == 'encourage':
        target['chest'] = [.075, 0, 0]
        target['head'] = [-.04, -.035, .045]
        target['rightUpperArm'] = [-.08, .20, .15]
        target['rightForeArm'] = [-.35, -.05, -1.30]
        target['rightHand'] = [.07, .1, .08 * math.sin(t * 5)]
    elif state == 'correct':
        target['head'] = [.11 * math.sin(t * math.pi * 2 / duration), .025, -.02]
        target['leftUpperArm'] = [-.12, -.08, -.28]
        target['rightUpperArm'] = [-.12, .08, .28]
        target['leftForeArm'] = [-.25, 0, .18]
        target['rightForeArm'] = [-.25, 0, -.18]
    elif state == 'retry':
        target['head'] = [.075 * math.sin(t * math.pi * 2 / duration), -.06, -.055]
        target['rightUpperArm'] = [-.07, .1, .26]
        target['rightForeArm'] = [-.22, 0, -.90]
        target['rightHand'] = [.06, 0, .12]
    elif state == 'thinking':
        target['head'] = [.025, -.09, .09]
        target['rightUpperArm'] = [-.08, .26, -.28]
        target['rightForeArm'] = [-.28, .05, -2.20]
        target['rightHand'] = [.10, -.13, -.15]
    elif state == 'celebrate':
        target['leftUpperArm'] = [-.06, -.10, .68]
        target['rightUpperArm'] = [-.06, .10, -.68]
        target['leftForeArm'] = [-.12, 0, 1.05]
        target['rightForeArm'] = [-.12, 0, -1.05]
        target['leftHand'] = [-.12, .06, -.16 * math.sin(t * 8)]
        target['rightHand'] = [-.12, -.06, .16 * math.sin(t * 8)]
        target['head'] = [-.07, .04 * math.sin(t * 3), .035 * math.sin(t * 4)]
    for name in joints:
        pose[name] = [a + (b-a) * envelope for a, b in zip(pose[name], target[name])]
    for side, sign in [('left', 1), ('right', -1)]:
        for k in range(1, 5):
            pose[f'{side}Hair{k}'][0] += envelope * .010 * math.sin(t * 4 - k * .4)
            pose[f'{side}Hair{k}'][2] += envelope * sign * .008 * math.sin(t * 4 - k * .5)
    return pose


face_meshes = []
face_reports = []
for mi, mesh in enumerate(g['meshes']):
    material = g['materials'][mesh['primitives'][0]['material']]['name']
    if mi < 19 or mi > 29:
        continue
    for primitive in mesh['primitives']:
        base = positions(primitive['attributes']['POSITION'])
        blink, smile = [], []
        for x, y, z in base:
            b, s = expression_delta(material, x, y, z)
            if material == 'eyelashes20':
                surface = head_surface_z(x, y + b[1])
                if surface is not None:
                    b[2] = surface + .00065 - z
            blink.extend(b)
            smile.extend(s)
        primitive['targets'] = [
            {'POSITION': add_accessor(delta, 'VEC3', len(base)),
             'NORMAL': add_accessor(normal_delta(primitive, base, delta), 'VEC3', len(base))}
            for delta in (blink, smile)]
        face_reports.append({'mesh':mi,'material':material,'vertices':len(base), 'maxBlinkDelta':max(abs(v) for v in blink), 'maxSmileDelta':max(abs(v) for v in smile)})
    mesh['weights'] = [0, 0]
    mesh.setdefault('extras', {})['targetNames'] = ['blink', 'smile']
    face_meshes.extend(i for i, node in enumerate(g['nodes']) if node.get('mesh') == mi)


def facial(state, t, duration):
    if state == 'idle':
        center, smile = 1.62, .12
        envelope = 1.
    else:
        center = min(1.1, duration * .55)
        envelope = smooth(t / .48) * smooth((duration - t) / .5)
        smile = .12 + envelope * {'wave':.45,'encourage':.30,'correct':.72,'retry':.48,'thinking':.10,'celebrate':.85}[state]
    blink = smooth((t - (center - .10)) / .08) * (1 - smooth((t - (center + .015)) / .10))
    return [blink, smile]


durations = {'idle':4.,'wave':2.6,'encourage':2.2,'correct':2.,'retry':2.2,'thinking':2.6,'celebrate':3.}
clip_reports = []
g['animations'] = []
for name, duration in durations.items():
    count = round(duration * 30) + 1
    times = [duration * i / (count - 1) for i in range(count)]
    time_accessor = add_accessor(times, 'SCALAR', count)
    clip = {'name':name,'channels':[],'samplers':[], 'extras':{'declaredPurpose':name,'intentInferred':True,'loopIntended':name=='idle','stance':'both feet planted','source':'authored standing gestures'}}
    for joint_name, joint in joints.items():
        values = [v for t in times for v in quaternion(*gesture(name, t, duration)[joint_name])]
        output = add_accessor(values, 'VEC4', count)
        si = len(clip['samplers'])
        clip['samplers'].append({'input':time_accessor,'output':output,'interpolation':'LINEAR'})
        clip['channels'].append({'sampler':si,'target':{'node':joint['nodeIndex'],'path':'rotation'}})
    weights = [value for t in times for value in facial(name, t, duration)]
    weight_accessor = add_accessor(weights, 'SCALAR', len(weights))
    for node_index in face_meshes:
        si = len(clip['samplers'])
        clip['samplers'].append({'input':time_accessor,'output':weight_accessor,'interpolation':'LINEAR'})
        clip['channels'].append({'sampler':si,'target':{'node':node_index,'path':'weights'}})
    g['animations'].append(clip)
    clip_reports.append({'name':name,'duration':duration,'frames':count,'rotationChannels':len(joints),'morphChannels':len(face_meshes),'loopIntended':name=='idle'})

assert bytes(binary[:len(original_binary)]) == original_binary
g['buffers'][0]['byteLength'] = len(binary)
g['asset'].setdefault('extras', {})['companionMotion'] = {'authoringScript':'scripts/author-companion-motion.py','sourceHadAnimation':False,'expressionTargets':['blink','smile'],'approval':'static appearance confirmed by user; motion sample awaits review'}
encoded = json.dumps(g, separators=(',', ':'), ensure_ascii=False).encode()
encoded += b' ' * (-len(encoded) % 4)
binary += b'\0' * (-len(binary) % 4)
result = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(encoded) + 8 + len(binary)) + struct.pack('<I4s',len(encoded),b'JSON') + encoded + struct.pack('<I4s',len(binary),b'BIN\0') + binary
OUTPUT.write_bytes(result)
report = {'source':str(SOURCE.relative_to(ROOT)),'output':str(OUTPUT.relative_to(ROOT)), 'sourceSha256':hashlib.sha256(raw).hexdigest(),'outputSha256':hashlib.sha256(result).hexdigest(),'originalBinPrefixPreserved':True,'originalGeometryAccessorsUnchanged':True,'clips':clip_reports,'morphs':face_reports,'limits':['Authored motion intent is not a classifier claim.','No finger articulation or lip sync.','Face morph topology and broad sleeve bends require browser visual review.','Sample has no real exercise-data integration.']}
(EVIDENCE / 'motion-authoring.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':str(OUTPUT),'clips':len(g['animations']),'morphMeshes':len(face_reports),'bytes':len(result)}))
