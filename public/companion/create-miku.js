import { createMikuHair } from "./miku-hair.js";
async function createMikuModel(THREE, options = {}) {
  const root = new THREE.Group();
  root.name = "miku-learning-companion";
  const clay = new THREE.MeshStandardMaterial({ color: "#aab8b2", roughness: 0.9, metalness: 0 });
  const materials = { skin: clay, hair: clay, cloth: clay, ink: clay, cyan: clay };
  const parts = [];
  function mesh(name, geometry, parent = root, material = clay) {
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.userData.componentId = name;
    parent.add(object);
    parts.push(object);
    return object;
  }
  function loft(rings, { samples = 40, radial = 48, centerX = 0, centerZ = 0, cap = true } = {}) {
    const curve = new THREE.CatmullRomCurve3(rings.map((r) => new THREE.Vector3(r[0], r[1], r[2])), false, "catmullrom", 0.2);
    const centers = new THREE.CatmullRomCurve3(rings.map((r) => new THREE.Vector3(r[3] ?? centerX, r[4] ?? centerZ, 0)), false, "catmullrom", 0.2);
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= samples; i++) {
      const p = curve.getPoint(i / samples);
      const center = centers.getPoint(i / samples);
      const rx = Math.max(p.y, 1e-3), rz = Math.max(p.z, 1e-3);
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
      for (const [row, top] of [[0, false], [samples, true]]) {
        const center = positions.length / 3;
        const start = row * (radial + 1);
        const endCenter = centers.getPoint(row / samples);
        positions.push(endCenter.x, positions[start * 3 + 1], endCenter.y);
        uvs.push(0.5, 0.5);
        for (let j = 0; j < radial; j++) {
          if (top) indices.push(center, start + j, start + j + 1);
          else indices.push(center, start + j + 1, start + j);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }
  function sweep(points, radii, { samples = 28, radial = 24 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.25);
    const positions = [], uvs = [], indices = [];
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
        positions.push(v.x, v.y, v.z);
        uvs.push(j / radial, t);
        if (i < samples && j < radial) {
          const a2 = i * (radial + 1) + j, b = a2 + radial + 1;
          indices.push(a2, a2 + 1, b, a2 + 1, b + 1, b);
        }
      }
    }
    for (const row of [0, samples]) {
      const center = positions.length / 3, point = curve.getPoint(row / samples), start = row * (radial + 1);
      positions.push(point.x, point.y, point.z);
      uvs.push(0.5, row / samples);
      for (let j = 0; j < radial; j++) {
        if (row === 0) indices.push(center, start + j + 1, start + j);
        else indices.push(center, start + j, start + j + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }
  const torso = mesh("torso", loft([[2.12, 0.22, 0.14], [2.3, 0.17, 0.12], [2.52, 0.22, 0.145], [2.72, 0.255, 0.145], [2.78, 0.19, 0.12]]));
  mesh("neck", loft([[2.73, 0.07, 0.065], [2.81, 0.066, 0.06], [2.88, 0.077, 0.07]], { samples: 16, radial: 32 }));
  const headRings = [[-0.27, 2e-3, 0.035], [-0.21, 0.135, 0.11], [-0.1, 0.205, 0.16], [0.05, 0.23, 0.185], [0.19, 0.2, 0.17], [0.27, 4e-3, 0.01]];
  const head = mesh("head", loft(headRings, { samples: 48, radial: 64 }));
  head.position.set(0, 3.07, 5e-3);
  mesh("blouse", loft([[2, 0.29, 0.16, -0.025], [2.18, 0.24, 0.145, -0.06], [2.32, 0.16, 0.13, -0.07], [2.53, 0.235, 0.155, -0.015], [2.72, 0.25, 0.15, 0]]));
  mesh("skirt", loft([[1.66, 0.465, 0.25, 0.05], [1.8, 0.4, 0.222, 0.04], [2.045, 0.25, 0.16, 0.03]], { cap: false }));
  for (const side of [1, -1]) {
    const suffix = side === 1 ? "l" : "r";
    mesh(`upper-arm-${suffix}`, sweep([[side * 0.245, 2.75, 0], [side * 0.265, 2.63, 0], [side * 0.285, 2.5, 0.01]], [[0.075, 0.07], [0.064, 0.06], [0.055, 0.05]]));
    const referenceSections = side === -1 ? [[300, 367.5, 10], [350, 365.5, 14], [400, 350.5, 24], [450, 330.5, 26], [500, 302, 35], [535, 296, 53]] : [[300, 560, 11], [350, 570, 27], [400, 606, 33], [450, 657, 53], [495, 700, 77]];
    const sleeveRings = [...referenceSections].reverse().map(([y, x, r]) => [(1190 - y) * (3.4 / 1190), r * (3.4 / 1190), 0.09, (x - 460) * (3.4 / 1190), 0.025]);
    mesh(`sleeve-${suffix}`, loft(sleeveRings, { samples: 32, radial: 32 }));
    const palm = mesh(`hand-${suffix}`, new THREE.SphereGeometry(1, 20, 16));
    palm.position.set(side === -1 ? -0.62 : 0.8, side === -1 ? 1.81 : 1.92, 0.06);
    palm.scale.set(0.1, 0.048, 0.032);
    palm.rotation.z = -side * 0.35;
    const wrist = mesh(`wrist-${suffix}`, new THREE.SphereGeometry(1, 16, 12));
    wrist.userData.componentId = `hand-${suffix}`;
    wrist.userData.explodeWithParent = true;
    wrist.position.set(side === -1 ? -0.59 : 0.76, side === -1 ? 1.87 : 1.97, 0.06);
    wrist.scale.set(0.04, 0.055, 0.029);
    const centers = side === 1 ? [0.01, 0.02, 0.055, 0.075, 0.085, 0.13] : [-0.015, -5e-3, 0.02, -0.015, -0.04, -0.13];
    const depth = side === 1 ? -0.05 : 0.055;
    mesh(`thigh-${suffix}`, loft([[1.27, 0.09, 0.095, side * 0.1, depth], [1.45, 0.107, 0.104, side * 0.13, depth], [1.7, 0.115, 0.11, side * 0.16, depth]], { samples: 24, radial: 32 }));
    mesh(`boot-${suffix}`, loft([[0.08, 0.067, 0.1, centers[0], depth], [0.18, 0.06, 0.085, centers[1], depth], [0.46, 0.07, 0.085, centers[2], depth], [0.75, 0.07, 0.09, centers[3], depth], [1.09, 0.085, 0.095, centers[4], depth], [1.46, 0.103, 0.105, centers[5], depth]], { samples: 40, radial: 32 }));
    const foot = mesh(`foot-${suffix}`, new THREE.SphereGeometry(1, 24, 16));
    foot.position.set(side === 1 ? 0.025 : -0.04, 0.085, side === 1 ? 0.025 : 0.14);
    foot.scale.set(0.08, 0.075, 0.18);
  }
  const hairAudit = createMikuHair(THREE, head, materials, { headRings });
  root.userData = {
    reconstruction: "procedural-reference-derived",
    pass: "blockout",
    animationStatus: "awaiting-static-user-confirmation",
    sculptRuntime: { version: 1, parts: parts.map((part) => part.name), pivots: ["head", "neck", "upper-arm-l", "upper-arm-r"], clips: [] },
    reference: "/companion/reference.png",
    sourceSpec: ".img2threejs/miku-sculpt-spec.json",
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
export {
  createMikuModel
};
