const MIKU_HAIR_PARAMETERS = {
  version: 1,
  space: "head-local; +Y up; +Z forward; +X character-left",
  approximation: "Side/rear depth and cross-section profiles inferred from a single front illustration.",
  headRings: [
    [-0.27, 0.02, 0.035],
    [-0.21, 0.135, 0.11],
    [-0.1, 0.205, 0.16],
    [0.05, 0.23, 0.185],
    [0.19, 0.2, 0.17],
    [0.27, 0.04, 0.06]
  ],
  scalp: {
    center: [0, 0.055, -0.015],
    radii: [0.255, 0.27, 0.21],
    clearance: 0.014,
    thickness: 9e-3,
    frontHairlineY: 0.09,
    napeY: -0.18,
    radialSegments: 56,
    verticalSegments: 24
  },
  tail: {
    // Roots are bound to the scalp parameterization, never independent floating points.
    scalpUV: [0.285, 0.675],
    rootEmbedDepth: 0.025,
    radialSegments: 14,
    curveSegments: 64,
    stations: [
      { point: [0, 0, 0], width: 0.08, thickness: 0.055 },
      { point: [0.12, -0.47, -0.06], width: 0.115, thickness: 0.07 },
      { point: [0.57, -1.4, 0.02], width: 0.19, thickness: 0.09 },
      { point: [0.72, -2, 0.14], width: 0.205, thickness: 0.075 },
      { point: [0.6, -2.48, 0.19], width: 0.12, thickness: 0.043 },
      { point: [0.45, -2.78, 0.18], width: 0, thickness: 0 }
    ]
  }
};
function interpolateHead(rings, y) {
  if (y <= rings[0][0]) return [...rings[0]];
  if (y >= rings[rings.length - 1][0]) return [...rings[rings.length - 1]];
  for (let i = 1; i < rings.length; i++) {
    if (y > rings[i][0]) continue;
    const a = rings[i - 1];
    const b = rings[i];
    const t = (y - a[0]) / (b[0] - a[0]);
    return [
      y,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * t
    ];
  }
  return [...rings[0]];
}
function meshFromArrays(THREE, positions, indices, uv) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function annotate(mesh, id, construction) {
  mesh.name = id;
  mesh.userData.componentId = id;
  mesh.userData.materialId = "hair";
  mesh.userData.geometryLayer = id === "scalp" ? "L3" : "L1";
  mesh.userData.construction = construction;
  mesh.userData.role = "hair";
  mesh.userData.staticPreview = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function createMikuHair(THREE, headMesh, materials, options = {}) {
  if (!materials?.hair) throw new Error("createMikuHair requires materials.hair");
  const parameters = MIKU_HAIR_PARAMETERS;
  const rings = (options.headRings || parameters.headRings).map((ring) => [...ring]);
  const scalpParameters = parameters.scalp;
  const [cx, cy, cz] = scalpParameters.center;
  const [ellipsoidX, ellipsoidY, ellipsoidZ] = scalpParameters.radii;
  const topY = cy + ellipsoidY;
  const headTopY = rings[rings.length - 1][0];
  const headBottomY = rings[0][0];
  const azimuths = scalpParameters.radialSegments;
  const rows = scalpParameters.verticalSegments;
  const positions = [];
  const indices = [];
  const uv = [];
  function bottomY(theta) {
    const front = Math.max(0, Math.cos(theta));
    return scalpParameters.napeY + (scalpParameters.frontHairlineY - scalpParameters.napeY) * front * front;
  }
  function scalpPoint(theta, v) {
    const lower = bottomY(theta);
    const y = lower + (topY - lower) * v;
    const vertical = (y - cy) / ellipsoidY;
    const section = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    let rx = ellipsoidX * section;
    let rz = ellipsoidZ * section;
    if (y >= headBottomY && y <= headTopY) {
      const head = interpolateHead(rings, y);
      rx = Math.max(rx, head[1] + scalpParameters.clearance);
      rz = Math.max(rz, head[2] + Math.abs(cz - (head[3] || 0)) + scalpParameters.clearance);
    }
    return [cx + Math.sin(theta) * rx, y, cz + Math.cos(theta) * rz];
  }
  for (let surface = 0; surface < 2; surface++) {
    for (let row = 0; row < rows; row++) {
      const v = row / rows;
      for (let azimuth = 0; azimuth < azimuths; azimuth++) {
        const theta = azimuth / azimuths * Math.PI * 2;
        const point = scalpPoint(theta, v);
        if (surface === 1) {
          point[0] -= Math.sin(theta) * scalpParameters.thickness;
          point[1] -= scalpParameters.thickness * Math.max(0, v - 0.3);
          point[2] -= Math.cos(theta) * scalpParameters.thickness;
        }
        positions.push(...point);
        uv.push(azimuth / azimuths, v);
      }
    }
  }
  const surfaceSize = rows * azimuths;
  const outerApex = positions.length / 3;
  positions.push(cx, topY, cz);
  uv.push(0.5, 1);
  const innerApex = positions.length / 3;
  positions.push(cx, topY - scalpParameters.thickness, cz);
  uv.push(0.5, 1);
  for (let surface = 0; surface < 2; surface++) {
    const offset = surface * surfaceSize;
    const triangle = (a, b, c) => {
      indices.push(...surface === 0 ? [a, b, c] : [a, c, b]);
    };
    for (let row = 0; row < rows - 1; row++) {
      for (let a = 0; a < azimuths; a++) {
        const b = (a + 1) % azimuths;
        triangle(
          offset + row * azimuths + a,
          offset + row * azimuths + b,
          offset + (row + 1) * azimuths + a
        );
        triangle(
          offset + row * azimuths + b,
          offset + (row + 1) * azimuths + b,
          offset + (row + 1) * azimuths + a
        );
      }
    }
    for (let a = 0; a < azimuths; a++) {
      triangle(
        offset + (rows - 1) * azimuths + a,
        offset + (rows - 1) * azimuths + (a + 1) % azimuths,
        surface === 0 ? outerApex : innerApex
      );
    }
  }
  for (let a = 0; a < azimuths; a++) {
    const b = (a + 1) % azimuths;
    indices.push(a, surfaceSize + a, surfaceSize + b, a, surfaceSize + b, b);
  }
  const scalp = annotate(
    new THREE.Mesh(meshFromArrays(THREE, positions, indices, uv), materials.hair),
    "scalp",
    "Continuous thick crown/occiput shell; front face opening; skull-derived radial clearance"
  );
  headMesh.add(scalp);
  const referenceProfiles = { "r": [[50, 385, 22], [80, 365, 22], [120, 357, 34], [180, 311, 24], [250, 269, 18], [350, 216, 19], [450, 169, 35], [550, 149, 38], [650, 142, 46], [750, 163, 28], [820, 204, 17], [880, 218, 6], [940, 273, 6], [1e3, 257, 0.5]], "l": [[50, 550, 22], [80, 575, 15], [120, 577, 24], [180, 612, 25], [250, 642, 18], [350, 693, 41], [450, 787, 42], [550, 848, 36], [650, 870, 37], [750, 856, 21], [820, 829, 9], [860, 815, 0.5]], "r-outer": [[100, 353, 3], [250, 251, 4], [450, 140, 5], [550, 90, 6], [650, 65, 7], [750, 76, 6], [820, 130, 5], [850, 180, 4], [880, 253, 5], [940, 273, 0.5]], "l-outer": [[100, 590, 3], [250, 660, 4], [350, 735, 5], [450, 842, 5], [550, 914, 3], [650, 923, 3], [750, 896, 4], [820, 856, 9], [880, 856, 7], [940, 874, 7], [990, 929, 0.5]], "l-inner": [[250, 600, 3], [350, 655, 5], [450, 690, 5], [550, 769, 13], [650, 805, 12], [750, 813, 7], [820, 800, 7], [850, 750, 5], [870, 730, 0.5]], "r-inner": [[500, 180, 5], [650, 190, 6], [750, 212, 10], [800, 263, 16], [820, 306, 20], [830, 337, 0.5]] };
  const scale = 3.4 / 1190;
  const tails = [];
  for (const [key, rows2] of Object.entries(referenceProfiles)) {
    const points = rows2.map(([y, x]) => new THREE.Vector3((x - 460) * scale, (1190 - y) * scale - 3.07, -0.06));
    points.forEach((p, i) => {
      p.z += Math.sin(i / (points.length - 1) * Math.PI) * 0.055;
    });
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    const rings2 = 100, radial = 16;
    const vertices = [], faces = [], coordinates = [];
    const tSamples = rows2.map((_, i) => i / (rows2.length - 1));
    for (let i = 0; i <= rings2; i++) {
      const t = i / rings2, p = curve.getPoint(t), T = curve.getTangent(t).normalize();
      const B = new THREE.Vector3(1, 0, 0).addScaledVector(T, -T.x).normalize();
      const N = new THREE.Vector3().crossVectors(T, B).normalize();
      const k = Math.min(rows2.length - 2, Math.floor(t * (rows2.length - 1))), f = t * (rows2.length - 1) - k;
      const w = Math.max(8e-4, (rows2[k][2] * (1 - f) + rows2[k + 1][2] * f) * scale);
      const depth = key.includes("outer") ? Math.max(4e-3, w * 0.45) : Math.max(8e-3, w * 0.65);
      for (let j = 0; j < radial; j++) {
        const a = j / radial * Math.PI * 2;
        const v = p.clone().add(new THREE.Vector3(Math.cos(a) * w, 0, Math.sin(a) * depth));
        vertices.push(v.x, v.y, v.z);
        coordinates.push(j / radial, t);
        if (i < rings2) {
          const b = (i + 1) * radial + j, n = i * radial + (j + 1) % radial, bn = (i + 1) * radial + (j + 1) % radial;
          faces.push(i * radial + j, b, n, n, b, bn);
        }
      }
    }
    for (let i = 0; i < faces.length; i += 3) {
      [faces[i + 1], faces[i + 2]] = [faces[i + 2], faces[i + 1]];
    }
    const cap0 = vertices.length / 3;
    vertices.push(...points[0].toArray());
    coordinates.push(0.5, 0);
    const cap1 = vertices.length / 3;
    vertices.push(...points[points.length - 1].toArray());
    coordinates.push(0.5, 1);
    for (let j = 0; j < radial; j++) {
      faces.push(cap0, (j + 1) % radial, j);
      faces.push(cap1, rings2 * radial + j, rings2 * radial + (j + 1) % radial);
    }
    const id = "twintail-" + key;
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i] -= points[0].x;
      vertices[i + 1] -= points[0].y;
      vertices[i + 2] -= points[0].z;
    }
    const tail = annotate(new THREE.Mesh(meshFromArrays(THREE, vertices, faces, coordinates), materials.hair), id, "Reference-fitted closed volumetric ribbon sweep; visible outline observed, thickness inferred");
    tail.userData.componentId = "twintail-" + key[0];
    tail.userData.explodeWithParent = key.includes("outer");
    tail.position.copy(points[0]);
    scalp.add(tail);
    tails.push(tail);
  }
  const scalpAnchor = [0.245, 0.15, -0.04];
  const hairPoints = [];
  for (const mesh of [scalp, ...tails]) {
    const attribute = mesh.geometry.getAttribute("position");
    for (let i = 0; i < attribute.count; i++) {
      hairPoints.push([
        attribute.getX(i) + mesh.position.x,
        attribute.getY(i) + mesh.position.y,
        attribute.getZ(i) + mesh.position.z
      ]);
    }
  }
  return {
    scalp,
    tails,
    parameters,
    headLocalScalpRings: rings,
    headLocalHairPoints: hairPoints,
    headLocalScalpAnchor: scalpAnchor,
    headLocalTailRoots: tails.map((tail) => tail.position.toArray()),
    scalpShellThickness: scalpParameters.thickness,
    scalpClearance: scalpParameters.clearance,
    inferredRegions: ["side/rear skull depth", "nape", "tail depth and section profiles"]
  };
}
export {
  MIKU_HAIR_PARAMETERS,
  createMikuHair
};
