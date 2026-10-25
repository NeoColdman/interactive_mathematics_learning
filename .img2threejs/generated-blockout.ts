import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildTubeGeometry(
  path: { points: [number, number, number][]; radius?: number; radialSegments?: number; closed?: boolean },
): THREE.TubeGeometry {
  const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, path.closed ?? false);
  const tubularSegments = Math.max(8, path.points.length * 6);
  return new THREE.TubeGeometry(curve, tubularSegments, path.radius ?? 0.05, path.radialSegments ?? 8, path.closed ?? false);
}

type TaperedStation = { position: [number, number, number]; rx: number; rz: number; twist?: number };

// Frames come from PARALLEL TRANSPORT, not from a Frenet frame. A Frenet frame is defined by
// the curve's normal, which flips sign wherever the path has an inflection or straightens out,
// and every flip twists the surface 180 degrees within one segment. Carrying the previous frame
// forward and removing only its along-path component keeps the twist continuous. THREE's own
// extrudePath and TubeGeometry do not expose this, which is why this is hand-built.
function buildTaperedSweepGeometry(
  sweep: { stations: TaperedStation[]; radialSegments?: number; capEnds?: boolean },
): THREE.BufferGeometry {
  const stations = sweep.stations;
  if (stations.length < 2) throw new Error('tapered-sweep needs at least two stations');
  const radial = Math.max(3, sweep.radialSegments ?? 10);
  const centres = stations.map((s) => new THREE.Vector3(...s.position));

  const tangents = centres.map((_, i) => {
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(centres.length - 1, i + 1)];
    const t = next.clone().sub(prev);
    // Coincident neighbours would normalise to NaN and poison every downstream vertex.
    return t.lengthSq() < 1e-12 ? new THREE.Vector3(0, 1, 0) : t.normalize();
  });

  // Seed a reference axis that is not parallel to the first tangent, or the first cross
  // product is degenerate and the whole sweep collapses to a line.
  let ref = new THREE.Vector3(0, 0, 1);
  if (Math.abs(tangents[0].dot(ref)) > 0.9) ref = new THREE.Vector3(1, 0, 0);

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  let carried = ref.clone().sub(tangents[0].clone().multiplyScalar(ref.dot(tangents[0]))).normalize();
  for (let i = 0; i < tangents.length; i += 1) {
    const t = tangents[i];
    // Project the carried frame back onto the plane perpendicular to this tangent.
    const n = carried.clone().sub(t.clone().multiplyScalar(carried.dot(t)));
    if (n.lengthSq() < 1e-12) {
      const fallback = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      n.copy(fallback.sub(t.clone().multiplyScalar(fallback.dot(t))));
    }
    n.normalize();
    normals.push(n);
    binormals.push(new THREE.Vector3().crossVectors(t, n).normalize());
    carried = n;
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];
  const isPoint: boolean[] = [];

  for (let i = 0; i < stations.length; i += 1) {
    const st = stations[i];
    const v = i / (stations.length - 1);
    ringStart.push(positions.length / 3);
    // A station whose section has collapsed emits ONE vertex, not a ring of radius zero.
    // A degenerate ring still carries `radial` coincident vertices and `radial` zero-area
    // triangles, so the lock ends in a blunt cap the width of the floating-point noise
    // rather than at a point -- and a hair lock, a horn or a blade tip has to reach a point.
    if (st.rx <= 1e-6 && st.rz <= 1e-6) {
      isPoint.push(true);
      positions.push(centres[i].x, centres[i].y, centres[i].z);
      uvs.push(0.5, v);
      continue;
    }
    isPoint.push(false);
    const twist = ((st.twist ?? 0) * Math.PI) / 180;
    for (let j = 0; j <= radial; j += 1) {
      const theta = (j / radial) * Math.PI * 2 + twist;
      const offset = normals[i].clone().multiplyScalar(Math.cos(theta) * st.rx)
        .add(binormals[i].clone().multiplyScalar(Math.sin(theta) * st.rz));
      const p = centres[i].clone().add(offset);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radial, v);
    }
  }

  for (let i = 0; i < stations.length - 1; i += 1) {
    const a0 = ringStart[i];
    const b0 = ringStart[i + 1];
    if (isPoint[i] && isPoint[i + 1]) continue;   // two collapsed stations bound nothing
    for (let j = 0; j < radial; j += 1) {
      // Wound so the face normal points radially OUTWARD.
      //
      // Ring vertices advance from `normal` toward `binormal`, and binormal is
      // tangent x normal, so increasing theta runs counter-clockwise seen from the
      // far end of the segment. Taking the ring-to-ring edge first therefore puts
      // the cross product on the inside. Measured as signed volume on the built
      // mesh: every tapered-sweep came out negative -- a torso at -0.0674 and a
      // tail at -0.0044 against a positive ellipsoid head -- so every sweep this
      // generator has ever emitted rendered its back faces, with normals pointing
      // into the solid and every lighting judgement made on the wrong surface.
      if (isPoint[i]) indices.push(a0, b0 + j + 1, b0 + j);
      else if (isPoint[i + 1]) indices.push(a0 + j, a0 + j + 1, b0);
      else indices.push(a0 + j, a0 + j + 1, b0 + j, a0 + j + 1, b0 + j + 1, b0 + j);
    }
  }

  if (sweep.capEnds ?? true) {
    for (const end of [0, stations.length - 1]) {
      if (isPoint[end]) continue;   // a point end is already closed
      const centreIndex = positions.length / 3;
      positions.push(centres[end].x, centres[end].y, centres[end].z);
      uvs.push(0.5, end === 0 ? 0 : 1);
      const base = ringStart[end];
      for (let j = 0; j < radial; j += 1) {
        if (end === 0) indices.push(centreIndex, base + j + 1, base + j);
        else indices.push(centreIndex, base + j, base + j + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Plan 1.3 F.6 — sweep a thin 2D cross-section along a 3D spine so a curved
// form (hooked blade, handle) reads correctly from EVERY camera angle, not just
// the reference angle a flat extrude happens to match. Uses ExtrudeGeometry's
// native extrudePath; bevelEnabled: false keeps sharp tips (same rule as F.5).
function buildCurveSweepGeometry(
  sweep: { spine: [number, number, number][]; crossSection: { points: [number, number][] }; closed?: boolean },
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const cs = sweep.crossSection.points;
  if (cs.length > 0) {
    shape.moveTo(cs[0][0], cs[0][1]);
    for (let i = 1; i < cs.length; i += 1) shape.lineTo(cs[i][0], cs[i][1]);
    shape.closePath();
  }
  const spine = sweep.spine.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(spine, sweep.closed ?? false);
  return new THREE.ExtrudeGeometry(shape, {
    extrudePath: path,
    steps: Math.max(24, spine.length * 8),
    bevelEnabled: false,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Hatsune Miku learning companion
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createHatsuneMikuLearningCompanionModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Hatsune Miku learning companion";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 32, "aspect": 0.8573811509591326, "orientation": {"yaw": 0, "pitch": 0, "roll": 0}, "positionHint": [0, 1.7, 7.2], "note": "Near frontal illustration; camera fit remains to be confirmed from actual browser captures. +Z front, Y-up. Fixed review is frontal; orbit views are volume evidence, not matched references."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    {"id": "hidden", "name": "hidden", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material.", "qualityTier": "utility"},
    options
  );
  materialMap["skin"] = createSculptMaterial(
    "skin",
    {"id": "skin", "name": "skin", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#ffe6db", "color": "#ffe6db", "albedo": {"dominant": "#ffe6db", "secondary": ["#ffe6db"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["hair"] = createSculptMaterial(
    "hair",
    {"id": "hair", "name": "hair", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#6bcbd2", "color": "#6bcbd2", "albedo": {"dominant": "#6bcbd2", "secondary": ["#6bcbd2"]}, "roughness": {"base": 0.72, "variation": 0.08}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [{"id": "hair-root-shadow", "region": "scalp-root-overlap", "baseColor": "#30979f", "roughness": 0.8}, {"id": "hair-ridge-light", "region": "longitudinal outer ridge", "baseColor": "#a0e5e6", "roughness": 0.6}], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["hair-shadow"] = createSculptMaterial(
    "hair-shadow",
    {"id": "hair-shadow", "name": "hair-shadow", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#30979f", "color": "#30979f", "albedo": {"dominant": "#30979f", "secondary": ["#30979f"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["hair-light"] = createSculptMaterial(
    "hair-light",
    {"id": "hair-light", "name": "hair-light", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#a0e5e6", "color": "#a0e5e6", "albedo": {"dominant": "#a0e5e6", "secondary": ["#a0e5e6"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["white-cloth"] = createSculptMaterial(
    "white-cloth",
    {"id": "white-cloth", "name": "white-cloth", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#f4f7fa", "color": "#f4f7fa", "albedo": {"dominant": "#f4f7fa", "secondary": ["#f4f7fa"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["dark-cloth"] = createSculptMaterial(
    "dark-cloth",
    {"id": "dark-cloth", "name": "dark-cloth", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#30313e", "color": "#30313e", "albedo": {"dominant": "#30313e", "secondary": ["#30313e"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [{"id": "pleat-shadow", "region": "pleat-trough", "baseColor": "#262733", "roughness": 0.85}], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["cyan-trim"] = createSculptMaterial(
    "cyan-trim",
    {"id": "cyan-trim", "name": "cyan-trim", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#21b7c2", "color": "#21b7c2", "albedo": {"dominant": "#21b7c2", "secondary": ["#21b7c2"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["pink-trim"] = createSculptMaterial(
    "pink-trim",
    {"id": "pink-trim", "name": "pink-trim", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#d42e6c", "color": "#d42e6c", "albedo": {"dominant": "#d42e6c", "secondary": ["#d42e6c"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["eye-white"] = createSculptMaterial(
    "eye-white",
    {"id": "eye-white", "name": "eye-white", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#fafbfb", "color": "#fafbfb", "albedo": {"dominant": "#fafbfb", "secondary": ["#fafbfb"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["iris"] = createSculptMaterial(
    "iris",
    {"id": "iris", "name": "iris", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#2d9ea9", "color": "#2d9ea9", "albedo": {"dominant": "#2d9ea9", "secondary": ["#2d9ea9"]}, "roughness": {"base": 0.25, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["ink"] = createSculptMaterial(
    "ink",
    {"id": "ink", "name": "ink", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#263846", "color": "#263846", "albedo": {"dominant": "#263846", "secondary": ["#263846"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["mouth"] = createSculptMaterial(
    "mouth",
    {"id": "mouth", "name": "mouth", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#ad4960", "color": "#ad4960", "albedo": {"dominant": "#ad4960", "secondary": ["#ad4960"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );
  materialMap["sole"] = createSculptMaterial(
    "sole",
    {"id": "sole", "name": "sole", "type": "standard", "shaderModel": "MeshToonMaterial for base regions, local geometric graphic accents", "baseColor": "#252b37", "color": "#252b37", "albedo": {"dominant": "#252b37", "secondary": ["#252b37"]}, "roughness": {"base": 0.72, "variation": 0}, "metalness": {"base": 0, "variation": 0}, "localOverrides": [], "textureless": {"declared": true, "evidence": ["/Users/zhenyu/dev/Interactive_Mathematics_Learning/images/Hatsune_Miku_V2.png — front illustration shows flat stylized base-color regions; no physical grain or pores are observable.", "Color breaks, seams and ink details are separately represented as geometry/local features; no fabricated texture maps."]}, "notes": "2D stylized albedo evidence; roughness is a chosen toon-look parameter, not recovered physical material."},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "root__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "root", "importance": 0.95, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Invisible semantic hierarchy root, no rendered cube.", "geometryDescriptor": {"topologyIntent": "Invisible semantic hierarchy root, no rendered cube.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": null, "attachment": null, "dimensions": {"width": 0.01, "height": 0.01, "depth": 0.01, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L-1", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 1)", "secondaryAlbedo": "rgba(0, 0, 0, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_root_0.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "root", "importance": 0.95, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Invisible semantic hierarchy root, no rendered cube.", "geometryDescriptor": {"topologyIntent": "Invisible semantic hierarchy root, no rendered cube.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": null, "attachment": null, "dimensions": {"width": 0.01, "height": 0.01, "depth": 0.01, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L-1", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 1)", "secondaryAlbedo": "rgba(0, 0, 0, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_torso_1 = {"parentSocket": "root-torso", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "baseRadius": 0.255, "endRadius": 0.17, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_torso_1 = makeAttachmentEndpoint(attachment_torso_1);
  const node_torso_1 = new THREE.Group();
  node_torso_1.name = "torso__pivot";
  node_torso_1.scale.set(1, 1, 1);
  if (endpoint_torso_1) {
    node_torso_1.position.copy(endpoint_torso_1.start);
    node_torso_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_torso_1.position.set(0.0, 2.48, 0.0);
    node_torso_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_torso_1.userData.sculptComponent = {"id": "torso", "name": "torso", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Waist-cinched smooth torso volume covered by fitted blouse; no independent chest spheres.", "geometryDescriptor": {"topologyIntent": "Waist-cinched smooth torso volume covered by fitted blouse; no independent chest spheres.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[2.12, 0.22, 0.14], [2.3, 0.17, 0.12], [2.52, 0.22, 0.145], [2.72, 0.255, 0.145], [2.78, 0.19, 0.12]]}}, "parent": "root", "attachment": {"parentSocket": "root-torso", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "baseRadius": 0.255, "endRadius": 0.17, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.51, "height": 0.75, "depth": 0.3, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 2.48, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_torso_1.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_torso_1);
  nodes["torso"] = node_torso_1;
  const mesh_torso_1Geometry = endpoint_torso_1
    ? new THREE.CylinderGeometry(endpoint_torso_1.endRadius, endpoint_torso_1.baseRadius, endpoint_torso_1.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_torso_1) {
    mesh_torso_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_torso_1 = new THREE.Mesh(
    mesh_torso_1Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_torso_1.name = "torso";
  if (endpoint_torso_1) {
    mesh_torso_1.position.copy(endpoint_torso_1.midpoint);
    mesh_torso_1.quaternion.copy(endpoint_torso_1.quaternion);
  }
  mesh_torso_1.castShadow = options.castShadow ?? true;
  mesh_torso_1.receiveShadow = options.receiveShadow ?? true;
  mesh_torso_1.userData.sculptComponent = {"id": "torso", "name": "torso", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Waist-cinched smooth torso volume covered by fitted blouse; no independent chest spheres.", "geometryDescriptor": {"topologyIntent": "Waist-cinched smooth torso volume covered by fitted blouse; no independent chest spheres.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[2.12, 0.22, 0.14], [2.3, 0.17, 0.12], [2.52, 0.22, 0.145], [2.72, 0.255, 0.145], [2.78, 0.19, 0.12]]}}, "parent": "root", "attachment": {"parentSocket": "root-torso", "localStart": [0, 0, 0], "localEnd": [0, 0.75, 0], "contactType": "overlap", "baseRadius": 0.255, "endRadius": 0.17, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.51, "height": 0.75, "depth": 0.3, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 2.48, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_torso_1.add(mesh_torso_1);
  meshes["torso"] = mesh_torso_1;
  colliders["torso"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["torso"] ??= [];
  destructionGroups["torso"].push(node_torso_1);

  const attachment_neck_2 = {"parentSocket": "torso-neck", "localStart": [0, 0, 0], "localEnd": [0, 0.16, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_neck_2 = makeAttachmentEndpoint(attachment_neck_2);
  const node_neck_2 = new THREE.Group();
  node_neck_2.name = "neck__pivot";
  node_neck_2.scale.set(1, 1, 1);
  if (endpoint_neck_2) {
    node_neck_2.position.copy(endpoint_neck_2.start);
    node_neck_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_neck_2.position.set(0.0, 0.34, 0.0);
    node_neck_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_neck_2.userData.sculptComponent = {"id": "neck", "name": "neck", "level": "meso", "role": "body", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"closedLoft": true}}, "parent": "torso", "attachment": {"parentSocket": "torso-neck", "localStart": [0, 0, 0], "localEnd": [0, 0.16, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.16, "depth": 0.12, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.34, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_neck_2.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["torso"] ?? root).add(node_neck_2);
  nodes["neck"] = node_neck_2;
  const mesh_neck_2Geometry = endpoint_neck_2
    ? new THREE.CylinderGeometry(endpoint_neck_2.endRadius, endpoint_neck_2.baseRadius, endpoint_neck_2.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_neck_2) {
    mesh_neck_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_neck_2 = new THREE.Mesh(
    mesh_neck_2Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_neck_2.name = "neck";
  if (endpoint_neck_2) {
    mesh_neck_2.position.copy(endpoint_neck_2.midpoint);
    mesh_neck_2.quaternion.copy(endpoint_neck_2.quaternion);
  }
  mesh_neck_2.castShadow = options.castShadow ?? true;
  mesh_neck_2.receiveShadow = options.receiveShadow ?? true;
  mesh_neck_2.userData.sculptComponent = {"id": "neck", "name": "neck", "level": "meso", "role": "body", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"closedLoft": true}}, "parent": "torso", "attachment": {"parentSocket": "torso-neck", "localStart": [0, 0, 0], "localEnd": [0, 0.16, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.16, "depth": 0.12, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.34, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_neck_2.add(mesh_neck_2);
  meshes["neck"] = mesh_neck_2;
  colliders["neck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["neck"] ??= [];
  destructionGroups["neck"].push(node_neck_2);

  const attachment_head_3 = {"parentSocket": "neck-head", "localStart": [0, 0, 0], "localEnd": [0, 0.54, 0], "contactType": "overlap", "baseRadius": 0.23, "endRadius": 0.15333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_head_3 = makeAttachmentEndpoint(attachment_head_3);
  const node_head_3 = new THREE.Group();
  node_head_3.name = "head__pivot";
  node_head_3.scale.set(1, 1, 1);
  if (endpoint_head_3) {
    node_head_3.position.copy(endpoint_head_3.start);
    node_head_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_head_3.position.set(0.0, 0.28, 0.005);
    node_head_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_head_3.userData.sculptComponent = {"id": "head", "name": "head", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Single continuous anime cranium and jaw; broad forehead tapering to small chin, shallow facial depth.", "geometryDescriptor": {"topologyIntent": "Single continuous anime cranium and jaw; broad forehead tapering to small chin, shallow facial depth.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"headUnits": 1, "centerWorld": [0, 3.07, 0], "rings": [[-0.27, 0.02, 0.035], [-0.21, 0.135, 0.11], [-0.1, 0.205, 0.16], [0.05, 0.23, 0.185], [0.19, 0.2, 0.17], [0.27, 0.04, 0.06]], "faceForward": "+Z", "faceLandmarks": {"hairline": 0.19, "eyeLine": 0.58, "eyeSpacing": 0.23, "noseBase": 0.72, "mouthLine": 0.82, "earTop": 0.49, "earBottom": 0.75}, "faceAlbedoPath": "/companion/face-albedo.png", "faceProjection": "De-lit reference eye/mouth local pixels on continuous facial UV region; not a billboard."}}, "parent": "neck", "attachment": {"parentSocket": "neck-head", "localStart": [0, 0, 0], "localEnd": [0, 0.54, 0], "contactType": "overlap", "baseRadius": 0.23, "endRadius": 0.15333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.46, "height": 0.54, "depth": 0.38, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.28, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "reference-face-graphics", "kind": "decal", "description": "De-lit eye/mouth source pixels projected onto continuous head front UV; graphical albedo with alpha, independently authored depth; not recovered physical PBR.", "source": "/companion/face-albedo.png", "evidenceRefs": ["front-head"], "report": "/Users/zhenyu/dev/Interactive_Mathematics_Learning/.img2threejs/face-graphics-report.json", "implementation": "separate face graphics surface/material over neutral skin; future expression channels pending"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-head"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-head"]}};
  node_head_3.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["neck"] ?? root).add(node_head_3);
  nodes["head"] = node_head_3;
  const mesh_head_3Geometry = endpoint_head_3
    ? new THREE.CylinderGeometry(endpoint_head_3.endRadius, endpoint_head_3.baseRadius, endpoint_head_3.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_head_3) {
    mesh_head_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_head_3 = new THREE.Mesh(
    mesh_head_3Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_head_3.name = "head";
  if (endpoint_head_3) {
    mesh_head_3.position.copy(endpoint_head_3.midpoint);
    mesh_head_3.quaternion.copy(endpoint_head_3.quaternion);
  }
  mesh_head_3.castShadow = options.castShadow ?? true;
  mesh_head_3.receiveShadow = options.receiveShadow ?? true;
  mesh_head_3.userData.sculptComponent = {"id": "head", "name": "head", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Single continuous anime cranium and jaw; broad forehead tapering to small chin, shallow facial depth.", "geometryDescriptor": {"topologyIntent": "Single continuous anime cranium and jaw; broad forehead tapering to small chin, shallow facial depth.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"headUnits": 1, "centerWorld": [0, 3.07, 0], "rings": [[-0.27, 0.02, 0.035], [-0.21, 0.135, 0.11], [-0.1, 0.205, 0.16], [0.05, 0.23, 0.185], [0.19, 0.2, 0.17], [0.27, 0.04, 0.06]], "faceForward": "+Z", "faceLandmarks": {"hairline": 0.19, "eyeLine": 0.58, "eyeSpacing": 0.23, "noseBase": 0.72, "mouthLine": 0.82, "earTop": 0.49, "earBottom": 0.75}, "faceAlbedoPath": "/companion/face-albedo.png", "faceProjection": "De-lit reference eye/mouth local pixels on continuous facial UV region; not a billboard."}}, "parent": "neck", "attachment": {"parentSocket": "neck-head", "localStart": [0, 0, 0], "localEnd": [0, 0.54, 0], "contactType": "overlap", "baseRadius": 0.23, "endRadius": 0.15333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.46, "height": 0.54, "depth": 0.38, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.28, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "reference-face-graphics", "kind": "decal", "description": "De-lit eye/mouth source pixels projected onto continuous head front UV; graphical albedo with alpha, independently authored depth; not recovered physical PBR.", "source": "/companion/face-albedo.png", "evidenceRefs": ["front-head"], "report": "/Users/zhenyu/dev/Interactive_Mathematics_Learning/.img2threejs/face-graphics-report.json", "implementation": "separate face graphics surface/material over neutral skin; future expression channels pending"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-head"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-head"]}};
  node_head_3.add(mesh_head_3);
  meshes["head"] = mesh_head_3;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["head"] ??= [];
  destructionGroups["head"].push(node_head_3);

  const attachment_scalp_4 = {"parentSocket": "head-scalp", "localStart": [0, 0, 0], "localEnd": [0, 0.52, 0], "contactType": "overlap", "baseRadius": 0.255, "endRadius": 0.17, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_scalp_4 = makeAttachmentEndpoint(attachment_scalp_4);
  const node_scalp_4 = new THREE.Group();
  node_scalp_4.name = "scalp__pivot";
  node_scalp_4.scale.set(1, 1, 1);
  if (endpoint_scalp_4) {
    node_scalp_4.position.copy(endpoint_scalp_4.start);
    node_scalp_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_scalp_4.position.set(0.0, 0.055, -0.015);
    node_scalp_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_scalp_4.userData.sculptComponent = {"id": "scalp", "name": "scalp", "level": "macro", "role": "hair", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed crown shell extends over occiput and temporal scalp with face opening; fills between bangs in side/rear views.", "geometryDescriptor": {"topologyIntent": "Closed crown shell extends over occiput and temporal scalp with face opening; fills between bangs in side/rear views.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"ellipsoidRadii": [0.255, 0.27, 0.21], "coverage": "crown/rear/temples; foreground opening excludes eyes", "shellOffset": 0.012, "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}}, "parent": "head", "attachment": {"parentSocket": "head-scalp", "localStart": [0, 0, 0], "localEnd": [0, 0.52, 0], "contactType": "overlap", "baseRadius": 0.255, "endRadius": 0.17, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.51, "height": 0.52, "depth": 0.42, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.055, -0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "scalp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bang-tapers", "kind": "contour", "description": "Front fringe split into tapered locks", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_scalp_4.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "scalp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_scalp_4);
  nodes["scalp"] = node_scalp_4;
  const mesh_scalp_4Geometry = endpoint_scalp_4
    ? new THREE.CylinderGeometry(endpoint_scalp_4.endRadius, endpoint_scalp_4.baseRadius, endpoint_scalp_4.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_scalp_4) {
    mesh_scalp_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_scalp_4 = new THREE.Mesh(
    mesh_scalp_4Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_scalp_4.name = "scalp";
  if (endpoint_scalp_4) {
    mesh_scalp_4.position.copy(endpoint_scalp_4.midpoint);
    mesh_scalp_4.quaternion.copy(endpoint_scalp_4.quaternion);
  }
  mesh_scalp_4.castShadow = options.castShadow ?? true;
  mesh_scalp_4.receiveShadow = options.receiveShadow ?? true;
  mesh_scalp_4.userData.sculptComponent = {"id": "scalp", "name": "scalp", "level": "macro", "role": "hair", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed crown shell extends over occiput and temporal scalp with face opening; fills between bangs in side/rear views.", "geometryDescriptor": {"topologyIntent": "Closed crown shell extends over occiput and temporal scalp with face opening; fills between bangs in side/rear views.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"ellipsoidRadii": [0.255, 0.27, 0.21], "coverage": "crown/rear/temples; foreground opening excludes eyes", "shellOffset": 0.012, "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}}, "parent": "head", "attachment": {"parentSocket": "head-scalp", "localStart": [0, 0, 0], "localEnd": [0, 0.52, 0], "contactType": "overlap", "baseRadius": 0.255, "endRadius": 0.17, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.51, "height": 0.52, "depth": 0.42, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.055, -0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "scalp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bang-tapers", "kind": "contour", "description": "Front fringe split into tapered locks", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_scalp_4.add(mesh_scalp_4);
  meshes["scalp"] = mesh_scalp_4;
  colliders["scalp"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["scalp"] ??= [];
  destructionGroups["scalp"].push(node_scalp_4);

  const endpoint_bang_0_5 = makeAttachmentEndpoint(null);
  const node_bang_0_5 = new THREE.Group();
  node_bang_0_5.name = "bang-0__pivot";
  node_bang_0_5.scale.set(1, 1, 1);
  if (endpoint_bang_0_5) {
    node_bang_0_5.position.copy(endpoint_bang_0_5.start);
    node_bang_0_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_0_5.position.set(-0.21, 0.14, 0.135);
    node_bang_0_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_0_5.userData.sculptComponent = {"id": "bang-0", "name": "bang-0", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [-0.042, -0.02, 0.03], [-0.015000000000000013, -0.16, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.042, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.015000000000000013, -0.16, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-0", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.21, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_0_5.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_0_5);
  nodes["bang-0"] = node_bang_0_5;
  const mesh_bang_0_5Geometry = endpoint_bang_0_5
    ? new THREE.CylinderGeometry(endpoint_bang_0_5.endRadius, endpoint_bang_0_5.baseRadius, endpoint_bang_0_5.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.042, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.015000000000000013, -0.16, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_0_5) {
    mesh_bang_0_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_0_5 = new THREE.Mesh(
    mesh_bang_0_5Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_0_5.name = "bang-0";
  if (endpoint_bang_0_5) {
    mesh_bang_0_5.position.copy(endpoint_bang_0_5.midpoint);
    mesh_bang_0_5.quaternion.copy(endpoint_bang_0_5.quaternion);
  }
  mesh_bang_0_5.castShadow = options.castShadow ?? true;
  mesh_bang_0_5.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_0_5.userData.sculptComponent = {"id": "bang-0", "name": "bang-0", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [-0.042, -0.02, 0.03], [-0.015000000000000013, -0.16, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.042, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.015000000000000013, -0.16, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-0", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.21, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_0_5.add(mesh_bang_0_5);
  meshes["bang-0"] = mesh_bang_0_5;
  colliders["bang-0"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-0"] ??= [];
  destructionGroups["bang-0"].push(node_bang_0_5);

  const endpoint_bang_1_6 = makeAttachmentEndpoint(null);
  const node_bang_1_6 = new THREE.Group();
  node_bang_1_6.name = "bang-1__pivot";
  node_bang_1_6.scale.set(1, 1, 1);
  if (endpoint_bang_1_6) {
    node_bang_1_6.position.copy(endpoint_bang_1_6.start);
    node_bang_1_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_1_6.position.set(-0.15, 0.14, 0.135);
    node_bang_1_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_1_6.userData.sculptComponent = {"id": "bang-1", "name": "bang-1", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [-0.03, -0.02, 0.03], [-0.020000000000000018, -0.1, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.03, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.020000000000000018, -0.1, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-1", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.15, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_1_6.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_1_6);
  nodes["bang-1"] = node_bang_1_6;
  const mesh_bang_1_6Geometry = endpoint_bang_1_6
    ? new THREE.CylinderGeometry(endpoint_bang_1_6.endRadius, endpoint_bang_1_6.baseRadius, endpoint_bang_1_6.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.03, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.020000000000000018, -0.1, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_1_6) {
    mesh_bang_1_6Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_1_6 = new THREE.Mesh(
    mesh_bang_1_6Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_1_6.name = "bang-1";
  if (endpoint_bang_1_6) {
    mesh_bang_1_6.position.copy(endpoint_bang_1_6.midpoint);
    mesh_bang_1_6.quaternion.copy(endpoint_bang_1_6.quaternion);
  }
  mesh_bang_1_6.castShadow = options.castShadow ?? true;
  mesh_bang_1_6.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_1_6.userData.sculptComponent = {"id": "bang-1", "name": "bang-1", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [-0.03, -0.02, 0.03], [-0.020000000000000018, -0.1, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.03, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.020000000000000018, -0.1, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-1", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.15, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_1_6.add(mesh_bang_1_6);
  meshes["bang-1"] = mesh_bang_1_6;
  colliders["bang-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-1"] ??= [];
  destructionGroups["bang-1"].push(node_bang_1_6);

  const endpoint_bang_2_7 = makeAttachmentEndpoint(null);
  const node_bang_2_7 = new THREE.Group();
  node_bang_2_7.name = "bang-2__pivot";
  node_bang_2_7.scale.set(1, 1, 1);
  if (endpoint_bang_2_7) {
    node_bang_2_7.position.copy(endpoint_bang_2_7.start);
    node_bang_2_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_2_7.position.set(-0.08, 0.14, 0.135);
    node_bang_2_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_2_7.userData.sculptComponent = {"id": "bang-2", "name": "bang-2", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [-0.016, -0.02, 0.03], [-0.020000000000000004, -0.04, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.016, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.020000000000000004, -0.04, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-2", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.08, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_2_7.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_2_7);
  nodes["bang-2"] = node_bang_2_7;
  const mesh_bang_2_7Geometry = endpoint_bang_2_7
    ? new THREE.CylinderGeometry(endpoint_bang_2_7.endRadius, endpoint_bang_2_7.baseRadius, endpoint_bang_2_7.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.016, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.020000000000000004, -0.04, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_2_7) {
    mesh_bang_2_7Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_2_7 = new THREE.Mesh(
    mesh_bang_2_7Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_2_7.name = "bang-2";
  if (endpoint_bang_2_7) {
    mesh_bang_2_7.position.copy(endpoint_bang_2_7.midpoint);
    mesh_bang_2_7.quaternion.copy(endpoint_bang_2_7.quaternion);
  }
  mesh_bang_2_7.castShadow = options.castShadow ?? true;
  mesh_bang_2_7.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_2_7.userData.sculptComponent = {"id": "bang-2", "name": "bang-2", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [-0.016, -0.02, 0.03], [-0.020000000000000004, -0.04, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [-0.016, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [-0.020000000000000004, -0.04, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-2", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.08, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_2_7.add(mesh_bang_2_7);
  meshes["bang-2"] = mesh_bang_2_7;
  colliders["bang-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-2"] ??= [];
  destructionGroups["bang-2"].push(node_bang_2_7);

  const endpoint_bang_3_8 = makeAttachmentEndpoint(null);
  const node_bang_3_8 = new THREE.Group();
  node_bang_3_8.name = "bang-3__pivot";
  node_bang_3_8.scale.set(1, 1, 1);
  if (endpoint_bang_3_8) {
    node_bang_3_8.position.copy(endpoint_bang_3_8.start);
    node_bang_3_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_3_8.position.set(0.0, 0.14, 0.135);
    node_bang_3_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_3_8.userData.sculptComponent = {"id": "bang-3", "name": "bang-3", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.0, -0.02, 0.03], [0.025, -0.11, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.0, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.025, -0.11, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-3", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_3_8.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_3_8);
  nodes["bang-3"] = node_bang_3_8;
  const mesh_bang_3_8Geometry = endpoint_bang_3_8
    ? new THREE.CylinderGeometry(endpoint_bang_3_8.endRadius, endpoint_bang_3_8.baseRadius, endpoint_bang_3_8.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.0, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.025, -0.11, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_3_8) {
    mesh_bang_3_8Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_3_8 = new THREE.Mesh(
    mesh_bang_3_8Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_3_8.name = "bang-3";
  if (endpoint_bang_3_8) {
    mesh_bang_3_8.position.copy(endpoint_bang_3_8.midpoint);
    mesh_bang_3_8.quaternion.copy(endpoint_bang_3_8.quaternion);
  }
  mesh_bang_3_8.castShadow = options.castShadow ?? true;
  mesh_bang_3_8.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_3_8.userData.sculptComponent = {"id": "bang-3", "name": "bang-3", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.0, -0.02, 0.03], [0.025, -0.11, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.0, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.025, -0.11, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-3", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_3_8.add(mesh_bang_3_8);
  meshes["bang-3"] = mesh_bang_3_8;
  colliders["bang-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-3"] ??= [];
  destructionGroups["bang-3"].push(node_bang_3_8);

  const endpoint_bang_4_9 = makeAttachmentEndpoint(null);
  const node_bang_4_9 = new THREE.Group();
  node_bang_4_9.name = "bang-4__pivot";
  node_bang_4_9.scale.set(1, 1, 1);
  if (endpoint_bang_4_9) {
    node_bang_4_9.position.copy(endpoint_bang_4_9.start);
    node_bang_4_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_4_9.position.set(0.07, 0.14, 0.135);
    node_bang_4_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_4_9.userData.sculptComponent = {"id": "bang-4", "name": "bang-4", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.014000000000000002, -0.02, 0.03], [0.045, -0.02, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.014000000000000002, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.045, -0.02, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-4", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.07, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_4_9.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_4_9);
  nodes["bang-4"] = node_bang_4_9;
  const mesh_bang_4_9Geometry = endpoint_bang_4_9
    ? new THREE.CylinderGeometry(endpoint_bang_4_9.endRadius, endpoint_bang_4_9.baseRadius, endpoint_bang_4_9.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.014000000000000002, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.045, -0.02, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_4_9) {
    mesh_bang_4_9Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_4_9 = new THREE.Mesh(
    mesh_bang_4_9Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_4_9.name = "bang-4";
  if (endpoint_bang_4_9) {
    mesh_bang_4_9.position.copy(endpoint_bang_4_9.midpoint);
    mesh_bang_4_9.quaternion.copy(endpoint_bang_4_9.quaternion);
  }
  mesh_bang_4_9.castShadow = options.castShadow ?? true;
  mesh_bang_4_9.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_4_9.userData.sculptComponent = {"id": "bang-4", "name": "bang-4", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.014000000000000002, -0.02, 0.03], [0.045, -0.02, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.014000000000000002, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.045, -0.02, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-4", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.07, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_4_9.add(mesh_bang_4_9);
  meshes["bang-4"] = mesh_bang_4_9;
  colliders["bang-4"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-4"] ??= [];
  destructionGroups["bang-4"].push(node_bang_4_9);

  const endpoint_bang_5_10 = makeAttachmentEndpoint(null);
  const node_bang_5_10 = new THREE.Group();
  node_bang_5_10.name = "bang-5__pivot";
  node_bang_5_10.scale.set(1, 1, 1);
  if (endpoint_bang_5_10) {
    node_bang_5_10.position.copy(endpoint_bang_5_10.start);
    node_bang_5_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_5_10.position.set(0.14, 0.14, 0.135);
    node_bang_5_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_5_10.userData.sculptComponent = {"id": "bang-5", "name": "bang-5", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.028000000000000004, -0.02, 0.03], [0.044999999999999984, -0.12, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.028000000000000004, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.044999999999999984, -0.12, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-5", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.14, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_5_10.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_5_10);
  nodes["bang-5"] = node_bang_5_10;
  const mesh_bang_5_10Geometry = endpoint_bang_5_10
    ? new THREE.CylinderGeometry(endpoint_bang_5_10.endRadius, endpoint_bang_5_10.baseRadius, endpoint_bang_5_10.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.028000000000000004, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.044999999999999984, -0.12, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_5_10) {
    mesh_bang_5_10Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_5_10 = new THREE.Mesh(
    mesh_bang_5_10Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_5_10.name = "bang-5";
  if (endpoint_bang_5_10) {
    mesh_bang_5_10.position.copy(endpoint_bang_5_10.midpoint);
    mesh_bang_5_10.quaternion.copy(endpoint_bang_5_10.quaternion);
  }
  mesh_bang_5_10.castShadow = options.castShadow ?? true;
  mesh_bang_5_10.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_5_10.userData.sculptComponent = {"id": "bang-5", "name": "bang-5", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.028000000000000004, -0.02, 0.03], [0.044999999999999984, -0.12, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.028000000000000004, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.044999999999999984, -0.12, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-5", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.14, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_5_10.add(mesh_bang_5_10);
  meshes["bang-5"] = mesh_bang_5_10;
  colliders["bang-5"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-5"] ??= [];
  destructionGroups["bang-5"].push(node_bang_5_10);

  const endpoint_bang_6_11 = makeAttachmentEndpoint(null);
  const node_bang_6_11 = new THREE.Group();
  node_bang_6_11.name = "bang-6__pivot";
  node_bang_6_11.scale.set(1, 1, 1);
  if (endpoint_bang_6_11) {
    node_bang_6_11.position.copy(endpoint_bang_6_11.start);
    node_bang_6_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bang_6_11.position.set(0.21, 0.14, 0.135);
    node_bang_6_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_bang_6_11.userData.sculptComponent = {"id": "bang-6", "name": "bang-6", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.042, -0.02, 0.03], [0.024999999999999994, -0.2, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.042, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.024999999999999994, -0.2, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-6", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.21, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-6", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_6_11.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-6", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_bang_6_11);
  nodes["bang-6"] = node_bang_6_11;
  const mesh_bang_6_11Geometry = endpoint_bang_6_11
    ? new THREE.CylinderGeometry(endpoint_bang_6_11.endRadius, endpoint_bang_6_11.baseRadius, endpoint_bang_6_11.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.042, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.024999999999999994, -0.2, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]});
  if (!endpoint_bang_6_11) {
    mesh_bang_6_11Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bang_6_11 = new THREE.Mesh(
    mesh_bang_6_11Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bang_6_11.name = "bang-6";
  if (endpoint_bang_6_11) {
    mesh_bang_6_11.position.copy(endpoint_bang_6_11.midpoint);
    mesh_bang_6_11.quaternion.copy(endpoint_bang_6_11.quaternion);
  }
  mesh_bang_6_11.castShadow = options.castShadow ?? true;
  mesh_bang_6_11.receiveShadow = options.receiveShadow ?? true;
  mesh_bang_6_11.userData.sculptComponent = {"id": "bang-6", "name": "bang-6", "level": "meso", "role": "hair", "importance": 0.8, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "geometryDescriptor": {"topologyIntent": "Volumetric tapered ribbon lock follows crown into separated swept fringe, with at least 0.02 root overlap.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.09, -0.025], [0.042, -0.02, 0.03], [0.024999999999999994, -0.2, 0.08]], "widthProfile": [1, 0.85, 0.45, 0.025], "thicknessProfile": [1, 0.75, 0.4, 0.03], "rootEmbedDepth": 0.025, "eyeClearance": "Do not cover both iris centers", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0.09, -0.025], "rx": 0.075, "rz": 0.025, "twist": 0}, {"position": [0.042, -0.02, 0.03], "rx": 0.0375, "rz": 0.0125, "twist": 0}, {"position": [0.024999999999999994, -0.2, 0.08], "rx": 0.00075, "rz": 0.00025, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-bang-6", "localStart": [0, 0, 0], "localEnd": [0, 0.37, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.37, "depth": 0.065, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.21, 0.14, 0.135], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bang-6", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_bang_6_11.add(mesh_bang_6_11);
  meshes["bang-6"] = mesh_bang_6_11;
  colliders["bang-6"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["bang-6"] ??= [];
  destructionGroups["bang-6"].push(node_bang_6_11);

  const endpoint_twintail_l_12 = makeAttachmentEndpoint(null);
  const node_twintail_l_12 = new THREE.Group();
  node_twintail_l_12.name = "twintail-l__pivot";
  node_twintail_l_12.scale.set(1, 1, 1);
  if (endpoint_twintail_l_12) {
    node_twintail_l_12.position.copy(endpoint_twintail_l_12.start);
    node_twintail_l_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_twintail_l_12.position.set(0.245, 0.12, -0.045);
    node_twintail_l_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_twintail_l_12.userData.sculptComponent = {"id": "twintail-l", "name": "twintail-l", "level": "macro", "role": "hair", "importance": 0.95, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "geometryDescriptor": {"topologyIntent": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.12, -0.47, -0.06], [0.57, -1.4, 0.02], [0.72, -2.0, 0.14], [0.45, -2.58, 0.18]], "widthProfile": [0.25, 0.45, 0.85, 1, 0.12, 0.015], "thicknessProfile": [0.16, 0.17, 0.2, 0.15, 0.08, 0.003], "rootEmbedDepth": 0.03, "crossSection": "closed flattened ellipse with subtle longitudinal facets", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0, 0], "rx": 0.145, "rz": 0.075, "twist": 0}, {"position": [0.12, -0.47, -0.06], "rx": 0.10874999999999999, "rz": 0.056249999999999994, "twist": 0}, {"position": [0.57, -1.4, 0.02], "rx": 0.0725, "rz": 0.0375, "twist": 0}, {"position": [0.72, -2.0, 0.14], "rx": 0.03625, "rz": 0.01875, "twist": 0}, {"position": [0.45, -2.58, 0.18], "rx": 0.00145, "rz": 0.00075, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-twintail-l", "localStart": [0, 0, 0], "localEnd": [0, 2.65, 0], "contactType": "overlap", "baseRadius": 0.21, "endRadius": 0.13999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 2.65, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.245, 0.12, -0.045], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "twintail-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "twin-tail-arcs", "kind": "contour", "description": "Broad flattened tail curves and tapered ends", "evidenceRefs": ["front-hair"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L1", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_twintail_l_12.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "twintail-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_twintail_l_12);
  nodes["twintail-l"] = node_twintail_l_12;
  const mesh_twintail_l_12Geometry = endpoint_twintail_l_12
    ? new THREE.CylinderGeometry(endpoint_twintail_l_12.endRadius, endpoint_twintail_l_12.baseRadius, endpoint_twintail_l_12.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0, 0], "rx": 0.145, "rz": 0.075, "twist": 0}, {"position": [0.12, -0.47, -0.06], "rx": 0.10874999999999999, "rz": 0.056249999999999994, "twist": 0}, {"position": [0.57, -1.4, 0.02], "rx": 0.0725, "rz": 0.0375, "twist": 0}, {"position": [0.72, -2.0, 0.14], "rx": 0.03625, "rz": 0.01875, "twist": 0}, {"position": [0.45, -2.58, 0.18], "rx": 0.00145, "rz": 0.00075, "twist": 0}]});
  if (!endpoint_twintail_l_12) {
    mesh_twintail_l_12Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_twintail_l_12 = new THREE.Mesh(
    mesh_twintail_l_12Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_twintail_l_12.name = "twintail-l";
  if (endpoint_twintail_l_12) {
    mesh_twintail_l_12.position.copy(endpoint_twintail_l_12.midpoint);
    mesh_twintail_l_12.quaternion.copy(endpoint_twintail_l_12.quaternion);
  }
  mesh_twintail_l_12.castShadow = options.castShadow ?? true;
  mesh_twintail_l_12.receiveShadow = options.receiveShadow ?? true;
  mesh_twintail_l_12.userData.sculptComponent = {"id": "twintail-l", "name": "twintail-l", "level": "macro", "role": "hair", "importance": 0.95, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "geometryDescriptor": {"topologyIntent": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.12, -0.47, -0.06], [0.57, -1.4, 0.02], [0.72, -2.0, 0.14], [0.45, -2.58, 0.18]], "widthProfile": [0.25, 0.45, 0.85, 1, 0.12, 0.015], "thicknessProfile": [0.16, 0.17, 0.2, 0.15, 0.08, 0.003], "rootEmbedDepth": 0.03, "crossSection": "closed flattened ellipse with subtle longitudinal facets", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0, 0], "rx": 0.145, "rz": 0.075, "twist": 0}, {"position": [0.12, -0.47, -0.06], "rx": 0.10874999999999999, "rz": 0.056249999999999994, "twist": 0}, {"position": [0.57, -1.4, 0.02], "rx": 0.0725, "rz": 0.0375, "twist": 0}, {"position": [0.72, -2.0, 0.14], "rx": 0.03625, "rz": 0.01875, "twist": 0}, {"position": [0.45, -2.58, 0.18], "rx": 0.00145, "rz": 0.00075, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-twintail-l", "localStart": [0, 0, 0], "localEnd": [0, 2.65, 0], "contactType": "overlap", "baseRadius": 0.21, "endRadius": 0.13999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 2.65, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.245, 0.12, -0.045], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "twintail-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "twin-tail-arcs", "kind": "contour", "description": "Broad flattened tail curves and tapered ends", "evidenceRefs": ["front-hair"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L1", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_twintail_l_12.add(mesh_twintail_l_12);
  meshes["twintail-l"] = mesh_twintail_l_12;
  colliders["twintail-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["twintail-l"] ??= [];
  destructionGroups["twintail-l"].push(node_twintail_l_12);

  const endpoint_hairband_l_13 = makeAttachmentEndpoint(null);
  const node_hairband_l_13 = new THREE.Group();
  node_hairband_l_13.name = "hairband-l__pivot";
  node_hairband_l_13.scale.set(1, 1, 1);
  if (endpoint_hairband_l_13) {
    node_hairband_l_13.position.copy(endpoint_hairband_l_13.start);
    node_hairband_l_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hairband_l_13.position.set(0.245, 0.19, 0.005);
    node_hairband_l_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_hairband_l_13.userData.sculptComponent = {"id": "hairband-l", "name": "hairband-l", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "geometryDescriptor": {"topologyIntent": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-hairband-l", "localStart": [0, 0, 0], "localEnd": [0, 0.23, 0], "contactType": "overlap", "baseRadius": 0.0325, "endRadius": 0.021666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.065, "height": 0.23, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.245, 0.19, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hairband-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pink-hairband", "kind": "linework", "description": "Pink inset along black rectangular ornament", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hairband_l_13.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hairband-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}};
  (nodes["scalp"] ?? root).add(node_hairband_l_13);
  nodes["hairband-l"] = node_hairband_l_13;
  const mesh_hairband_l_13Geometry = endpoint_hairband_l_13
    ? new THREE.CylinderGeometry(endpoint_hairband_l_13.endRadius, endpoint_hairband_l_13.baseRadius, endpoint_hairband_l_13.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_hairband_l_13) {
    mesh_hairband_l_13Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_hairband_l_13 = new THREE.Mesh(
    mesh_hairband_l_13Geometry,
    materialMap["ink"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hairband_l_13.name = "hairband-l";
  if (endpoint_hairband_l_13) {
    mesh_hairband_l_13.position.copy(endpoint_hairband_l_13.midpoint);
    mesh_hairband_l_13.quaternion.copy(endpoint_hairband_l_13.quaternion);
  }
  mesh_hairband_l_13.castShadow = options.castShadow ?? true;
  mesh_hairband_l_13.receiveShadow = options.receiveShadow ?? true;
  mesh_hairband_l_13.userData.sculptComponent = {"id": "hairband-l", "name": "hairband-l", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "geometryDescriptor": {"topologyIntent": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-hairband-l", "localStart": [0, 0, 0], "localEnd": [0, 0.23, 0], "contactType": "overlap", "baseRadius": 0.0325, "endRadius": 0.021666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.065, "height": 0.23, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.245, 0.19, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hairband-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pink-hairband", "kind": "linework", "description": "Pink inset along black rectangular ornament", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hairband_l_13.add(mesh_hairband_l_13);
  meshes["hairband-l"] = mesh_hairband_l_13;
  colliders["hairband-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hairband-l"] ??= [];
  destructionGroups["hairband-l"].push(node_hairband_l_13);

  const endpoint_earphone_l_14 = makeAttachmentEndpoint(null);
  const node_earphone_l_14 = new THREE.Group();
  node_earphone_l_14.name = "earphone-l__pivot";
  node_earphone_l_14.scale.set(1, 1, 1);
  if (endpoint_earphone_l_14) {
    node_earphone_l_14.position.copy(endpoint_earphone_l_14.start);
    node_earphone_l_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_earphone_l_14.position.set(0.225, -0.015, 0.0);
    node_earphone_l_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_earphone_l_14.userData.sculptComponent = {"id": "earphone-l", "name": "earphone-l", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Small dark earphone cup contacting temporal head; pink exterior detail.", "geometryDescriptor": {"topologyIntent": "Small dark earphone cup contacting temporal head; pink exterior detail.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-earphone-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.035, "endRadius": 0.023333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.13, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.225, -0.015, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "earphone-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "earphone-pink", "kind": "linework", "description": "Pink outer rim on dark earphone cup", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_earphone_l_14.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "earphone-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}};
  (nodes["head"] ?? root).add(node_earphone_l_14);
  nodes["earphone-l"] = node_earphone_l_14;
  const mesh_earphone_l_14Geometry = endpoint_earphone_l_14
    ? new THREE.CylinderGeometry(endpoint_earphone_l_14.endRadius, endpoint_earphone_l_14.baseRadius, endpoint_earphone_l_14.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_earphone_l_14) {
    mesh_earphone_l_14Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_earphone_l_14 = new THREE.Mesh(
    mesh_earphone_l_14Geometry,
    materialMap["ink"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_earphone_l_14.name = "earphone-l";
  if (endpoint_earphone_l_14) {
    mesh_earphone_l_14.position.copy(endpoint_earphone_l_14.midpoint);
    mesh_earphone_l_14.quaternion.copy(endpoint_earphone_l_14.quaternion);
  }
  mesh_earphone_l_14.castShadow = options.castShadow ?? true;
  mesh_earphone_l_14.receiveShadow = options.receiveShadow ?? true;
  mesh_earphone_l_14.userData.sculptComponent = {"id": "earphone-l", "name": "earphone-l", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Small dark earphone cup contacting temporal head; pink exterior detail.", "geometryDescriptor": {"topologyIntent": "Small dark earphone cup contacting temporal head; pink exterior detail.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-earphone-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.035, "endRadius": 0.023333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.13, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.225, -0.015, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "earphone-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "earphone-pink", "kind": "linework", "description": "Pink outer rim on dark earphone cup", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_earphone_l_14.add(mesh_earphone_l_14);
  meshes["earphone-l"] = mesh_earphone_l_14;
  colliders["earphone-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["earphone-l"] ??= [];
  destructionGroups["earphone-l"].push(node_earphone_l_14);

  const endpoint_eye_l_15 = makeAttachmentEndpoint(null);
  const node_eye_l_15 = new THREE.Group();
  node_eye_l_15.name = "eye-l__pivot";
  node_eye_l_15.scale.set(1, 1, 1);
  if (endpoint_eye_l_15) {
    node_eye_l_15.position.copy(endpoint_eye_l_15.start);
    node_eye_l_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_l_15.position.set(0.097, -0.045, 0.17);
    node_eye_l_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_l_15.userData.sculptComponent = {"id": "eye-l", "name": "eye-l", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "geometryDescriptor": {"topologyIntent": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-eye-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.0515, "endRadius": 0.034333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.103, "height": 0.13, "depth": 0.015, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.097, -0.045, 0.17], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "upper-lashes", "kind": "contour", "description": "Dark curved upper eyelash at almond sclera margin", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-head"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 251, 251, 1)", "secondaryAlbedo": "rgba(250, 251, 251, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-head"]}};
  node_eye_l_15.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}};
  (nodes["head"] ?? root).add(node_eye_l_15);
  nodes["eye-l"] = node_eye_l_15;
  const mesh_eye_l_15Geometry = endpoint_eye_l_15
    ? new THREE.CylinderGeometry(endpoint_eye_l_15.endRadius, endpoint_eye_l_15.baseRadius, endpoint_eye_l_15.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_l_15) {
    mesh_eye_l_15Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_eye_l_15 = new THREE.Mesh(
    mesh_eye_l_15Geometry,
    materialMap["eye-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_l_15.name = "eye-l";
  if (endpoint_eye_l_15) {
    mesh_eye_l_15.position.copy(endpoint_eye_l_15.midpoint);
    mesh_eye_l_15.quaternion.copy(endpoint_eye_l_15.quaternion);
  }
  mesh_eye_l_15.castShadow = options.castShadow ?? true;
  mesh_eye_l_15.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_l_15.userData.sculptComponent = {"id": "eye-l", "name": "eye-l", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "geometryDescriptor": {"topologyIntent": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-eye-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.0515, "endRadius": 0.034333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.103, "height": 0.13, "depth": 0.015, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.097, -0.045, 0.17], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "upper-lashes", "kind": "contour", "description": "Dark curved upper eyelash at almond sclera margin", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-head"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 251, 251, 1)", "secondaryAlbedo": "rgba(250, 251, 251, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-head"]}};
  node_eye_l_15.add(mesh_eye_l_15);
  meshes["eye-l"] = mesh_eye_l_15;
  colliders["eye-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-l"] ??= [];
  destructionGroups["eye-l"].push(node_eye_l_15);

  const endpoint_iris_l_16 = makeAttachmentEndpoint(null);
  const node_iris_l_16 = new THREE.Group();
  node_iris_l_16.name = "iris-l__pivot";
  node_iris_l_16.scale.set(1, 1, 1);
  if (endpoint_iris_l_16) {
    node_iris_l_16.position.copy(endpoint_iris_l_16.start);
    node_iris_l_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_iris_l_16.position.set(0.0, 0.0, 0.009);
    node_iris_l_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_iris_l_16.userData.sculptComponent = {"id": "iris-l", "name": "iris-l", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Teal oval iris with darker upper region and small bright catchlights.", "geometryDescriptor": {"topologyIntent": "Teal oval iris with darker upper region and small bright catchlights.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "eye-l", "attachment": {"parentSocket": "eye-l-iris-l", "localStart": [0, 0, 0], "localEnd": [0, 0.105, 0], "contactType": "overlap", "baseRadius": 0.03, "endRadius": 0.02, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.06, "height": 0.105, "depth": 0.008, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0.009], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "iris"}}, "material": "iris", "materialLayers": ["iris"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "iris-catchlights", "kind": "gloss", "description": "Bright paired highlights in teal irises", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(45, 158, 169, 1)", "secondaryAlbedo": "rgba(45, 158, 169, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_iris_l_16.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "iris"}};
  (nodes["eye-l"] ?? root).add(node_iris_l_16);
  nodes["iris-l"] = node_iris_l_16;
  const mesh_iris_l_16Geometry = endpoint_iris_l_16
    ? new THREE.CylinderGeometry(endpoint_iris_l_16.endRadius, endpoint_iris_l_16.baseRadius, endpoint_iris_l_16.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_iris_l_16) {
    mesh_iris_l_16Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_iris_l_16 = new THREE.Mesh(
    mesh_iris_l_16Geometry,
    materialMap["iris"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_iris_l_16.name = "iris-l";
  if (endpoint_iris_l_16) {
    mesh_iris_l_16.position.copy(endpoint_iris_l_16.midpoint);
    mesh_iris_l_16.quaternion.copy(endpoint_iris_l_16.quaternion);
  }
  mesh_iris_l_16.castShadow = options.castShadow ?? true;
  mesh_iris_l_16.receiveShadow = options.receiveShadow ?? true;
  mesh_iris_l_16.userData.sculptComponent = {"id": "iris-l", "name": "iris-l", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Teal oval iris with darker upper region and small bright catchlights.", "geometryDescriptor": {"topologyIntent": "Teal oval iris with darker upper region and small bright catchlights.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "eye-l", "attachment": {"parentSocket": "eye-l-iris-l", "localStart": [0, 0, 0], "localEnd": [0, 0.105, 0], "contactType": "overlap", "baseRadius": 0.03, "endRadius": 0.02, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.06, "height": 0.105, "depth": 0.008, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0.009], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "iris"}}, "material": "iris", "materialLayers": ["iris"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "iris-catchlights", "kind": "gloss", "description": "Bright paired highlights in teal irises", "evidenceRefs": ["front-head"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(45, 158, 169, 1)", "secondaryAlbedo": "rgba(45, 158, 169, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_iris_l_16.add(mesh_iris_l_16);
  meshes["iris-l"] = mesh_iris_l_16;
  colliders["iris-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["iris-l"] ??= [];
  destructionGroups["iris-l"].push(node_iris_l_16);

  const attachment_upper_arm_l_17 = {"parentSocket": "torso-upper-arm-l", "localStart": [0, 0, 0], "localEnd": [0, 0.39, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_upper_arm_l_17 = makeAttachmentEndpoint(attachment_upper_arm_l_17);
  const node_upper_arm_l_17 = new THREE.Group();
  node_upper_arm_l_17.name = "upper-arm-l__pivot";
  node_upper_arm_l_17.scale.set(1, 1, 1);
  if (endpoint_upper_arm_l_17) {
    node_upper_arm_l_17.position.copy(endpoint_upper_arm_l_17.start);
    node_upper_arm_l_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_upper_arm_l_17.position.set(0.245, 0.27, 0.0);
    node_upper_arm_l_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_upper_arm_l_17.userData.sculptComponent = {"id": "upper-arm-l", "name": "upper-arm-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.105, -0.21, 0], [0.18, -0.38, 0.01]], "radii": [0.075, 0.064, 0.055]}}, "parent": "torso", "attachment": {"parentSocket": "torso-upper-arm-l", "localStart": [0, 0, 0], "localEnd": [0, 0.39, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.39, "depth": 0.14, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.245, 0.27, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arm-01", "kind": "decal", "description": "Pink 01 upper-arm mark, surface graphic only", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_upper_arm_l_17.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["torso"] ?? root).add(node_upper_arm_l_17);
  nodes["upper-arm-l"] = node_upper_arm_l_17;
  const mesh_upper_arm_l_17Geometry = endpoint_upper_arm_l_17
    ? new THREE.CylinderGeometry(endpoint_upper_arm_l_17.endRadius, endpoint_upper_arm_l_17.baseRadius, endpoint_upper_arm_l_17.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_upper_arm_l_17) {
    mesh_upper_arm_l_17Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_upper_arm_l_17 = new THREE.Mesh(
    mesh_upper_arm_l_17Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_upper_arm_l_17.name = "upper-arm-l";
  if (endpoint_upper_arm_l_17) {
    mesh_upper_arm_l_17.position.copy(endpoint_upper_arm_l_17.midpoint);
    mesh_upper_arm_l_17.quaternion.copy(endpoint_upper_arm_l_17.quaternion);
  }
  mesh_upper_arm_l_17.castShadow = options.castShadow ?? true;
  mesh_upper_arm_l_17.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_arm_l_17.userData.sculptComponent = {"id": "upper-arm-l", "name": "upper-arm-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.105, -0.21, 0], [0.18, -0.38, 0.01]], "radii": [0.075, 0.064, 0.055]}}, "parent": "torso", "attachment": {"parentSocket": "torso-upper-arm-l", "localStart": [0, 0, 0], "localEnd": [0, 0.39, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.39, "depth": 0.14, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.245, 0.27, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arm-01", "kind": "decal", "description": "Pink 01 upper-arm mark, surface graphic only", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_upper_arm_l_17.add(mesh_upper_arm_l_17);
  meshes["upper-arm-l"] = mesh_upper_arm_l_17;
  colliders["upper-arm-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["upper-arm-l"] ??= [];
  destructionGroups["upper-arm-l"].push(node_upper_arm_l_17);

  const attachment_sleeve_l_18 = {"parentSocket": "upper-arm-l-sleeve-l", "localStart": [0, 0, 0], "localEnd": [0, 0.68, 0], "contactType": "overlap", "baseRadius": 0.14, "endRadius": 0.09333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_sleeve_l_18 = makeAttachmentEndpoint(attachment_sleeve_l_18);
  const node_sleeve_l_18 = new THREE.Group();
  node_sleeve_l_18.name = "sleeve-l__pivot";
  node_sleeve_l_18.scale.set(1, 1, 1);
  if (endpoint_sleeve_l_18) {
    node_sleeve_l_18.position.copy(endpoint_sleeve_l_18.start);
    node_sleeve_l_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_l_18.position.set(0.12, -0.25, 0.0);
    node_sleeve_l_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_l_18.userData.sculptComponent = {"id": "sleeve-l", "name": "sleeve-l", "level": "meso", "role": "shell", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "geometryDescriptor": {"topologyIntent": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.12, -0.28, 0.01], [0.25, -0.62, 0.02]], "radii": [[0.075, 0.07], [0.09, 0.08], [0.16, 0.1]], "doubleSidedOpening": true}}, "parent": "upper-arm-l", "attachment": {"parentSocket": "upper-arm-l-sleeve-l", "localStart": [0, 0, 0], "localEnd": [0, 0.68, 0], "contactType": "overlap", "baseRadius": 0.14, "endRadius": 0.09333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.28, "height": 0.68, "depth": 0.23, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.12, -0.25, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "sleeve-cyan-rim", "kind": "linework", "description": "Cyan border at flared cuff", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}, {"id": "sleeve-control-strip", "kind": "decal", "description": "Small cyan control strip down outer forearm", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_sleeve_l_18.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["upper-arm-l"] ?? root).add(node_sleeve_l_18);
  nodes["sleeve-l"] = node_sleeve_l_18;
  const mesh_sleeve_l_18Geometry = endpoint_sleeve_l_18
    ? new THREE.CylinderGeometry(endpoint_sleeve_l_18.endRadius, endpoint_sleeve_l_18.baseRadius, endpoint_sleeve_l_18.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_sleeve_l_18) {
    mesh_sleeve_l_18Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_l_18 = new THREE.Mesh(
    mesh_sleeve_l_18Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_l_18.name = "sleeve-l";
  if (endpoint_sleeve_l_18) {
    mesh_sleeve_l_18.position.copy(endpoint_sleeve_l_18.midpoint);
    mesh_sleeve_l_18.quaternion.copy(endpoint_sleeve_l_18.quaternion);
  }
  mesh_sleeve_l_18.castShadow = options.castShadow ?? true;
  mesh_sleeve_l_18.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_l_18.userData.sculptComponent = {"id": "sleeve-l", "name": "sleeve-l", "level": "meso", "role": "shell", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "geometryDescriptor": {"topologyIntent": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.12, -0.28, 0.01], [0.25, -0.62, 0.02]], "radii": [[0.075, 0.07], [0.09, 0.08], [0.16, 0.1]], "doubleSidedOpening": true}}, "parent": "upper-arm-l", "attachment": {"parentSocket": "upper-arm-l-sleeve-l", "localStart": [0, 0, 0], "localEnd": [0, 0.68, 0], "contactType": "overlap", "baseRadius": 0.14, "endRadius": 0.09333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.28, "height": 0.68, "depth": 0.23, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.12, -0.25, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "sleeve-cyan-rim", "kind": "linework", "description": "Cyan border at flared cuff", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}, {"id": "sleeve-control-strip", "kind": "decal", "description": "Small cyan control strip down outer forearm", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_sleeve_l_18.add(mesh_sleeve_l_18);
  meshes["sleeve-l"] = mesh_sleeve_l_18;
  colliders["sleeve-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-l"] ??= [];
  destructionGroups["sleeve-l"].push(node_sleeve_l_18);

  const attachment_hand_l_19 = {"parentSocket": "sleeve-l-hand-l", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.085, "endRadius": 0.05666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_hand_l_19 = makeAttachmentEndpoint(attachment_hand_l_19);
  const node_hand_l_19 = new THREE.Group();
  node_hand_l_19.name = "hand-l__pivot";
  node_hand_l_19.scale.set(1, 1, 1);
  if (endpoint_hand_l_19) {
    node_hand_l_19.position.copy(endpoint_hand_l_19.start);
    node_hand_l_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hand_l_19.position.set(0.26, -0.63, 0.015);
    node_hand_l_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_hand_l_19.userData.sculptComponent = {"id": "hand-l", "name": "hand-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"palm": "flattened closed smooth volume", "fingers": "five individually named tapered curved sweeps", "fingerLengths": [0.09, 0.12, 0.13, 0.115, 0.09], "spreadDegrees": [45, 14, 0, -10, -20], "mirrorRule": "negate only X, retain Z"}}, "parent": "sleeve-l", "attachment": {"parentSocket": "sleeve-l-hand-l", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.085, "endRadius": 0.05666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.17, "height": 0.12, "depth": 0.055, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.26, -0.63, 0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hand_l_19.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["sleeve-l"] ?? root).add(node_hand_l_19);
  nodes["hand-l"] = node_hand_l_19;
  const mesh_hand_l_19Geometry = endpoint_hand_l_19
    ? new THREE.CylinderGeometry(endpoint_hand_l_19.endRadius, endpoint_hand_l_19.baseRadius, endpoint_hand_l_19.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_hand_l_19) {
    mesh_hand_l_19Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_hand_l_19 = new THREE.Mesh(
    mesh_hand_l_19Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_l_19.name = "hand-l";
  if (endpoint_hand_l_19) {
    mesh_hand_l_19.position.copy(endpoint_hand_l_19.midpoint);
    mesh_hand_l_19.quaternion.copy(endpoint_hand_l_19.quaternion);
  }
  mesh_hand_l_19.castShadow = options.castShadow ?? true;
  mesh_hand_l_19.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_l_19.userData.sculptComponent = {"id": "hand-l", "name": "hand-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"palm": "flattened closed smooth volume", "fingers": "five individually named tapered curved sweeps", "fingerLengths": [0.09, 0.12, 0.13, 0.115, 0.09], "spreadDegrees": [45, 14, 0, -10, -20], "mirrorRule": "negate only X, retain Z"}}, "parent": "sleeve-l", "attachment": {"parentSocket": "sleeve-l-hand-l", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.085, "endRadius": 0.05666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.17, "height": 0.12, "depth": 0.055, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.26, -0.63, 0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hand_l_19.add(mesh_hand_l_19);
  meshes["hand-l"] = mesh_hand_l_19;
  colliders["hand-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hand-l"] ??= [];
  destructionGroups["hand-l"].push(node_hand_l_19);

  const attachment_thigh_l_20 = {"parentSocket": "root-thigh-l", "localStart": [0, 0, 0], "localEnd": [0, 0.45, 0], "contactType": "overlap", "baseRadius": 0.105, "endRadius": 0.06999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_thigh_l_20 = makeAttachmentEndpoint(attachment_thigh_l_20);
  const node_thigh_l_20 = new THREE.Group();
  node_thigh_l_20.name = "thigh-l__pivot";
  node_thigh_l_20.scale.set(1, 1, 1);
  if (endpoint_thigh_l_20) {
    node_thigh_l_20.position.copy(endpoint_thigh_l_20.start);
    node_thigh_l_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_thigh_l_20.position.set(0.13, 1.59, 0.0);
    node_thigh_l_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_thigh_l_20.userData.sculptComponent = {"id": "thigh-l", "name": "thigh-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.11, 0], [0, -0.14, 0], [0.005, -0.32, 0.01]], "radii": [0.115, 0.107, 0.09]}}, "parent": "root", "attachment": {"parentSocket": "root-thigh-l", "localStart": [0, 0, 0], "localEnd": [0, 0.45, 0], "contactType": "overlap", "baseRadius": 0.105, "endRadius": 0.06999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.21, "height": 0.45, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.13, 1.59, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_thigh_l_20.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_thigh_l_20);
  nodes["thigh-l"] = node_thigh_l_20;
  const mesh_thigh_l_20Geometry = endpoint_thigh_l_20
    ? new THREE.CylinderGeometry(endpoint_thigh_l_20.endRadius, endpoint_thigh_l_20.baseRadius, endpoint_thigh_l_20.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_thigh_l_20) {
    mesh_thigh_l_20Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_thigh_l_20 = new THREE.Mesh(
    mesh_thigh_l_20Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_thigh_l_20.name = "thigh-l";
  if (endpoint_thigh_l_20) {
    mesh_thigh_l_20.position.copy(endpoint_thigh_l_20.midpoint);
    mesh_thigh_l_20.quaternion.copy(endpoint_thigh_l_20.quaternion);
  }
  mesh_thigh_l_20.castShadow = options.castShadow ?? true;
  mesh_thigh_l_20.receiveShadow = options.receiveShadow ?? true;
  mesh_thigh_l_20.userData.sculptComponent = {"id": "thigh-l", "name": "thigh-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.11, 0], [0, -0.14, 0], [0.005, -0.32, 0.01]], "radii": [0.115, 0.107, 0.09]}}, "parent": "root", "attachment": {"parentSocket": "root-thigh-l", "localStart": [0, 0, 0], "localEnd": [0, 0.45, 0], "contactType": "overlap", "baseRadius": 0.105, "endRadius": 0.06999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.21, "height": 0.45, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.13, 1.59, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_thigh_l_20.add(mesh_thigh_l_20);
  meshes["thigh-l"] = mesh_thigh_l_20;
  colliders["thigh-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["thigh-l"] ??= [];
  destructionGroups["thigh-l"].push(node_thigh_l_20);

  const attachment_boot_l_21 = {"parentSocket": "root-boot-l", "localStart": [0, 0, 0], "localEnd": [0, 1.44, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_boot_l_21 = makeAttachmentEndpoint(attachment_boot_l_21);
  const node_boot_l_21 = new THREE.Group();
  node_boot_l_21.name = "boot-l__pivot";
  node_boot_l_21.scale.set(1, 1, 1);
  if (endpoint_boot_l_21) {
    node_boot_l_21.position.copy(endpoint_boot_l_21.start);
    node_boot_l_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_boot_l_21.position.set(0.13, 0.73, 0.01);
    node_boot_l_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_boot_l_21.userData.sculptComponent = {"id": "boot-l", "name": "boot-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[0, 0.077, 0.1], [0.1, 0.065, 0.085], [0.38, 0.08, 0.085], [0.67, 0.07, 0.09], [1.01, 0.085, 0.095], [1.38, 0.103, 0.105]], "cyanTopBand": 0.014}}, "parent": "root", "attachment": {"parentSocket": "root-boot-l", "localStart": [0, 0, 0], "localEnd": [0, 1.44, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 1.44, "depth": 0.21, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.13, 0.73, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "boot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "boot-top-band", "kind": "linework", "description": "Cyan thin top band across thigh boot", "evidenceRefs": ["front-legs"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}, {"id": "boot-panel-stitches", "kind": "linework", "description": "Subtle dark rectangular front boot panel marks", "evidenceRefs": ["front-legs"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_boot_l_21.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "boot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["root"] ?? root).add(node_boot_l_21);
  nodes["boot-l"] = node_boot_l_21;
  const mesh_boot_l_21Geometry = endpoint_boot_l_21
    ? new THREE.CylinderGeometry(endpoint_boot_l_21.endRadius, endpoint_boot_l_21.baseRadius, endpoint_boot_l_21.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_boot_l_21) {
    mesh_boot_l_21Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_boot_l_21 = new THREE.Mesh(
    mesh_boot_l_21Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_boot_l_21.name = "boot-l";
  if (endpoint_boot_l_21) {
    mesh_boot_l_21.position.copy(endpoint_boot_l_21.midpoint);
    mesh_boot_l_21.quaternion.copy(endpoint_boot_l_21.quaternion);
  }
  mesh_boot_l_21.castShadow = options.castShadow ?? true;
  mesh_boot_l_21.receiveShadow = options.receiveShadow ?? true;
  mesh_boot_l_21.userData.sculptComponent = {"id": "boot-l", "name": "boot-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[0, 0.077, 0.1], [0.1, 0.065, 0.085], [0.38, 0.08, 0.085], [0.67, 0.07, 0.09], [1.01, 0.085, 0.095], [1.38, 0.103, 0.105]], "cyanTopBand": 0.014}}, "parent": "root", "attachment": {"parentSocket": "root-boot-l", "localStart": [0, 0, 0], "localEnd": [0, 1.44, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 1.44, "depth": 0.21, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.13, 0.73, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "boot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "boot-top-band", "kind": "linework", "description": "Cyan thin top band across thigh boot", "evidenceRefs": ["front-legs"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}, {"id": "boot-panel-stitches", "kind": "linework", "description": "Subtle dark rectangular front boot panel marks", "evidenceRefs": ["front-legs"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_boot_l_21.add(mesh_boot_l_21);
  meshes["boot-l"] = mesh_boot_l_21;
  colliders["boot-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["boot-l"] ??= [];
  destructionGroups["boot-l"].push(node_boot_l_21);

  const attachment_foot_l_22 = {"parentSocket": "boot-l-foot-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_foot_l_22 = makeAttachmentEndpoint(attachment_foot_l_22);
  const node_foot_l_22 = new THREE.Group();
  node_foot_l_22.name = "foot-l__pivot";
  node_foot_l_22.scale.set(1, 1, 1);
  if (endpoint_foot_l_22) {
    node_foot_l_22.position.copy(endpoint_foot_l_22.start);
    node_foot_l_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_foot_l_22.position.set(0.0, -0.66, 0.08);
    node_foot_l_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_foot_l_22.userData.sculptComponent = {"id": "foot-l", "name": "foot-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"closedLoft": true, "toeForward": "+Z", "toeTaper": 0.7, "soleThickness": 0.018}}, "parent": "boot-l", "attachment": {"parentSocket": "boot-l-foot-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.36, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.66, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "boot-sole-trim", "kind": "linework", "description": "Thin cyan sole edge", "evidenceRefs": ["front-legs"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_foot_l_22.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["boot-l"] ?? root).add(node_foot_l_22);
  nodes["foot-l"] = node_foot_l_22;
  const mesh_foot_l_22Geometry = endpoint_foot_l_22
    ? new THREE.CylinderGeometry(endpoint_foot_l_22.endRadius, endpoint_foot_l_22.baseRadius, endpoint_foot_l_22.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_foot_l_22) {
    mesh_foot_l_22Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_foot_l_22 = new THREE.Mesh(
    mesh_foot_l_22Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_foot_l_22.name = "foot-l";
  if (endpoint_foot_l_22) {
    mesh_foot_l_22.position.copy(endpoint_foot_l_22.midpoint);
    mesh_foot_l_22.quaternion.copy(endpoint_foot_l_22.quaternion);
  }
  mesh_foot_l_22.castShadow = options.castShadow ?? true;
  mesh_foot_l_22.receiveShadow = options.receiveShadow ?? true;
  mesh_foot_l_22.userData.sculptComponent = {"id": "foot-l", "name": "foot-l", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"closedLoft": true, "toeForward": "+Z", "toeTaper": 0.7, "soleThickness": 0.018}}, "parent": "boot-l", "attachment": {"parentSocket": "boot-l-foot-l", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.36, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.66, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "boot-sole-trim", "kind": "linework", "description": "Thin cyan sole edge", "evidenceRefs": ["front-legs"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_foot_l_22.add(mesh_foot_l_22);
  meshes["foot-l"] = mesh_foot_l_22;
  colliders["foot-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["foot-l"] ??= [];
  destructionGroups["foot-l"].push(node_foot_l_22);

  const endpoint_twintail_r_23 = makeAttachmentEndpoint(null);
  const node_twintail_r_23 = new THREE.Group();
  node_twintail_r_23.name = "twintail-r__pivot";
  node_twintail_r_23.scale.set(1, 1, 1);
  if (endpoint_twintail_r_23) {
    node_twintail_r_23.position.copy(endpoint_twintail_r_23.start);
    node_twintail_r_23.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_twintail_r_23.position.set(-0.245, 0.12, -0.045);
    node_twintail_r_23.rotation.set(0.0, 0.0, 0.0);
  }
  node_twintail_r_23.userData.sculptComponent = {"id": "twintail-r", "name": "twintail-r", "level": "macro", "role": "hair", "importance": 0.95, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "geometryDescriptor": {"topologyIntent": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [-0.12, -0.47, -0.06], [-0.57, -1.4, 0.02], [-0.72, -2.0, 0.14], [-0.45, -2.58, 0.18]], "widthProfile": [0.25, 0.45, 0.85, 1, 0.12, 0.015], "thicknessProfile": [0.16, 0.17, 0.2, 0.15, 0.08, 0.003], "rootEmbedDepth": 0.03, "crossSection": "closed flattened ellipse with subtle longitudinal facets", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0, 0], "rx": 0.145, "rz": 0.075, "twist": 0}, {"position": [-0.12, -0.47, -0.06], "rx": 0.10874999999999999, "rz": 0.056249999999999994, "twist": 0}, {"position": [-0.57, -1.4, 0.02], "rx": 0.0725, "rz": 0.0375, "twist": 0}, {"position": [-0.72, -2.0, 0.14], "rx": 0.03625, "rz": 0.01875, "twist": 0}, {"position": [-0.45, -2.58, 0.18], "rx": 0.00145, "rz": 0.00075, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-twintail-r", "localStart": [0, 0, 0], "localEnd": [0, 2.65, 0], "contactType": "overlap", "baseRadius": 0.21, "endRadius": 0.13999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 2.65, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.245, 0.12, -0.045], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "twintail-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L1", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_twintail_r_23.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "twintail-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["scalp"] ?? root).add(node_twintail_r_23);
  nodes["twintail-r"] = node_twintail_r_23;
  const mesh_twintail_r_23Geometry = endpoint_twintail_r_23
    ? new THREE.CylinderGeometry(endpoint_twintail_r_23.endRadius, endpoint_twintail_r_23.baseRadius, endpoint_twintail_r_23.length, 16, 6)
    : buildTaperedSweepGeometry({"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0, 0], "rx": 0.145, "rz": 0.075, "twist": 0}, {"position": [-0.12, -0.47, -0.06], "rx": 0.10874999999999999, "rz": 0.056249999999999994, "twist": 0}, {"position": [-0.57, -1.4, 0.02], "rx": 0.0725, "rz": 0.0375, "twist": 0}, {"position": [-0.72, -2.0, 0.14], "rx": 0.03625, "rz": 0.01875, "twist": 0}, {"position": [-0.45, -2.58, 0.18], "rx": 0.00145, "rz": 0.00075, "twist": 0}]});
  if (!endpoint_twintail_r_23) {
    mesh_twintail_r_23Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_twintail_r_23 = new THREE.Mesh(
    mesh_twintail_r_23Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_twintail_r_23.name = "twintail-r";
  if (endpoint_twintail_r_23) {
    mesh_twintail_r_23.position.copy(endpoint_twintail_r_23.midpoint);
    mesh_twintail_r_23.quaternion.copy(endpoint_twintail_r_23.quaternion);
  }
  mesh_twintail_r_23.castShadow = options.castShadow ?? true;
  mesh_twintail_r_23.receiveShadow = options.receiveShadow ?? true;
  mesh_twintail_r_23.userData.sculptComponent = {"id": "twintail-r", "name": "twintail-r", "level": "macro", "role": "hair", "importance": 0.95, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "geometryDescriptor": {"topologyIntent": "High-root broad curved twin tail with thick ribbon volume, outward arc and split tapered lower ends; not cylindrical noodle.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [-0.12, -0.47, -0.06], [-0.57, -1.4, 0.02], [-0.72, -2.0, 0.14], [-0.45, -2.58, 0.18]], "widthProfile": [0.25, 0.45, 0.85, 1, 0.12, 0.015], "thicknessProfile": [0.16, 0.17, 0.2, 0.15, 0.08, 0.003], "rootEmbedDepth": 0.03, "crossSection": "closed flattened ellipse with subtle longitudinal facets", "rootBinding": {"scalpUV": [0.5, 0.22], "notes": "Head-local scalp-UV anchor; root x/y fitting preserved in per-lock transform."}}, "taperedSweep": {"radialSegments": 12, "samplesPerSegment": 8, "capStart": true, "capEnd": true, "stations": [{"position": [0, 0, 0], "rx": 0.145, "rz": 0.075, "twist": 0}, {"position": [-0.12, -0.47, -0.06], "rx": 0.10874999999999999, "rz": 0.056249999999999994, "twist": 0}, {"position": [-0.57, -1.4, 0.02], "rx": 0.0725, "rz": 0.0375, "twist": 0}, {"position": [-0.72, -2.0, 0.14], "rx": 0.03625, "rz": 0.01875, "twist": 0}, {"position": [-0.45, -2.58, 0.18], "rx": 0.00145, "rz": 0.00075, "twist": 0}]}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-twintail-r", "localStart": [0, 0, 0], "localEnd": [0, 2.65, 0], "contactType": "overlap", "baseRadius": 0.21, "endRadius": 0.13999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 2.65, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.245, 0.12, -0.045], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "twintail-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L1", "colorMaterialRecipe": {"dominantAlbedo": "rgba(107, 203, 210, 1)", "secondaryAlbedo": "rgba(107, 203, 210, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}, "standProud": {"againstComponentId": "head", "clearance": 0.012, "maxPush": 0.04, "notes": "Closed scalp plus embedded fringe roots; bounded outside-surface constraint."}};
  node_twintail_r_23.add(mesh_twintail_r_23);
  meshes["twintail-r"] = mesh_twintail_r_23;
  colliders["twintail-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["twintail-r"] ??= [];
  destructionGroups["twintail-r"].push(node_twintail_r_23);

  const endpoint_hairband_r_24 = makeAttachmentEndpoint(null);
  const node_hairband_r_24 = new THREE.Group();
  node_hairband_r_24.name = "hairband-r__pivot";
  node_hairband_r_24.scale.set(1, 1, 1);
  if (endpoint_hairband_r_24) {
    node_hairband_r_24.position.copy(endpoint_hairband_r_24.start);
    node_hairband_r_24.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hairband_r_24.position.set(-0.245, 0.19, 0.005);
    node_hairband_r_24.rotation.set(0.0, 0.0, 0.0);
  }
  node_hairband_r_24.userData.sculptComponent = {"id": "hairband-r", "name": "hairband-r", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "geometryDescriptor": {"topologyIntent": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-hairband-r", "localStart": [0, 0, 0], "localEnd": [0, 0.23, 0], "contactType": "overlap", "baseRadius": 0.0325, "endRadius": 0.021666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.065, "height": 0.23, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.245, 0.19, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hairband-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hairband_r_24.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hairband-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}};
  (nodes["scalp"] ?? root).add(node_hairband_r_24);
  nodes["hairband-r"] = node_hairband_r_24;
  const mesh_hairband_r_24Geometry = endpoint_hairband_r_24
    ? new THREE.CylinderGeometry(endpoint_hairband_r_24.endRadius, endpoint_hairband_r_24.baseRadius, endpoint_hairband_r_24.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_hairband_r_24) {
    mesh_hairband_r_24Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_hairband_r_24 = new THREE.Mesh(
    mesh_hairband_r_24Geometry,
    materialMap["ink"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hairband_r_24.name = "hairband-r";
  if (endpoint_hairband_r_24) {
    mesh_hairband_r_24.position.copy(endpoint_hairband_r_24.midpoint);
    mesh_hairband_r_24.quaternion.copy(endpoint_hairband_r_24.quaternion);
  }
  mesh_hairband_r_24.castShadow = options.castShadow ?? true;
  mesh_hairband_r_24.receiveShadow = options.receiveShadow ?? true;
  mesh_hairband_r_24.userData.sculptComponent = {"id": "hairband-r", "name": "hairband-r", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "geometryDescriptor": {"topologyIntent": "Black tilted rectangular hair ornament with pink inset stripe, rigidly attached at twin-tail root.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "scalp", "attachment": {"parentSocket": "scalp-hairband-r", "localStart": [0, 0, 0], "localEnd": [0, 0.23, 0], "contactType": "overlap", "baseRadius": 0.0325, "endRadius": 0.021666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.065, "height": 0.23, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.245, 0.19, 0.005], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hairband-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hairband_r_24.add(mesh_hairband_r_24);
  meshes["hairband-r"] = mesh_hairband_r_24;
  colliders["hairband-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hairband-r"] ??= [];
  destructionGroups["hairband-r"].push(node_hairband_r_24);

  const endpoint_earphone_r_25 = makeAttachmentEndpoint(null);
  const node_earphone_r_25 = new THREE.Group();
  node_earphone_r_25.name = "earphone-r__pivot";
  node_earphone_r_25.scale.set(1, 1, 1);
  if (endpoint_earphone_r_25) {
    node_earphone_r_25.position.copy(endpoint_earphone_r_25.start);
    node_earphone_r_25.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_earphone_r_25.position.set(-0.225, -0.015, 0.0);
    node_earphone_r_25.rotation.set(0.0, 0.0, 0.0);
  }
  node_earphone_r_25.userData.sculptComponent = {"id": "earphone-r", "name": "earphone-r", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Small dark earphone cup contacting temporal head; pink exterior detail.", "geometryDescriptor": {"topologyIntent": "Small dark earphone cup contacting temporal head; pink exterior detail.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-earphone-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.035, "endRadius": 0.023333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.13, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.225, -0.015, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "earphone-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_earphone_r_25.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "earphone-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}};
  (nodes["head"] ?? root).add(node_earphone_r_25);
  nodes["earphone-r"] = node_earphone_r_25;
  const mesh_earphone_r_25Geometry = endpoint_earphone_r_25
    ? new THREE.CylinderGeometry(endpoint_earphone_r_25.endRadius, endpoint_earphone_r_25.baseRadius, endpoint_earphone_r_25.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_earphone_r_25) {
    mesh_earphone_r_25Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_earphone_r_25 = new THREE.Mesh(
    mesh_earphone_r_25Geometry,
    materialMap["ink"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_earphone_r_25.name = "earphone-r";
  if (endpoint_earphone_r_25) {
    mesh_earphone_r_25.position.copy(endpoint_earphone_r_25.midpoint);
    mesh_earphone_r_25.quaternion.copy(endpoint_earphone_r_25.quaternion);
  }
  mesh_earphone_r_25.castShadow = options.castShadow ?? true;
  mesh_earphone_r_25.receiveShadow = options.receiveShadow ?? true;
  mesh_earphone_r_25.userData.sculptComponent = {"id": "earphone-r", "name": "earphone-r", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Small dark earphone cup contacting temporal head; pink exterior detail.", "geometryDescriptor": {"topologyIntent": "Small dark earphone cup contacting temporal head; pink exterior detail.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-earphone-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.035, "endRadius": 0.023333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.13, "depth": 0.09, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.225, -0.015, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "earphone-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_earphone_r_25.add(mesh_earphone_r_25);
  meshes["earphone-r"] = mesh_earphone_r_25;
  colliders["earphone-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["earphone-r"] ??= [];
  destructionGroups["earphone-r"].push(node_earphone_r_25);

  const endpoint_eye_r_26 = makeAttachmentEndpoint(null);
  const node_eye_r_26 = new THREE.Group();
  node_eye_r_26.name = "eye-r__pivot";
  node_eye_r_26.scale.set(1, 1, 1);
  if (endpoint_eye_r_26) {
    node_eye_r_26.position.copy(endpoint_eye_r_26.start);
    node_eye_r_26.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_r_26.position.set(-0.097, -0.045, 0.17);
    node_eye_r_26.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_r_26.userData.sculptComponent = {"id": "eye-r", "name": "eye-r", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "geometryDescriptor": {"topologyIntent": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-eye-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.0515, "endRadius": 0.034333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.103, "height": 0.13, "depth": 0.015, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.097, -0.045, 0.17], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-head"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 251, 251, 1)", "secondaryAlbedo": "rgba(250, 251, 251, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-head"]}};
  node_eye_r_26.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}};
  (nodes["head"] ?? root).add(node_eye_r_26);
  nodes["eye-r"] = node_eye_r_26;
  const mesh_eye_r_26Geometry = endpoint_eye_r_26
    ? new THREE.CylinderGeometry(endpoint_eye_r_26.endRadius, endpoint_eye_r_26.baseRadius, endpoint_eye_r_26.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_r_26) {
    mesh_eye_r_26Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_eye_r_26 = new THREE.Mesh(
    mesh_eye_r_26Geometry,
    materialMap["eye-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_r_26.name = "eye-r";
  if (endpoint_eye_r_26) {
    mesh_eye_r_26.position.copy(endpoint_eye_r_26.midpoint);
    mesh_eye_r_26.quaternion.copy(endpoint_eye_r_26.quaternion);
  }
  mesh_eye_r_26.castShadow = options.castShadow ?? true;
  mesh_eye_r_26.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_r_26.userData.sculptComponent = {"id": "eye-r", "name": "eye-r", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "geometryDescriptor": {"topologyIntent": "Almond sclera conformed to shallow face, teal iris and upper lash; attachment follows head surface.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "head", "attachment": {"parentSocket": "head-eye-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.0515, "endRadius": 0.034333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.103, "height": 0.13, "depth": 0.015, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.097, -0.045, 0.17], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-head"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 251, 251, 1)", "secondaryAlbedo": "rgba(250, 251, 251, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-head"]}};
  node_eye_r_26.add(mesh_eye_r_26);
  meshes["eye-r"] = mesh_eye_r_26;
  colliders["eye-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-r"] ??= [];
  destructionGroups["eye-r"].push(node_eye_r_26);

  const endpoint_iris_r_27 = makeAttachmentEndpoint(null);
  const node_iris_r_27 = new THREE.Group();
  node_iris_r_27.name = "iris-r__pivot";
  node_iris_r_27.scale.set(1, 1, 1);
  if (endpoint_iris_r_27) {
    node_iris_r_27.position.copy(endpoint_iris_r_27.start);
    node_iris_r_27.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_iris_r_27.position.set(0.0, 0.0, 0.009);
    node_iris_r_27.rotation.set(0.0, 0.0, 0.0);
  }
  node_iris_r_27.userData.sculptComponent = {"id": "iris-r", "name": "iris-r", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Teal oval iris with darker upper region and small bright catchlights.", "geometryDescriptor": {"topologyIntent": "Teal oval iris with darker upper region and small bright catchlights.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "eye-r", "attachment": {"parentSocket": "eye-r-iris-r", "localStart": [0, 0, 0], "localEnd": [0, 0.105, 0], "contactType": "overlap", "baseRadius": 0.03, "endRadius": 0.02, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.06, "height": 0.105, "depth": 0.008, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0.009], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "iris"}}, "material": "iris", "materialLayers": ["iris"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(45, 158, 169, 1)", "secondaryAlbedo": "rgba(45, 158, 169, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_iris_r_27.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "iris"}};
  (nodes["eye-r"] ?? root).add(node_iris_r_27);
  nodes["iris-r"] = node_iris_r_27;
  const mesh_iris_r_27Geometry = endpoint_iris_r_27
    ? new THREE.CylinderGeometry(endpoint_iris_r_27.endRadius, endpoint_iris_r_27.baseRadius, endpoint_iris_r_27.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_iris_r_27) {
    mesh_iris_r_27Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_iris_r_27 = new THREE.Mesh(
    mesh_iris_r_27Geometry,
    materialMap["iris"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_iris_r_27.name = "iris-r";
  if (endpoint_iris_r_27) {
    mesh_iris_r_27.position.copy(endpoint_iris_r_27.midpoint);
    mesh_iris_r_27.quaternion.copy(endpoint_iris_r_27.quaternion);
  }
  mesh_iris_r_27.castShadow = options.castShadow ?? true;
  mesh_iris_r_27.receiveShadow = options.receiveShadow ?? true;
  mesh_iris_r_27.userData.sculptComponent = {"id": "iris-r", "name": "iris-r", "level": "micro", "role": "eye", "importance": 0.8, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "conforming-shell", "topologyRationale": "Teal oval iris with darker upper region and small bright catchlights.", "geometryDescriptor": {"topologyIntent": "Teal oval iris with darker upper region and small bright catchlights.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "eye-r", "attachment": {"parentSocket": "eye-r-iris-r", "localStart": [0, 0, 0], "localEnd": [0, 0.105, 0], "contactType": "overlap", "baseRadius": 0.03, "endRadius": 0.02, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.06, "height": 0.105, "depth": 0.008, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0.009], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "iris"}}, "material": "iris", "materialLayers": ["iris"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L2", "colorMaterialRecipe": {"dominantAlbedo": "rgba(45, 158, 169, 1)", "secondaryAlbedo": "rgba(45, 158, 169, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_iris_r_27.add(mesh_iris_r_27);
  meshes["iris-r"] = mesh_iris_r_27;
  colliders["iris-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["iris-r"] ??= [];
  destructionGroups["iris-r"].push(node_iris_r_27);

  const attachment_upper_arm_r_28 = {"parentSocket": "torso-upper-arm-r", "localStart": [0, 0, 0], "localEnd": [0, 0.39, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_upper_arm_r_28 = makeAttachmentEndpoint(attachment_upper_arm_r_28);
  const node_upper_arm_r_28 = new THREE.Group();
  node_upper_arm_r_28.name = "upper-arm-r__pivot";
  node_upper_arm_r_28.scale.set(1, 1, 1);
  if (endpoint_upper_arm_r_28) {
    node_upper_arm_r_28.position.copy(endpoint_upper_arm_r_28.start);
    node_upper_arm_r_28.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_upper_arm_r_28.position.set(-0.245, 0.27, 0.0);
    node_upper_arm_r_28.rotation.set(0.0, 0.0, 0.0);
  }
  node_upper_arm_r_28.userData.sculptComponent = {"id": "upper-arm-r", "name": "upper-arm-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [-0.105, -0.21, 0], [-0.18, -0.38, 0.01]], "radii": [0.075, 0.064, 0.055]}}, "parent": "torso", "attachment": {"parentSocket": "torso-upper-arm-r", "localStart": [0, 0, 0], "localEnd": [0, 0.39, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.39, "depth": 0.14, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.245, 0.27, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_upper_arm_r_28.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["torso"] ?? root).add(node_upper_arm_r_28);
  nodes["upper-arm-r"] = node_upper_arm_r_28;
  const mesh_upper_arm_r_28Geometry = endpoint_upper_arm_r_28
    ? new THREE.CylinderGeometry(endpoint_upper_arm_r_28.endRadius, endpoint_upper_arm_r_28.baseRadius, endpoint_upper_arm_r_28.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_upper_arm_r_28) {
    mesh_upper_arm_r_28Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_upper_arm_r_28 = new THREE.Mesh(
    mesh_upper_arm_r_28Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_upper_arm_r_28.name = "upper-arm-r";
  if (endpoint_upper_arm_r_28) {
    mesh_upper_arm_r_28.position.copy(endpoint_upper_arm_r_28.midpoint);
    mesh_upper_arm_r_28.quaternion.copy(endpoint_upper_arm_r_28.quaternion);
  }
  mesh_upper_arm_r_28.castShadow = options.castShadow ?? true;
  mesh_upper_arm_r_28.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_arm_r_28.userData.sculptComponent = {"id": "upper-arm-r", "name": "upper-arm-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [-0.105, -0.21, 0], [-0.18, -0.38, 0.01]], "radii": [0.075, 0.064, 0.055]}}, "parent": "torso", "attachment": {"parentSocket": "torso-upper-arm-r", "localStart": [0, 0, 0], "localEnd": [0, 0.39, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.39, "depth": 0.14, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.245, 0.27, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_upper_arm_r_28.add(mesh_upper_arm_r_28);
  meshes["upper-arm-r"] = mesh_upper_arm_r_28;
  colliders["upper-arm-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["upper-arm-r"] ??= [];
  destructionGroups["upper-arm-r"].push(node_upper_arm_r_28);

  const attachment_sleeve_r_29 = {"parentSocket": "upper-arm-r-sleeve-r", "localStart": [0, 0, 0], "localEnd": [0, 0.68, 0], "contactType": "overlap", "baseRadius": 0.14, "endRadius": 0.09333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_sleeve_r_29 = makeAttachmentEndpoint(attachment_sleeve_r_29);
  const node_sleeve_r_29 = new THREE.Group();
  node_sleeve_r_29.name = "sleeve-r__pivot";
  node_sleeve_r_29.scale.set(1, 1, 1);
  if (endpoint_sleeve_r_29) {
    node_sleeve_r_29.position.copy(endpoint_sleeve_r_29.start);
    node_sleeve_r_29.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_r_29.position.set(-0.12, -0.25, 0.0);
    node_sleeve_r_29.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_r_29.userData.sculptComponent = {"id": "sleeve-r", "name": "sleeve-r", "level": "meso", "role": "shell", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "geometryDescriptor": {"topologyIntent": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [-0.12, -0.28, 0.01], [-0.25, -0.62, 0.02]], "radii": [[0.075, 0.07], [0.09, 0.08], [0.16, 0.1]], "doubleSidedOpening": true}}, "parent": "upper-arm-r", "attachment": {"parentSocket": "upper-arm-r-sleeve-r", "localStart": [0, 0, 0], "localEnd": [0, 0.68, 0], "contactType": "overlap", "baseRadius": 0.14, "endRadius": 0.09333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.28, "height": 0.68, "depth": 0.23, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.12, -0.25, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_sleeve_r_29.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["upper-arm-r"] ?? root).add(node_sleeve_r_29);
  nodes["sleeve-r"] = node_sleeve_r_29;
  const mesh_sleeve_r_29Geometry = endpoint_sleeve_r_29
    ? new THREE.CylinderGeometry(endpoint_sleeve_r_29.endRadius, endpoint_sleeve_r_29.baseRadius, endpoint_sleeve_r_29.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_sleeve_r_29) {
    mesh_sleeve_r_29Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_r_29 = new THREE.Mesh(
    mesh_sleeve_r_29Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_r_29.name = "sleeve-r";
  if (endpoint_sleeve_r_29) {
    mesh_sleeve_r_29.position.copy(endpoint_sleeve_r_29.midpoint);
    mesh_sleeve_r_29.quaternion.copy(endpoint_sleeve_r_29.quaternion);
  }
  mesh_sleeve_r_29.castShadow = options.castShadow ?? true;
  mesh_sleeve_r_29.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_r_29.userData.sculptComponent = {"id": "sleeve-r", "name": "sleeve-r", "level": "meso", "role": "shell", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "geometryDescriptor": {"topologyIntent": "Dark separate sleeve widens toward wrist, cyan opening rim; continuous cloth shell.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [-0.12, -0.28, 0.01], [-0.25, -0.62, 0.02]], "radii": [[0.075, 0.07], [0.09, 0.08], [0.16, 0.1]], "doubleSidedOpening": true}}, "parent": "upper-arm-r", "attachment": {"parentSocket": "upper-arm-r-sleeve-r", "localStart": [0, 0, 0], "localEnd": [0, 0.68, 0], "contactType": "overlap", "baseRadius": 0.14, "endRadius": 0.09333333333333334, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.28, "height": 0.68, "depth": 0.23, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.12, -0.25, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_sleeve_r_29.add(mesh_sleeve_r_29);
  meshes["sleeve-r"] = mesh_sleeve_r_29;
  colliders["sleeve-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-r"] ??= [];
  destructionGroups["sleeve-r"].push(node_sleeve_r_29);

  const attachment_hand_r_30 = {"parentSocket": "sleeve-r-hand-r", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.085, "endRadius": 0.05666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_hand_r_30 = makeAttachmentEndpoint(attachment_hand_r_30);
  const node_hand_r_30 = new THREE.Group();
  node_hand_r_30.name = "hand-r__pivot";
  node_hand_r_30.scale.set(1, 1, 1);
  if (endpoint_hand_r_30) {
    node_hand_r_30.position.copy(endpoint_hand_r_30.start);
    node_hand_r_30.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hand_r_30.position.set(-0.26, -0.63, 0.015);
    node_hand_r_30.rotation.set(0.0, 0.0, 0.0);
  }
  node_hand_r_30.userData.sculptComponent = {"id": "hand-r", "name": "hand-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"palm": "flattened closed smooth volume", "fingers": "five individually named tapered curved sweeps", "fingerLengths": [0.09, 0.12, 0.13, 0.115, 0.09], "spreadDegrees": [45, 14, 0, -10, -20], "mirrorRule": "negate only X, retain Z"}}, "parent": "sleeve-r", "attachment": {"parentSocket": "sleeve-r-hand-r", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.085, "endRadius": 0.05666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.17, "height": 0.12, "depth": 0.055, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.26, -0.63, 0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hand_r_30.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["sleeve-r"] ?? root).add(node_hand_r_30);
  nodes["hand-r"] = node_hand_r_30;
  const mesh_hand_r_30Geometry = endpoint_hand_r_30
    ? new THREE.CylinderGeometry(endpoint_hand_r_30.endRadius, endpoint_hand_r_30.baseRadius, endpoint_hand_r_30.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_hand_r_30) {
    mesh_hand_r_30Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_hand_r_30 = new THREE.Mesh(
    mesh_hand_r_30Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_r_30.name = "hand-r";
  if (endpoint_hand_r_30) {
    mesh_hand_r_30.position.copy(endpoint_hand_r_30.midpoint);
    mesh_hand_r_30.quaternion.copy(endpoint_hand_r_30.quaternion);
  }
  mesh_hand_r_30.castShadow = options.castShadow ?? true;
  mesh_hand_r_30.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_r_30.userData.sculptComponent = {"id": "hand-r", "name": "hand-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"palm": "flattened closed smooth volume", "fingers": "five individually named tapered curved sweeps", "fingerLengths": [0.09, 0.12, 0.13, 0.115, 0.09], "spreadDegrees": [45, 14, 0, -10, -20], "mirrorRule": "negate only X, retain Z"}}, "parent": "sleeve-r", "attachment": {"parentSocket": "sleeve-r-hand-r", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.085, "endRadius": 0.05666666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.17, "height": 0.12, "depth": 0.055, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.26, -0.63, 0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_hand_r_30.add(mesh_hand_r_30);
  meshes["hand-r"] = mesh_hand_r_30;
  colliders["hand-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hand-r"] ??= [];
  destructionGroups["hand-r"].push(node_hand_r_30);

  const attachment_thigh_r_31 = {"parentSocket": "root-thigh-r", "localStart": [0, 0, 0], "localEnd": [0, 0.45, 0], "contactType": "overlap", "baseRadius": 0.105, "endRadius": 0.06999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_thigh_r_31 = makeAttachmentEndpoint(attachment_thigh_r_31);
  const node_thigh_r_31 = new THREE.Group();
  node_thigh_r_31.name = "thigh-r__pivot";
  node_thigh_r_31.scale.set(1, 1, 1);
  if (endpoint_thigh_r_31) {
    node_thigh_r_31.position.copy(endpoint_thigh_r_31.start);
    node_thigh_r_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_thigh_r_31.position.set(-0.13, 1.59, 0.0);
    node_thigh_r_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_thigh_r_31.userData.sculptComponent = {"id": "thigh-r", "name": "thigh-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.11, 0], [0, -0.14, 0], [-0.005, -0.32, 0.01]], "radii": [0.115, 0.107, 0.09]}}, "parent": "root", "attachment": {"parentSocket": "root-thigh-r", "localStart": [0, 0, 0], "localEnd": [0, 0.45, 0], "contactType": "overlap", "baseRadius": 0.105, "endRadius": 0.06999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.21, "height": 0.45, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.13, 1.59, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_thigh_r_31.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_thigh_r_31);
  nodes["thigh-r"] = node_thigh_r_31;
  const mesh_thigh_r_31Geometry = endpoint_thigh_r_31
    ? new THREE.CylinderGeometry(endpoint_thigh_r_31.endRadius, endpoint_thigh_r_31.baseRadius, endpoint_thigh_r_31.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_thigh_r_31) {
    mesh_thigh_r_31Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_thigh_r_31 = new THREE.Mesh(
    mesh_thigh_r_31Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_thigh_r_31.name = "thigh-r";
  if (endpoint_thigh_r_31) {
    mesh_thigh_r_31.position.copy(endpoint_thigh_r_31.midpoint);
    mesh_thigh_r_31.quaternion.copy(endpoint_thigh_r_31.quaternion);
  }
  mesh_thigh_r_31.castShadow = options.castShadow ?? true;
  mesh_thigh_r_31.receiveShadow = options.receiveShadow ?? true;
  mesh_thigh_r_31.userData.sculptComponent = {"id": "thigh-r", "name": "thigh-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0.11, 0], [0, -0.14, 0], [-0.005, -0.32, 0.01]], "radii": [0.115, 0.107, 0.09]}}, "parent": "root", "attachment": {"parentSocket": "root-thigh-r", "localStart": [0, 0, 0], "localEnd": [0, 0.45, 0], "contactType": "overlap", "baseRadius": 0.105, "endRadius": 0.06999999999999999, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.21, "height": 0.45, "depth": 0.22, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.13, 1.59, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 230, 219, 1)", "secondaryAlbedo": "rgba(255, 230, 219, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_thigh_r_31.add(mesh_thigh_r_31);
  meshes["thigh-r"] = mesh_thigh_r_31;
  colliders["thigh-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["thigh-r"] ??= [];
  destructionGroups["thigh-r"].push(node_thigh_r_31);

  const attachment_boot_r_32 = {"parentSocket": "root-boot-r", "localStart": [0, 0, 0], "localEnd": [0, 1.44, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_boot_r_32 = makeAttachmentEndpoint(attachment_boot_r_32);
  const node_boot_r_32 = new THREE.Group();
  node_boot_r_32.name = "boot-r__pivot";
  node_boot_r_32.scale.set(1, 1, 1);
  if (endpoint_boot_r_32) {
    node_boot_r_32.position.copy(endpoint_boot_r_32.start);
    node_boot_r_32.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_boot_r_32.position.set(-0.13, 0.73, 0.01);
    node_boot_r_32.rotation.set(0.0, 0.0, 0.0);
  }
  node_boot_r_32.userData.sculptComponent = {"id": "boot-r", "name": "boot-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[0, 0.077, 0.1], [0.1, 0.065, 0.085], [0.38, 0.08, 0.085], [0.67, 0.07, 0.09], [1.01, 0.085, 0.095], [1.38, 0.103, 0.105]], "cyanTopBand": 0.014}}, "parent": "root", "attachment": {"parentSocket": "root-boot-r", "localStart": [0, 0, 0], "localEnd": [0, 1.44, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 1.44, "depth": 0.21, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.13, 0.73, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "boot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_boot_r_32.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "boot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["root"] ?? root).add(node_boot_r_32);
  nodes["boot-r"] = node_boot_r_32;
  const mesh_boot_r_32Geometry = endpoint_boot_r_32
    ? new THREE.CylinderGeometry(endpoint_boot_r_32.endRadius, endpoint_boot_r_32.baseRadius, endpoint_boot_r_32.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_boot_r_32) {
    mesh_boot_r_32Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_boot_r_32 = new THREE.Mesh(
    mesh_boot_r_32Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_boot_r_32.name = "boot-r";
  if (endpoint_boot_r_32) {
    mesh_boot_r_32.position.copy(endpoint_boot_r_32.midpoint);
    mesh_boot_r_32.quaternion.copy(endpoint_boot_r_32.quaternion);
  }
  mesh_boot_r_32.castShadow = options.castShadow ?? true;
  mesh_boot_r_32.receiveShadow = options.receiveShadow ?? true;
  mesh_boot_r_32.userData.sculptComponent = {"id": "boot-r", "name": "boot-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[0, 0.077, 0.1], [0.1, 0.065, 0.085], [0.38, 0.08, 0.085], [0.67, 0.07, 0.09], [1.01, 0.085, 0.095], [1.38, 0.103, 0.105]], "cyanTopBand": 0.014}}, "parent": "root", "attachment": {"parentSocket": "root-boot-r", "localStart": [0, 0, 0], "localEnd": [0, 1.44, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 1.44, "depth": 0.21, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.13, 0.73, 0.01], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "boot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_boot_r_32.add(mesh_boot_r_32);
  meshes["boot-r"] = mesh_boot_r_32;
  colliders["boot-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["boot-r"] ??= [];
  destructionGroups["boot-r"].push(node_boot_r_32);

  const attachment_foot_r_33 = {"parentSocket": "boot-r-foot-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_foot_r_33 = makeAttachmentEndpoint(attachment_foot_r_33);
  const node_foot_r_33 = new THREE.Group();
  node_foot_r_33.name = "foot-r__pivot";
  node_foot_r_33.scale.set(1, 1, 1);
  if (endpoint_foot_r_33) {
    node_foot_r_33.position.copy(endpoint_foot_r_33.start);
    node_foot_r_33.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_foot_r_33.position.set(0.0, -0.66, 0.08);
    node_foot_r_33.rotation.set(0.0, 0.0, 0.0);
  }
  node_foot_r_33.userData.sculptComponent = {"id": "foot-r", "name": "foot-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"closedLoft": true, "toeForward": "+Z", "toeTaper": 0.7, "soleThickness": 0.018}}, "parent": "boot-r", "attachment": {"parentSocket": "boot-r-foot-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.36, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.66, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_foot_r_33.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["boot-r"] ?? root).add(node_foot_r_33);
  nodes["foot-r"] = node_foot_r_33;
  const mesh_foot_r_33Geometry = endpoint_foot_r_33
    ? new THREE.CylinderGeometry(endpoint_foot_r_33.endRadius, endpoint_foot_r_33.baseRadius, endpoint_foot_r_33.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_foot_r_33) {
    mesh_foot_r_33Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_foot_r_33 = new THREE.Mesh(
    mesh_foot_r_33Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_foot_r_33.name = "foot-r";
  if (endpoint_foot_r_33) {
    mesh_foot_r_33.position.copy(endpoint_foot_r_33.midpoint);
    mesh_foot_r_33.quaternion.copy(endpoint_foot_r_33.quaternion);
  }
  mesh_foot_r_33.castShadow = options.castShadow ?? true;
  mesh_foot_r_33.receiveShadow = options.receiveShadow ?? true;
  mesh_foot_r_33.userData.sculptComponent = {"id": "foot-r", "name": "foot-r", "level": "meso", "role": "limb", "importance": 0.8, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-visible continuous body contour, represented as closed lofted surface rather than disconnected primitive blocks.", "geometryDescriptor": {"topologyIntent": "Closed continuous loft, normals recomputed across connected rings", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"closedLoft": true, "toeForward": "+Z", "toeTaper": 0.7, "soleThickness": 0.018}}, "parent": "boot-r", "attachment": {"parentSocket": "boot-r-foot-r", "localStart": [0, 0, 0], "localEnd": [0, 0.13, 0], "contactType": "overlap", "baseRadius": 0.09, "endRadius": 0.06, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 0.13, "depth": 0.36, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.66, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L0", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_foot_r_33.add(mesh_foot_r_33);
  meshes["foot-r"] = mesh_foot_r_33;
  colliders["foot-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["foot-r"] ??= [];
  destructionGroups["foot-r"].push(node_foot_r_33);

  const attachment_blouse_34 = {"parentSocket": "torso-blouse", "localStart": [0, 0, 0], "localEnd": [0, 0.87, 0], "contactType": "overlap", "baseRadius": 0.29, "endRadius": 0.19333333333333333, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_blouse_34 = makeAttachmentEndpoint(attachment_blouse_34);
  const node_blouse_34 = new THREE.Group();
  node_blouse_34.name = "blouse__pivot";
  node_blouse_34.scale.set(1, 1, 1);
  if (endpoint_blouse_34) {
    node_blouse_34.position.copy(endpoint_blouse_34.start);
    node_blouse_34.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_blouse_34.position.set(0.0, 0.0, 0.006);
    node_blouse_34.rotation.set(0.0, 0.0, 0.0);
  }
  node_blouse_34.userData.sculptComponent = {"id": "blouse", "name": "blouse", "level": "macro", "role": "shell", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Sleeveless fitted white blouse with waist cinch and two pointed front tails, cyan edge piping.", "geometryDescriptor": {"topologyIntent": "Sleeveless fitted white blouse with waist cinch and two pointed front tails, cyan edge piping.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[2.0, 0.29, 0.16], [2.18, 0.24, 0.145], [2.32, 0.18, 0.13], [2.53, 0.235, 0.155], [2.72, 0.25, 0.15]], "hemShape": "split front V notch; pointed lateral front panels", "centerlineSeam": true}}, "parent": "torso", "attachment": {"parentSocket": "torso-blouse", "localStart": [0, 0, 0], "localEnd": [0, 0.87, 0], "contactType": "overlap", "baseRadius": 0.29, "endRadius": 0.19333333333333333, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.58, "height": 0.87, "depth": 0.33, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0.006], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "blouse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "white-cloth"}}, "material": "white-cloth", "materialLayers": ["white-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "blouse-seams", "kind": "seam", "description": "Princess panel lines and split front hem", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 247, 250, 1)", "secondaryAlbedo": "rgba(244, 247, 250, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_blouse_34.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "blouse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "white-cloth"}};
  (nodes["torso"] ?? root).add(node_blouse_34);
  nodes["blouse"] = node_blouse_34;
  const mesh_blouse_34Geometry = endpoint_blouse_34
    ? new THREE.CylinderGeometry(endpoint_blouse_34.endRadius, endpoint_blouse_34.baseRadius, endpoint_blouse_34.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_blouse_34) {
    mesh_blouse_34Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_blouse_34 = new THREE.Mesh(
    mesh_blouse_34Geometry,
    materialMap["white-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_blouse_34.name = "blouse";
  if (endpoint_blouse_34) {
    mesh_blouse_34.position.copy(endpoint_blouse_34.midpoint);
    mesh_blouse_34.quaternion.copy(endpoint_blouse_34.quaternion);
  }
  mesh_blouse_34.castShadow = options.castShadow ?? true;
  mesh_blouse_34.receiveShadow = options.receiveShadow ?? true;
  mesh_blouse_34.userData.sculptComponent = {"id": "blouse", "name": "blouse", "level": "macro", "role": "shell", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Sleeveless fitted white blouse with waist cinch and two pointed front tails, cyan edge piping.", "geometryDescriptor": {"topologyIntent": "Sleeveless fitted white blouse with waist cinch and two pointed front tails, cyan edge piping.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"rings": [[2.0, 0.29, 0.16], [2.18, 0.24, 0.145], [2.32, 0.18, 0.13], [2.53, 0.235, 0.155], [2.72, 0.25, 0.15]], "hemShape": "split front V notch; pointed lateral front panels", "centerlineSeam": true}}, "parent": "torso", "attachment": {"parentSocket": "torso-blouse", "localStart": [0, 0, 0], "localEnd": [0, 0.87, 0], "contactType": "overlap", "baseRadius": 0.29, "endRadius": 0.19333333333333333, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.58, "height": 0.87, "depth": 0.33, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0.006], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "blouse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "white-cloth"}}, "material": "white-cloth", "materialLayers": ["white-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "blouse-seams", "kind": "seam", "description": "Princess panel lines and split front hem", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 247, 250, 1)", "secondaryAlbedo": "rgba(244, 247, 250, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_blouse_34.add(mesh_blouse_34);
  meshes["blouse"] = mesh_blouse_34;
  colliders["blouse"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["blouse"] ??= [];
  destructionGroups["blouse"].push(node_blouse_34);

  const endpoint_collar_35 = makeAttachmentEndpoint(null);
  const node_collar_35 = new THREE.Group();
  node_collar_35.name = "collar__pivot";
  node_collar_35.scale.set(1, 1, 1);
  if (endpoint_collar_35) {
    node_collar_35.position.copy(endpoint_collar_35.start);
    node_collar_35.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_collar_35.position.set(0.0, 0.28, 0.07);
    node_collar_35.rotation.set(0.0, 0.0, 0.0);
  }
  node_collar_35.userData.sculptComponent = {"id": "collar", "name": "collar", "level": "meso", "role": "shell", "importance": 0.8, "confidence": 0.85, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Two folded white collar leaves with cyan outline; neck gap retained.", "geometryDescriptor": {"topologyIntent": "Two folded white collar leaves with cyan outline; neck gap retained.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "blouse", "attachment": {"parentSocket": "blouse-collar", "localStart": [0, 0, 0], "localEnd": [0, 0.15, 0], "contactType": "overlap", "baseRadius": 0.11, "endRadius": 0.07333333333333333, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.22, "height": 0.15, "depth": 0.1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.28, 0.07], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "white-cloth"}}, "material": "white-cloth", "materialLayers": ["white-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "collar-piping", "kind": "linework", "description": "Cyan edge around folded white collar", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 247, 250, 1)", "secondaryAlbedo": "rgba(244, 247, 250, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_collar_35.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "white-cloth"}};
  (nodes["blouse"] ?? root).add(node_collar_35);
  nodes["collar"] = node_collar_35;
  const mesh_collar_35Geometry = endpoint_collar_35
    ? new THREE.CylinderGeometry(endpoint_collar_35.endRadius, endpoint_collar_35.baseRadius, endpoint_collar_35.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_collar_35) {
    mesh_collar_35Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_collar_35 = new THREE.Mesh(
    mesh_collar_35Geometry,
    materialMap["white-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_collar_35.name = "collar";
  if (endpoint_collar_35) {
    mesh_collar_35.position.copy(endpoint_collar_35.midpoint);
    mesh_collar_35.quaternion.copy(endpoint_collar_35.quaternion);
  }
  mesh_collar_35.castShadow = options.castShadow ?? true;
  mesh_collar_35.receiveShadow = options.receiveShadow ?? true;
  mesh_collar_35.userData.sculptComponent = {"id": "collar", "name": "collar", "level": "meso", "role": "shell", "importance": 0.8, "confidence": 0.85, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Two folded white collar leaves with cyan outline; neck gap retained.", "geometryDescriptor": {"topologyIntent": "Two folded white collar leaves with cyan outline; neck gap retained.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {}}, "parent": "blouse", "attachment": {"parentSocket": "blouse-collar", "localStart": [0, 0, 0], "localEnd": [0, 0.15, 0], "contactType": "overlap", "baseRadius": 0.11, "endRadius": 0.07333333333333333, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.22, "height": 0.15, "depth": 0.1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.28, 0.07], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "white-cloth"}}, "material": "white-cloth", "materialLayers": ["white-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "collar-piping", "kind": "linework", "description": "Cyan edge around folded white collar", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 247, 250, 1)", "secondaryAlbedo": "rgba(244, 247, 250, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_collar_35.add(mesh_collar_35);
  meshes["collar"] = mesh_collar_35;
  colliders["collar"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["collar"] ??= [];
  destructionGroups["collar"].push(node_collar_35);

  const endpoint_tie_36 = makeAttachmentEndpoint(null);
  const node_tie_36 = new THREE.Group();
  node_tie_36.name = "tie__pivot";
  node_tie_36.scale.set(1, 1, 1);
  if (endpoint_tie_36) {
    node_tie_36.position.copy(endpoint_tie_36.start);
    node_tie_36.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tie_36.position.set(0.0, 0.07, 0.175);
    node_tie_36.rotation.set(0.0, 0.0, 0.0);
  }
  node_tie_36.userData.sculptComponent = {"id": "tie", "name": "tie", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Cyan necktie hangs over white front with narrow knot, widening body and pointed tip.", "geometryDescriptor": {"topologyIntent": "Cyan necktie hangs over white front with narrow knot, widening body and pointed tip.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"profile": [[0, 0.28], [0.045, 0.2], [0.028, 0.12], [0.043, -0.2], [0, -0.28], [-0.043, -0.2], [-0.028, 0.12], [-0.045, 0.2]], "twoDarkClipsAtY": [-0.12, -0.16]}}, "parent": "blouse", "attachment": {"parentSocket": "blouse-tie", "localStart": [0, 0, 0], "localEnd": [0, 0.57, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.57, "depth": 0.025, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.07, 0.175], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tie", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cyan-trim"}}, "material": "cyan-trim", "materialLayers": ["cyan-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tie-clips", "kind": "linework", "description": "Two dark horizontal bars low on cyan tie", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(33, 183, 194, 1)", "secondaryAlbedo": "rgba(33, 183, 194, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_tie_36.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tie", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cyan-trim"}};
  (nodes["blouse"] ?? root).add(node_tie_36);
  nodes["tie"] = node_tie_36;
  const mesh_tie_36Geometry = endpoint_tie_36
    ? new THREE.CylinderGeometry(endpoint_tie_36.endRadius, endpoint_tie_36.baseRadius, endpoint_tie_36.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_tie_36) {
    mesh_tie_36Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tie_36 = new THREE.Mesh(
    mesh_tie_36Geometry,
    materialMap["cyan-trim"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tie_36.name = "tie";
  if (endpoint_tie_36) {
    mesh_tie_36.position.copy(endpoint_tie_36.midpoint);
    mesh_tie_36.quaternion.copy(endpoint_tie_36.quaternion);
  }
  mesh_tie_36.castShadow = options.castShadow ?? true;
  mesh_tie_36.receiveShadow = options.receiveShadow ?? true;
  mesh_tie_36.userData.sculptComponent = {"id": "tie", "name": "tie", "level": "meso", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Cyan necktie hangs over white front with narrow knot, widening body and pointed tip.", "geometryDescriptor": {"topologyIntent": "Cyan necktie hangs over white front with narrow knot, widening body and pointed tip.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"profile": [[0, 0.28], [0.045, 0.2], [0.028, 0.12], [0.043, -0.2], [0, -0.28], [-0.043, -0.2], [-0.028, 0.12], [-0.045, 0.2]], "twoDarkClipsAtY": [-0.12, -0.16]}}, "parent": "blouse", "attachment": {"parentSocket": "blouse-tie", "localStart": [0, 0, 0], "localEnd": [0, 0.57, 0], "contactType": "overlap", "baseRadius": 0.045, "endRadius": 0.03, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.09, "height": 0.57, "depth": 0.025, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.07, 0.175], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tie", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cyan-trim"}}, "material": "cyan-trim", "materialLayers": ["cyan-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tie-clips", "kind": "linework", "description": "Two dark horizontal bars low on cyan tie", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(33, 183, 194, 1)", "secondaryAlbedo": "rgba(33, 183, 194, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_tie_36.add(mesh_tie_36);
  meshes["tie"] = mesh_tie_36;
  colliders["tie"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tie"] ??= [];
  destructionGroups["tie"].push(node_tie_36);

  const attachment_skirt_37 = {"parentSocket": "root-skirt", "localStart": [0, 0, 0], "localEnd": [0, 0.41, 0], "contactType": "overlap", "baseRadius": 0.445, "endRadius": 0.2966666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_skirt_37 = makeAttachmentEndpoint(attachment_skirt_37);
  const node_skirt_37 = new THREE.Group();
  node_skirt_37.name = "skirt__pivot";
  node_skirt_37.scale.set(1, 1, 1);
  if (endpoint_skirt_37) {
    node_skirt_37.position.copy(endpoint_skirt_37.start);
    node_skirt_37.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_skirt_37.position.set(0.0, 1.85, 0.0);
    node_skirt_37.rotation.set(0.0, 0.0, 0.0);
  }
  node_skirt_37.userData.sculptComponent = {"id": "skirt", "name": "skirt", "level": "macro", "role": "shell", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Flared short pleated skirt, cyan hem rim, exposed thighs below; no pants block.", "geometryDescriptor": {"topologyIntent": "Flared short pleated skirt, cyan hem rim, exposed thighs below; no pants block.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"topY": 2.045, "bottomY": 1.66, "topRadii": [0.25, 0.16], "bottomRadii": [0.445, 0.25], "pleatCount": 18, "pleatAmplitude": 0.024, "hemBandHeight": 0.025}}, "parent": "root", "attachment": {"parentSocket": "root-skirt", "localStart": [0, 0, 0], "localEnd": [0, 0.41, 0], "contactType": "overlap", "baseRadius": 0.445, "endRadius": 0.2966666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.89, "height": 0.41, "depth": 0.5, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 1.85, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "skirt", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "skirt-pleats", "kind": "ridge", "description": "Repeated vertical pleat folds on flared skirt", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}, {"id": "skirt-cyan-hem", "kind": "linework", "description": "Cyan hem band follows pleats", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_skirt_37.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "skirt", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}};
  (nodes["root"] ?? root).add(node_skirt_37);
  nodes["skirt"] = node_skirt_37;
  const mesh_skirt_37Geometry = endpoint_skirt_37
    ? new THREE.CylinderGeometry(endpoint_skirt_37.endRadius, endpoint_skirt_37.baseRadius, endpoint_skirt_37.length, 16, 6)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_skirt_37) {
    mesh_skirt_37Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_skirt_37 = new THREE.Mesh(
    mesh_skirt_37Geometry,
    materialMap["dark-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_skirt_37.name = "skirt";
  if (endpoint_skirt_37) {
    mesh_skirt_37.position.copy(endpoint_skirt_37.midpoint);
    mesh_skirt_37.quaternion.copy(endpoint_skirt_37.quaternion);
  }
  mesh_skirt_37.castShadow = options.castShadow ?? true;
  mesh_skirt_37.receiveShadow = options.receiveShadow ?? true;
  mesh_skirt_37.userData.sculptComponent = {"id": "skirt", "name": "skirt", "level": "macro", "role": "shell", "importance": 0.95, "confidence": 0.85, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Flared short pleated skirt, cyan hem rim, exposed thighs below; no pants block.", "geometryDescriptor": {"topologyIntent": "Flared short pleated skirt, cyan hem rim, exposed thighs below; no pants block.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"topY": 2.045, "bottomY": 1.66, "topRadii": [0.25, 0.16], "bottomRadii": [0.445, 0.25], "pleatCount": 18, "pleatAmplitude": 0.024, "hemBandHeight": 0.025}}, "parent": "root", "attachment": {"parentSocket": "root-skirt", "localStart": [0, 0, 0], "localEnd": [0, 0.41, 0], "contactType": "overlap", "baseRadius": 0.445, "endRadius": 0.2966666666666667, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.89, "height": 0.41, "depth": 0.5, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 1.85, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "skirt", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "dark-cloth"}}, "material": "dark-cloth", "materialLayers": ["dark-cloth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "skirt-pleats", "kind": "ridge", "description": "Repeated vertical pleat folds on flared skirt", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}, {"id": "skirt-cyan-hem", "kind": "linework", "description": "Cyan hem band follows pleats", "evidenceRefs": ["front-outfit"], "implementation": "geometry or spatial-color region matching the named semantic surface; paired features mirror X only"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L4", "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 49, 62, 1)", "secondaryAlbedo": "rgba(48, 49, 62, 1)", "materialClass": "fabric", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_skirt_37.add(mesh_skirt_37);
  meshes["skirt"] = mesh_skirt_37;
  colliders["skirt"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["skirt"] ??= [];
  destructionGroups["skirt"].push(node_skirt_37);

  const attachment_mic_boom_38 = {"parentSocket": "head-mic-boom", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]};
  const endpoint_mic_boom_38 = makeAttachmentEndpoint(attachment_mic_boom_38);
  const node_mic_boom_38 = new THREE.Group();
  node_mic_boom_38.name = "mic-boom__pivot";
  node_mic_boom_38.scale.set(1, 1, 1);
  if (endpoint_mic_boom_38) {
    node_mic_boom_38.position.copy(endpoint_mic_boom_38.start);
    node_mic_boom_38.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_mic_boom_38.position.set(-0.23, -0.07, 0.08);
    node_mic_boom_38.rotation.set(0.0, 0.0, 0.0);
  }
  node_mic_boom_38.userData.sculptComponent = {"id": "mic-boom", "name": "mic-boom", "level": "micro", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "tube", "topologyClass": "fiber-strand", "topologyRationale": "Thin earphone microphone follows cheek and ends by mouth corner.", "geometryDescriptor": {"topologyIntent": "Thin earphone microphone follows cheek and ends by mouth corner.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.03, -0.08, 0.09], [0.115, -0.09, 0.11]], "radius": 0.006}}, "parent": "head", "attachment": {"parentSocket": "head-mic-boom", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.12, "depth": 0.1, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.23, -0.07, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "mic-boom", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_mic_boom_38.userData.actionProfile = {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "mic-boom", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}};
  (nodes["head"] ?? root).add(node_mic_boom_38);
  nodes["mic-boom"] = node_mic_boom_38;
  const mesh_mic_boom_38Geometry = endpoint_mic_boom_38
    ? new THREE.CylinderGeometry(endpoint_mic_boom_38.endRadius, endpoint_mic_boom_38.baseRadius, endpoint_mic_boom_38.length, 16, 6)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  if (!endpoint_mic_boom_38) {
    mesh_mic_boom_38Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_mic_boom_38 = new THREE.Mesh(
    mesh_mic_boom_38Geometry,
    materialMap["ink"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mic_boom_38.name = "mic-boom";
  if (endpoint_mic_boom_38) {
    mesh_mic_boom_38.position.copy(endpoint_mic_boom_38.midpoint);
    mesh_mic_boom_38.quaternion.copy(endpoint_mic_boom_38.quaternion);
  }
  mesh_mic_boom_38.castShadow = options.castShadow ?? true;
  mesh_mic_boom_38.receiveShadow = options.receiveShadow ?? true;
  mesh_mic_boom_38.userData.sculptComponent = {"id": "mic-boom", "name": "mic-boom", "level": "micro", "role": "accessory", "importance": 0.8, "confidence": 0.85, "primitive": "tube", "topologyClass": "fiber-strand", "topologyRationale": "Thin earphone microphone follows cheek and ends by mouth corner.", "geometryDescriptor": {"topologyIntent": "Thin earphone microphone follows cheek and ends by mouth corner.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated parametric surface coordinates", "normalStrategy": "smooth vertex normals", "construction": {"controlPoints": [[0, 0, 0], [0.03, -0.08, 0.09], [0.115, -0.09, 0.11]], "radius": 0.006}}, "parent": "head", "attachment": {"parentSocket": "head-mic-boom", "localStart": [0, 0, 0], "localEnd": [0, 0.12, 0], "contactType": "overlap", "baseRadius": 0.065, "endRadius": 0.043333333333333335, "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.13, "height": 0.12, "depth": 0.1, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.23, -0.07, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-preview-pivot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "mic-boom", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ink"}}, "material": "ink", "materialLayers": ["ink"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object", "front-outfit"], "details": [], "fidelityTier": "reference-stylized", "geometryLayer": "L3", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 56, 70, 1)", "secondaryAlbedo": "rgba(38, 56, 70, 1)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object", "front-outfit"]}};
  node_mic_boom_38.add(mesh_mic_boom_38);
  meshes["mic-boom"] = mesh_mic_boom_38;
  colliders["mic-boom"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["mic-boom"] ??= [];
  destructionGroups["mic-boom"].push(node_mic_boom_38);

  // standProud: hold these components outside the surfaces they cover.
  // SKIPPED scalp: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-0: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-1: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-2: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-3: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-4: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-5: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED bang-6: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED twintail-l: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of
  // SKIPPED twintail-r: standProud target 'head' (primitive 'curve-sweep') exposes no ring stack to stand proud of

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Source is a flat-shaded 2D illustration, not a measured material photograph; textureless base-color declarations are evidence-bearing, facial artwork projection is treated as albedo graphics, never as recovered PBR. Reference visual fidelity is reviewed in browser."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createHatsuneMikuLearningCompanionLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Hatsune Miku learning companion look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Key light: broad upper-left soft white at [-3,6,5], intensity tuned in browser against palette.", "Fill light: low-intensity neutral frontal fill [3,3,5], no ambient-only rendering.", "Rim light: restrained cyan-white rear fill [2,5,-4] to show tail volume.", "Exposure 1.0, neutral/ACES tone mapping chosen to preserve reference whites and teal; background neutral gray.", "Contact shadow on subtle ground disc; character itself must remain separable from review background."];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Source is a flat-shaded 2D illustration, not a measured material photograph; textureless base-color declarations are evidence-bearing, facial artwork projection is treated as albedo graphics, never as recovered PBR. Reference visual fidelity is reviewed in browser."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createHatsuneMikuLearningCompanionEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameHatsuneMikuLearningCompanionCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createHatsuneMikuLearningCompanionPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureHatsuneMikuLearningCompanionRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createHatsuneMikuLearningCompanionInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
