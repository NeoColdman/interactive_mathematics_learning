import { loadMikuGLB } from './load-miku-glb.js';

const STATES = ['idle', 'wave', 'encourage', 'correct', 'retry', 'thinking', 'celebrate'];

export async function loadAnimatedMiku(THREE, options = {}) {
  const model = await loadMikuGLB(THREE, { ...options,
    assetUrl: '/companion/hatsune_miku_v6-animated.glb', preserveNodeNames: true });
  const bones = [], morphMeshes = [], skeletons = new Set();
  model.traverse(object => {
    if (object.isBone) bones.push(object);
    if (object.isSkinnedMesh) {
      skeletons.add(object.skeleton);
      // Motion bounds differ from the rest pose. Never cull a raised hand using rest bounds.
      object.frustumCulled = false;
    }
    if (object.morphTargetInfluences?.length) morphMeshes.push(object);
  });
  if (bones.length !== 27 || !model.animations?.length || !morphMeshes.length) {
    throw new Error('人物的骨骼、表情或动作数据不完整。');
  }
  const rest = bones.map(bone => ({ bone, position: bone.position.clone(),
    quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
  const clips = new Map(model.animations.map(clip => [clip.name, clip]));
  for (const name of STATES) if (!clips.has(name)) throw new Error(`缺少人物动作：${name}`);
  const bindings = new Map();
  for (const clip of model.animations) {
    bindings.set(clip.name, clip.tracks.map(track => {
      const binding = new THREE.PropertyBinding(model, track.name);
      binding.bind();
      if (!binding.node) throw new Error(`动作无法连接人物部位：${track.name}`);
      return { name: track.name, binding, interpolant: track.createInterpolant() };
    }));
  }
  let state = 'rest', time = 0, playing = false, reducedMotion = false;
  let tickCount = 0, updateCount = 0, transitionTime = 0, transitionDuration = .24;
  let snapshot = null;
  const listeners = new Set();

  function synchronize() {
    model.updateMatrixWorld(true);
    for (const skeleton of skeletons) skeleton.update();
  }

  function capturePose() {
    return { bones: bones.map(bone => bone.quaternion.clone()),
      morphs: morphMeshes.map(mesh => [...mesh.morphTargetInfluences]) };
  }

  function emit(reason) {
    const event = { reason, state, playing, reducedMotion };
    for (const listener of listeners) listener(event);
  }

  function apply(name, at, blend = 1) {
    for (const entry of bindings.get(name)) entry.binding.setValue(entry.interpolant.evaluate(at), 0);
    if (snapshot && blend < 1) {
      const eased = blend ** 3 * (10 - 15 * blend + 6 * blend * blend);
      bones.forEach((bone, i) => {
        const target = bone.quaternion.clone();
        bone.quaternion.slerpQuaternions(snapshot.bones[i], target, eased);
      });
      morphMeshes.forEach((mesh, i) => mesh.morphTargetInfluences.forEach((value, j) => {
        mesh.morphTargetInfluences[j] = THREE.MathUtils.lerp(snapshot.morphs[i][j], value, eased);
      }));
    } else snapshot = null;
    synchronize();
  }

  function restore() {
    for (const entry of rest) {
      entry.bone.position.copy(entry.position);
      entry.bone.quaternion.copy(entry.quaternion);
      entry.bone.scale.copy(entry.scale);
    }
    for (const mesh of morphMeshes) mesh.morphTargetInfluences.fill(0);
    snapshot = null;
    state = 'rest'; time = 0; playing = false; transitionTime = 0;
    synchronize();
  }

  const controller = {
    play(name) {
      if (!clips.has(name)) throw new Error(`未知人物动作：${name}`);
      if (reducedMotion) { restore(); emit('reduced-motion'); return; }
      snapshot = capturePose();
      state = name; time = 0; playing = true; transitionTime = 0;
      apply(state, 0, 0);
      emit('play');
    },
    update(delta) {
      updateCount++;
      if (!playing || reducedMotion || state === 'rest') return;
      if (!Number.isFinite(delta) || delta < 0) throw new Error('动作时间无效。');
      tickCount++;
      time += Math.min(delta, .1);
      transitionTime = Math.min(transitionDuration, transitionTime + Math.min(delta, .1));
      const clip = clips.get(state);
      if (state === 'idle') time %= clip.duration;
      else if (time >= clip.duration) {
        apply(state, clip.duration, 1);
        snapshot = capturePose();
        state = 'idle'; time = 0; transitionTime = 0;
        apply(state, 0, 0);
        emit('auto-return');
        return;
      }
      apply(state, time, transitionTime / transitionDuration);
    },
    pause() { if (!playing) return; playing = false; emit('pause'); },
    resume() {
      if (reducedMotion || playing || state === 'rest') return;
      playing = true; emit('resume');
    },
    reset() { restore(); emit('reset'); },
    setReducedMotion(value) {
      const next = Boolean(value);
      if (next === reducedMotion) return;
      reducedMotion = next;
      if (next) restore();
      emit('reduced-motion');
    },
    sample(name, seconds) {
      if (!clips.has(name) || !Number.isFinite(seconds)) throw new Error('动作采样参数无效。');
      state = name; time = Math.max(0, Math.min(seconds, clips.get(name).duration));
      playing = false; transitionTime = transitionDuration; snapshot = null;
      apply(name, time, 1);
      emit('sample');
      return controller.getDiagnostics();
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getDiagnostics() {
      return { state, currentTime: time, duration: clips.get(state)?.duration || 0,
        playing, reducedMotion, tickCount, updateCount,
        transitionProgress: snapshot ? transitionTime / transitionDuration : 1,
        boneCount: bones.length, skeletonCount: skeletons.size, skinnedMeshes: model.userData.inventory.skinnedMeshes,
        morphMeshes: morphMeshes.length,
        clips: [...clips.values()].map(clip => ({ name: clip.name, duration: clip.duration,
          tracks: clip.tracks.length, loopCapable: true, playbackLoops: clip.name === 'idle' })),
        bindingCount: [...bindings.values()].reduce((sum, entries) => sum + entries.length, 0),
        morphs: morphMeshes.map(mesh => ({ name: mesh.name, channels: { ...mesh.morphTargetDictionary },
          weights: [...mesh.morphTargetInfluences] })) };
    }
  };
  model.userData.sourceKind = 'derived-rigged-glb';
  model.userData.animationStatus = 'authored-motion-sample-awaiting-user-review';
  model.userData.geometrySource = 'original GLB vertex/index data unchanged; skin and morph attributes added';
  restore();
  return { model, controller };
}
