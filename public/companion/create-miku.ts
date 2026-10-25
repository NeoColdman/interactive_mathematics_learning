// Procedural reconstruction, authored against .img2threejs/miku-sculpt-spec.json.
// Current unlocked pass: blockout. No skeleton, clips or expression animation.
import { createMikuHair } from './miku-hair.js';

export async function createMikuModel(THREE: any, options: any = {}) {
  const root = new THREE.Group();
  root.name = 'miku-learning-companion';
  const clay = new THREE.MeshStandardMaterial({ color: '#aab8b2', roughness: .9, metalness: 0 });
  const materials: any = { skin: clay, hair: clay, cloth: clay, ink: clay, cyan: clay };
  const parts: any[] = [];

  function mesh(name: string, geometry: any, parent: any = root, material: any = clay) {
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.userData.componentId = name;
    parent.add(object);
    parts.push(object);
    return object;
  }

  // Smooth, closed ring lofts give a continuous skull, fitted torso and limbs.
  function loft(rings: number[][], { samples = 40, radial = 48, centerX = 0, centerZ = 0, cap = true } = {}) {
    const curve = new THREE.CatmullRomCurve3(rings.map(r => new THREE.Vector3(r[0], r[1], r[2])), false, 'catmullrom', .2);
    const centers = new THREE.CatmullRomCurve3(rings.map(r => new THREE.Vector3(r[3] ?? centerX, r[4] ?? centerZ, 0)), false, 'catmullrom', .2);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const p = curve.getPoint(i / samples);
      const center = centers.getPoint(i / samples);
      const rx = Math.max(p.y, .001), rz = Math.max(p.z, .001);
      for (let j = 0; j <= radial; j++) {
        const angle = j / radial * Math.PI * 2;
        positions.push(center.x + rx * Math.sin(angle), p.x, center.y + rz * Math.cos(angle));
        uvs.push(j / radial, i / samples);
        if (i < samples && j < radial) {
          const a = i * (radial + 1) + j, b = a + radial + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    if (cap) {
      for (const [row, top] of [[0, false], [samples, true]] as const) {
        const center = positions.length / 3;
        const start = row * (radial + 1);
        const endCenter = centers.getPoint(row / samples);
        positions.push(endCenter.x, positions[start * 3 + 1], endCenter.y);
        uvs.push(.5, .5);
        for (let j = 0; j < radial; j++) {
          if (top) indices.push(center, start + j, start + j + 1);
          else indices.push(center, start + j + 1, start + j);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }

  function sweep(points: number[][], radii: number[][], { samples = 28, radial = 24 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', .25);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples, point = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
      const scaled = t * (radii.length - 1), k = Math.min(Math.floor(scaled), radii.length - 2), f = scaled - k;
      const rx = THREE.MathUtils.lerp(radii[k][0], radii[k + 1][0], f);
      const rz = THREE.MathUtils.lerp(radii[k][1], radii[k + 1][1], f);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * Math.PI * 2;
        const v = point.clone().addScaledVector(side, Math.cos(a) * rx).addScaledVector(normal, Math.sin(a) * rz);
        positions.push(v.x, v.y, v.z); uvs.push(j / radial, t);
        if (i < samples && j < radial) {
          const a = i * (radial + 1) + j, b = a + radial + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    for (const row of [0, samples]) {
      const center = positions.length / 3, point = curve.getPoint(row / samples), start = row * (radial + 1);
      positions.push(point.x, point.y, point.z); uvs.push(.5, row / samples);
      for (let j = 0; j < radial; j++) {
        if (row === 0) indices.push(center, start + j + 1, start + j);
        else indices.push(center, start + j, start + j + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }

  const torso = mesh('torso', loft([[2.12,.22,.14],[2.3,.17,.12],[2.52,.22,.145],[2.72,.255,.145],[2.78,.19,.12]]));
  mesh('neck', loft([[2.73,.07,.065],[2.81,.066,.06],[2.88,.077,.07]], { samples: 16, radial: 32 }));
  const headRings: [number, number, number][] = [[-.27,.002,.035],[-.21,.135,.11],[-.10,.205,.16],[.05,.23,.185],[.19,.2,.17],[.27,.004,.01]];
  const head = mesh('head', loft(headRings, { samples: 48, radial: 64 }));
  head.position.set(0, 3.07, .005);

  mesh('blouse', loft([[2.0,.29,.16,-.025],[2.18,.24,.145,-.06],[2.32,.16,.13,-.07],[2.53,.235,.155,-.015],[2.72,.25,.15,0]]));
  mesh('skirt', loft([[1.66,.465,.25,.05],[1.80,.40,.222,.04],[2.045,.25,.16,.03]], { cap: false }));

  for (const side of [1, -1]) {
    const suffix = side === 1 ? 'l' : 'r';
    mesh(`upper-arm-${suffix}`, sweep([[side*.245,2.75,0],[side*.265,2.63,0],[side*.285,2.50,.01]], [[.075,.07],[.064,.06],[.055,.05]]));
    const referenceSections = side === -1
      ? [[300,367.5,10],[350,365.5,14],[400,350.5,24],[450,330.5,26],[500,302,35],[535,296,53]]
      : [[300,560,11],[350,570,27],[400,606,33],[450,657,53],[495,700,77]];
    const sleeveRings = [...referenceSections].reverse().map(([y,x,r]) => [(1190-y)*(3.4/1190),r*(3.4/1190),.09,(x-460)*(3.4/1190),.025]);
    mesh(`sleeve-${suffix}`, loft(sleeveRings,{samples:32,radial:32}));
    const palm = mesh(`hand-${suffix}`, new THREE.SphereGeometry(1, 20, 16));
    palm.position.set(side === -1 ? -.62 : .80,side === -1 ? 1.81 : 1.92,.06); palm.scale.set(.1,.048,.032); palm.rotation.z = -side*.35;
    const wrist = mesh(`wrist-${suffix}`, new THREE.SphereGeometry(1,16,12));
    wrist.userData.componentId = `hand-${suffix}`;
    wrist.userData.explodeWithParent = true;
    wrist.position.set(side === -1 ? -.59 : .76,side === -1 ? 1.87 : 1.97,.06);
    wrist.scale.set(.04,.055,.029);
    const centers = side === 1 ? [.01,.02,.055,.075,.085,.13] : [-.015,-.005,.02,-.015,-.04,-.13];
    const depth = side === 1 ? -.05 : .055;
    mesh(`thigh-${suffix}`, loft([[1.27,.09,.095,side*.10,depth],[1.45,.107,.104,side*.13,depth],[1.70,.115,.11,side*.16,depth]], { samples: 24, radial: 32 }));
    mesh(`boot-${suffix}`, loft([[.08,.067,.10,centers[0],depth],[.18,.06,.085,centers[1],depth],[.46,.07,.085,centers[2],depth],[.75,.07,.09,centers[3],depth],[1.09,.085,.095,centers[4],depth],[1.46,.103,.105,centers[5],depth]], { samples: 40, radial: 32 }));
    const foot = mesh(`foot-${suffix}`, new THREE.SphereGeometry(1, 24, 16));
    foot.position.set(side === 1 ? .025 : -.04,.085,side === 1 ? .025 : .14); foot.scale.set(.08,.075,.18);
  }
  const hairAudit = createMikuHair(THREE, head, materials, { headRings });
  root.userData = {
    reconstruction: 'procedural-reference-derived',
    pass: 'blockout',
    animationStatus: 'awaiting-static-user-confirmation',
    sculptRuntime: { version: 1, parts: parts.map(part => part.name), pivots: ['head','neck','upper-arm-l','upper-arm-r'], clips: [] },
    reference: '/companion/reference.png',
    sourceSpec: '.img2threejs/miku-sculpt-spec.json',
    geometryAudit: {
      headLocalScalpRings: hairAudit.headLocalScalpRings,
      headLocalHairPoints: hairAudit.headLocalHairPoints,
      headLocalTailRoots: hairAudit.headLocalTailRoots,
      scalpClearance: hairAudit.scalpClearance,
      inferredRegions: hairAudit.inferredRegions
    }
  };
  root.updateMatrixWorld(true);
  return root;
}
