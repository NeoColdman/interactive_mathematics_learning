import { GLTFLoader } from '/vendor/three/GLTFLoader.js';

// Direct use of the user-supplied asset. Original geometry and materials are retained.
export async function loadMikuGLB(THREE, { onProgress, assetUrl = '/companion/hatsune_miku_v6.glb', preserveNodeNames = false } = {}) {
  const loader = new GLTFLoader();
  // Embedded blob URLs are disallowed by the app's existing resource policy.
  // Use extracted, local copies of the same image slots, capped at 2048 for preview.
  loader.register(parser => ({
    name: 'LocalPreviewTextures',
    beforeRoot() {
      parser.json.images.forEach((image, index) => {
        image.uri = `textures/${index}.png`;
        delete image.bufferView;
      });
    }
  }));
  // Drain the native response directly. The intermediate progress stream in
  // FileLoader produced a request-cancel observation despite a complete model.
  onProgress?.(0);
  const response = await fetch(assetUrl);
  if (!response.ok) throw new Error(`人物文件读取失败（${response.status}）。`);
  const buffer = await response.arrayBuffer();
  onProgress?.(.9);
  const resourcePath = assetUrl.slice(0, assetUrl.lastIndexOf('/') + 1);
  const gltf = await loader.parseAsync(buffer, resourcePath);
  onProgress?.(1);
  const root = new THREE.Group();
  root.name = 'miku-imported-glb';
  const placement = new THREE.Group();
  placement.name = 'asset-placement';
  placement.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const originalBounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = originalBounds.getSize(new THREE.Vector3());
  const center = originalBounds.getCenter(new THREE.Vector3());
  if (originalBounds.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) {
    throw new Error('模型没有有效的可显示几何。');
  }
  const scale = 3.4 / size.y;
  placement.scale.setScalar(scale);
  placement.position.set(-center.x * scale, -originalBounds.min.y * scale, -center.z * scale);
  root.add(placement);
  let meshCount = 0, triangles = 0, skinnedMeshes = 0, morphMeshes = 0;
  const materials = new Set();
  const textures = new Set();
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    meshCount++;
    if (object.isSkinnedMesh) skinnedMeshes++;
    if (object.morphTargetInfluences?.length) morphMeshes++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
    object.userData.sourceNodeName = object.name;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      if (material.name === 'head27') {
        object.userData.semanticPart = 'head';
        if (!preserveNodeNames) object.name = 'head';
      }
    }
  });
  if (textures.size !== 13 || [...textures].some(texture => !texture.image?.width)) {
    throw new Error('模型贴图未完整加载，请保持本地服务运行后重试。');
  }
  root.userData = {
    sourceKind: 'imported-glb',
    sourcePath: '3D/hatsune_miku_v6.glb',
    runtimeAsset: assetUrl,
    sourceSha256: '19f9f7e48e8224e961c9b6dc870fe8c5585be3de6903ce505c45919dc17e5287',
    normalizedHeight: 3.4,
    previewTextureLimit: 2048,
    originalBounds: { min: originalBounds.min.toArray(), max: originalBounds.max.toArray() },
    inventory: { meshCount, triangles, materialCount: materials.size, textureCount: textures.size,
      skinnedMeshes, morphMeshes, animationClips: gltf.animations.length },
    animationStatus: skinnedMeshes ? 'not-evaluated' : 'no-skin-or-animation-in-source',
    attribution: { title: 'Hatsune Miku V6', author: 'not_here01-39', license: 'CC BY 4.0',
      source: 'https://sketchfab.com/3d-models/hatsune-miku-v6-14c9c7a0348842d79973bd1c9da29bb4' }
  };
  root.animations = gltf.animations;
  root.updateMatrixWorld(true);
  return root;
}
