import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { modules, generateQuestions, gradeAnswer } from '../domain/content.mjs';

const moduleIds = modules.map((module) => module.id);
const chapterTwoIds = Array.from({ length: 14 }, (_, index) => `C2-${String(index + 1).padStart(2, '0')}`);
const releasedIds = [
  'N-NEG-COMP', 'A-LIKE-COMBINE', 'G-BISECTOR-CALC',
  ...Array.from({ length: 11 }, (_, index) => `C1-${String(index + 1).padStart(2, '0')}`),
  ...chapterTwoIds,
];

async function fixture(t) {
  const temporaryRoot = process.platform === 'win32' ? os.tmpdir() : '/tmp';
  const dataDir = await mkdtemp(path.join(temporaryRoot, 'interactive-math-api-'));
  let app;
  let url;
  async function start() {
    app = await createApp({ dataDir });
    ({ url } = await app.listen(0, '127.0.0.1'));
  }
  t.after(async () => {
    if (app) await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  await start();
  async function request(route, { method = 'GET', body, status = 200, headers = {} } = {}) {
    const response = await fetch(`${url}${route}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    assert.equal(response.status, status, `${method} ${route}: ${text}`);
    return {
      body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text,
      headers: response.headers,
    };
  }
  const get = async (route, status = 200) => (await request(route, { status })).body;
  const post = async (route, body, status = 200) => (await request(route, { method: 'POST', body, status })).body;
  const bootstrap = await get('/api/bootstrap');
  const profileId = bootstrap.profiles[0].id;
  const base = `/api/profiles/${profileId}`;
  return {
    dataDir, bootstrap, profileId, base, get, post, request,
    get url() { return url; },
    async stop() { await app.close(); },
    async reopen() { await app.close(); await start(); },
    async round(moduleId = moduleIds[0], otherProfileId = profileId) {
      const round = await post(`/api/profiles/${otherProfileId}/rounds`, { moduleId }, 201);
      const authored = generateQuestions(moduleId, round.id);
      assert.equal(round.questions.length, 5);
      assert.deepEqual(round.questions.map((question) => question.id), authored.map((question) => question.id));
      return { round, authored, route: `/api/profiles/${otherProfileId}/rounds/${round.id}` };
    },
  };
}

function correctAnswer(question) {
  return { value: String(question.expected.value), ...(question.expected.step === undefined ? {} : { step: String(question.expected.step) }) };
}

function wrongAnswer(question) {
  const correct = correctAnswer(question);
  const candidates = question.input.options?.map((option) => String(option.value)) || ['0', '1', '-1', '999999'];
  for (const value of candidates) {
    const answer = { ...correct, value };
    const result = gradeAnswer(question, answer);
    if (result.valid && !result.correct) return answer;
  }
  throw new Error(`没有为题目 ${question.id} 找到可判分的错误答案。`);
}

function questionRoute(context, index) {
  return `${context.route}/questions/${context.round.questions[index].id}`;
}

function assertNoAnswerLeak(round) {
  for (const question of round.questions) {
    for (const key of ['expected', 'hint', 'solution', 'answerDisplay']) assert.equal(Object.hasOwn(question, key), false, `${key} leaked before help`);
    assert.equal(Object.hasOwn(question.state, 'requests'), false);
  }
}

test('bootstrap exposes all twenty-eight released modules including twelve chapter-1 and fourteen chapter-2 goals, six chapters and a saved default profile', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.bootstrap.modules.map((module) => module.id).sort(), [...releasedIds].sort());
  assert.equal(f.bootstrap.modules.filter((module) => module.chapter === 1).length, 12);
  assert.equal(f.bootstrap.modules.filter((module) => module.chapter === 2).length, 14);
  assert.equal(f.bootstrap.chapters.length, 6);
  assert.equal(f.bootstrap.chapters.find((chapter) => chapter.number === 2).count, 25);
  assert.equal(f.bootstrap.profiles[0].name, '我的学习');
  assert.ok(f.bootstrap.version);
  assert.equal(f.bootstrap.connection.localUrl, f.url);
  assert.ok(Array.isArray(f.bootstrap.connection.lanUrls));
  assert.ok(f.bootstrap.connection.qrUrl.startsWith('/api/qr.svg?url='));
  const firstId = f.profileId;
  await f.reopen();
  assert.equal((await f.get('/api/bootstrap')).profiles[0].id, firstId);
});

test('every released module creates 3 basic and 2 variation questions, protects answers and follows the full 4-of-5 scoring flow', async (t) => {
  const f = await fixture(t);
  for (const moduleId of moduleIds) {
    const context = await f.round(moduleId);
    assert.equal(context.round.questions.filter((question) => question.difficulty === 'basic').length, 3);
    assert.equal(context.round.questions.filter((question) => question.difficulty === 'variation').length, 2);
    assertNoAnswerLeak(context.round);
    assert.deepEqual(context.round.summary, { completed: 0, total: 5, independentCorrect: 0, passed: false, finished: false });
    let result;
    for (let index = 0; index < 4; index += 1) {
      result = await f.post(`${questionRoute(context, index)}/submit`, {
        answer: correctAnswer(context.authored[index]), requestId: `valid-${moduleId}-${index}`,
      });
      assert.equal(result.correct, true, `${moduleId} question ${index + 1}`);
      assert.equal(result.round.questions[index].state.independentCorrect, true);
    }
    assert.equal(result.round.summary.independentCorrect, 4);
    assert.equal(result.round.summary.finished, false);
    assert.equal(result.round.summary.passed, false);
    await f.post(`${questionRoute(context, 4)}/hint`, {});
    result = await f.post(`${questionRoute(context, 4)}/submit`, {
      answer: correctAnswer(context.authored[4]), requestId: `hinted-${moduleId}`,
    });
    assert.equal(result.correct, true);
    assert.equal(result.round.questions[4].state.completion, 'hint');
    assert.deepEqual(result.round.summary, { completed: 5, total: 5, independentCorrect: 4, passed: true, finished: true });
  }
});

test('all fourteen chapter-2 modules validate required steps, retain first errors, allow hint retries and preserve review history after restart', async (t) => {
  const f = await fixture(t);
  const completedRounds = [];
  for (const moduleId of chapterTwoIds) {
    const context = await f.round(moduleId);
    const stepIndex = context.authored.findIndex((question) => question.step);
    assert.ok(stepIndex >= 0, `${moduleId} needs a structured-step exercise`);
    const question = context.authored[stepIndex];
    const endpoint = `${questionRoute(context, stepIndex)}/submit`;
    const answer = correctAnswer(question);
    const missingStep = await f.post(endpoint, { answer: { value: answer.value }, requestId: `missing-step-${moduleId}` });
    assert.equal(missingStep.valid, false);
    assert.equal(missingStep.round.questions[stepIndex].state.attemptCount, 0);
    assert.equal(missingStep.round.questions[stepIndex].state.firstAnswer, null);

    const wrongStep = question.step.options.find((option) => String(option.value) !== answer.step);
    assert.ok(wrongStep, `${moduleId} needs an alternative step`);
    const firstAnswer = { ...answer, step: String(wrongStep.value) };
    const first = await f.post(endpoint, { answer: firstAnswer, requestId: `wrong-step-${moduleId}` });
    assert.equal(first.valid, true);
    assert.equal(first.correct, false, `${moduleId} must check the step even when the final value is correct`);
    assert.equal(first.round.questions[stepIndex].state.firstCorrect, false);
    const hint = await f.post(`${questionRoute(context, stepIndex)}/hint`, {});
    assert.equal(hint.hint, question.hint);
    const retry = await f.post(endpoint, { answer, requestId: `step-retry-${moduleId}` });
    assert.equal(retry.correct, true);
    assert.equal(retry.round.questions[stepIndex].state.attemptCount, 2);
    assert.deepEqual(retry.round.questions[stepIndex].state.firstAnswer, firstAnswer);
    assert.equal(retry.round.questions[stepIndex].state.independentCorrect, false);
    assert.equal(retry.round.questions[stepIndex].state.completion, 'hint');

    let finished = retry;
    for (const [index, otherQuestion] of context.authored.entries()) {
      if (index === stepIndex) continue;
      finished = await f.post(`${questionRoute(context, index)}/submit`, {
        answer: correctAnswer(otherQuestion), requestId: `chapter-two-independent-${moduleId}-${index}`,
      });
      assert.equal(finished.correct, true);
    }
    assert.deepEqual(finished.round.summary, { completed: 5, total: 5, independentCorrect: 4, passed: true, finished: true });
    const profile = await f.get(f.base);
    const mistake = profile.mistakes.find((item) => item.roundId === context.round.id);
    assert.ok(mistake);
    assert.deepEqual(mistake.firstAnswer, firstAnswer);
    assert.equal(mistake.usedHint, true);
    assert.equal(mistake.corrected, true);
    const solution = await f.post(`${questionRoute(context, stepIndex)}/solution`, {});
    assert.deepEqual(solution.solution, question.solution);
    assert.equal(solution.answerDisplay, question.answerDisplay);
    assert.equal(solution.round.summary.independentCorrect, 4);

    const reviewRoute = `${f.base}/mistakes/${mistake.id}/review`;
    const reviewBody = { answer, requestId: `chapter-two-review-${moduleId}` };
    const review = await f.post(reviewRoute, reviewBody);
    assert.equal(review.correct, true);
    assert.equal(review.mistake.reviewAttempts.length, 1);
    const replay = await f.post(reviewRoute, reviewBody);
    assert.equal(replay.mistake.reviewAttempts.length, 1);
    assert.deepEqual(await f.get(context.route), solution.round, 'review must preserve the original round and its score');
    completedRounds.push(solution.round);
  }
  const beforeRestart = await f.get(f.base);
  assert.equal(beforeRestart.mistakes.length, chapterTwoIds.length);
  assert.deepEqual(beforeRestart.rounds, completedRounds);
  await f.reopen();
  assert.deepEqual(await f.get(f.base), beforeRestart);
});

test('unparseable and empty inputs do not consume a first attempt', async (t) => {
  const f = await fixture(t);
  const context = await f.round('G-BISECTOR-CALC');
  for (const value of ['', '不是数字', '1/0']) {
    const result = await f.post(`${questionRoute(context, 0)}/submit`, {
      answer: { ...correctAnswer(context.authored[0]), value }, requestId: `invalid-${value}`,
    });
    assert.equal(result.valid, false);
    assert.equal(result.round.questions[0].state.attemptCount, 0);
    assert.equal(result.round.questions[0].state.firstAnswer, null);
  }
  const result = await f.post(`${questionRoute(context, 0)}/submit`, { answer: correctAnswer(context.authored[0]), requestId: 'first-valid' });
  assert.equal(result.round.summary.independentCorrect, 1);
  assert.equal((await f.get(f.base)).mistakes.length, 0);
});

test('a wrong first answer remains wrong for scoring after a successful retry and retains the mistake', async (t) => {
  const f = await fixture(t);
  const context = await f.round('A-LIKE-COMBINE');
  const wrong = wrongAnswer(context.authored[0]);
  const first = await f.post(`${questionRoute(context, 0)}/submit`, { answer: wrong, requestId: 'wrong-first' });
  assert.equal(first.correct, false);
  assert.equal(first.round.questions[0].state.firstCorrect, false);
  const retry = await f.post(`${questionRoute(context, 0)}/submit`, { answer: correctAnswer(context.authored[0]), requestId: 'correct-retry' });
  assert.equal(retry.correct, true);
  assert.equal(retry.round.summary.independentCorrect, 0);
  assert.equal(retry.round.questions[0].state.attemptCount, 2);
  assert.equal(retry.round.questions[0].state.completion, 'retry');
  assert.deepEqual(retry.round.questions[0].state.firstAnswer, wrong);
  const profile = await f.get(f.base);
  assert.equal(profile.mistakes.length, 1);
  assert.equal(profile.mistakes[0].corrected, true);
  assert.deepEqual(profile.mistakes[0].firstAnswer, wrong);
  assert.equal(Object.hasOwn(profile.mistakes[0].question, 'expected'), false);
  assert.equal(Object.hasOwn(profile.mistakes[0], 'requests'), false);
});

test('help before first submission prevents independent credit; help after success does not change prior credit', async (t) => {
  const f = await fixture(t);
  const context = await f.round();
  const hint = await f.post(`${questionRoute(context, 0)}/hint`, {});
  assert.equal(typeof hint.hint, 'string');
  const hinted = await f.post(`${questionRoute(context, 0)}/submit`, { answer: correctAnswer(context.authored[0]), requestId: 'hint-before' });
  assert.equal(hinted.round.questions[0].state.independentCorrect, false);
  assert.equal(hinted.round.questions[0].state.completion, 'hint');

  const solution = await f.post(`${questionRoute(context, 1)}/solution`, {});
  assert.ok(solution.solution.length > 0);
  assert.ok(solution.answerDisplay);
  assert.equal(solution.round.questions[1].state.completed, true);
  assert.equal(solution.round.questions[1].state.completion, 'solution');
  const solved = await f.post(`${questionRoute(context, 1)}/submit`, { answer: correctAnswer(context.authored[1]), requestId: 'solution-before' });
  assert.equal(solved.round.questions[1].state.independentCorrect, false);

  const independent = await f.post(`${questionRoute(context, 2)}/submit`, { answer: correctAnswer(context.authored[2]), requestId: 'correct-before-help' });
  assert.equal(independent.round.summary.independentCorrect, 1);
  const after = await f.post(`${questionRoute(context, 2)}/solution`, {});
  assert.equal(after.round.summary.independentCorrect, 1);
  assert.equal(after.round.questions[2].state.completion, 'independent');
});

test('a round passes only when all five finish and at least four were independently correct', async (t) => {
  const f = await fixture(t);
  const context = await f.round();
  let result;
  for (let index = 0; index < 4; index += 1) {
    result = await f.post(`${questionRoute(context, index)}/submit`, { answer: correctAnswer(context.authored[index]), requestId: `independent-${index}` });
  }
  assert.equal(result.round.summary.independentCorrect, 4);
  assert.equal(result.round.summary.finished, false);
  assert.equal(result.round.summary.passed, false);
  const finished = await f.post(`${questionRoute(context, 4)}/solution`, {});
  assert.deepEqual(finished.round.summary, { completed: 5, total: 5, independentCorrect: 4, passed: true, finished: true });

  const second = await f.round();
  for (let index = 0; index < 5; index += 1) {
    result = index < 3
      ? await f.post(`${questionRoute(second, index)}/submit`, { answer: correctAnswer(second.authored[index]), requestId: `second-${index}` })
      : await f.post(`${questionRoute(second, index)}/solution`, {});
  }
  assert.equal(result.round.summary.finished, true);
  assert.equal(result.round.summary.independentCorrect, 3);
  assert.equal(result.round.summary.passed, false);
  assert.notEqual(second.round.id, context.round.id);
});

test('duplicate request ids are idempotent, including simultaneous requests, and cannot change the saved answer', async (t) => {
  const f = await fixture(t);
  const context = await f.round();
  const endpoint = `${questionRoute(context, 0)}/submit`;
  const body = { answer: wrongAnswer(context.authored[0]), requestId: 'same-action' };
  const responses = await Promise.all([f.post(endpoint, body), f.post(endpoint, body)]);
  for (const result of responses) assert.equal(result.round.questions[0].state.attemptCount, 1);
  assert.equal((await f.get(f.base)).mistakes.length, 1);
  const conflict = await f.post(endpoint, { answer: correctAnswer(context.authored[0]), requestId: 'same-action' }, 409);
  assert.ok(conflict.error);
  const saved = await f.get(context.route);
  assert.equal(saved.questions[0].state.attemptCount, 1);
  assert.equal(saved.questions[0].state.firstCorrect, false);
});

test('original-question review records corrections without changing the original round or creating a new round', async (t) => {
  const f = await fixture(t);
  const context = await f.round('G-BISECTOR-CALC');
  await f.post(`${questionRoute(context, 0)}/submit`, { answer: wrongAnswer(context.authored[0]), requestId: 'review-source' });
  const before = await f.get(f.base);
  const mistake = before.mistakes[0];
  const body = { answer: correctAnswer(context.authored[0]), requestId: 'review-correction' };
  const endpoint = `${f.base}/mistakes/${mistake.id}/review`;
  const review = await f.post(endpoint, body);
  assert.equal(review.correct, true);
  assert.equal(review.mistake.corrected, true);
  assert.equal(review.mistake.reviewAttempts.length, 1);
  const duplicate = await f.post(endpoint, body);
  assert.equal(duplicate.mistake.reviewAttempts.length, 1);
  const after = await f.get(f.base);
  assert.deepEqual(after.rounds, before.rounds);
  assert.equal(after.mistakes.length, 1);
  assert.equal(after.mistakes[0].corrected, true);
  const relapse = await f.post(endpoint, { answer: wrongAnswer(context.authored[0]), requestId: 'review-later-wrong' });
  assert.equal(relapse.correct, false);
  assert.equal(relapse.mistake.corrected, false);
  assert.equal(relapse.mistake.reviewAttempts.length, 2);
  const afterRelapse = await f.get(f.base);
  assert.deepEqual(afterRelapse.rounds, before.rounds);
  assert.equal(afterRelapse.mistakes[0].corrected, false);
});

test('profile switching isolates progress, rounds and mistakes and cannot access another profile round', async (t) => {
  const f = await fixture(t);
  const second = await f.post('/api/profiles', { name: '小同学 二' }, 201);
  await f.post(`${f.base}/progress`, { moduleId: moduleIds[0], mode: 'learn', step: 2 });
  const context = await f.round();
  await f.post(`${questionRoute(context, 0)}/submit`, { answer: wrongAnswer(context.authored[0]), requestId: 'profile-first' });
  const untouched = await f.get(`/api/profiles/${second.id}`);
  assert.deepEqual(untouched.progress, {});
  assert.deepEqual(untouched.rounds, []);
  assert.deepEqual(untouched.mistakes, []);
  await f.get(`/api/profiles/${second.id}/rounds/${context.round.id}`, 404);
  await f.post(`/api/profiles/${second.id}/rounds/${context.round.id}/questions/${context.round.questions[0].id}/submit`, { answer: correctAnswer(context.authored[0]), requestId: 'cross-profile' }, 404);
  const first = await f.get(f.base);
  assert.equal(first.mistakes.length, 1);
  assert.equal(first.rounds.length, 1);
});

test('saved records, first-answer scoring and request-id deduplication survive server reopen', async (t) => {
  const f = await fixture(t);
  await f.post(`${f.base}/progress`, { moduleId: 'A-LIKE-COMBINE', mode: 'learn', step: 2 });
  const context = await f.round('A-LIKE-COMBINE');
  const firstBody = { answer: wrongAnswer(context.authored[0]), requestId: 'persistent-first' };
  await f.post(`${questionRoute(context, 0)}/submit`, firstBody);
  const before = await f.get(f.base);
  await f.reopen();
  assert.deepEqual(await f.get(f.base), before);
  const repeated = await f.post(`${questionRoute(context, 0)}/submit`, firstBody);
  assert.equal(repeated.round.questions[0].state.attemptCount, 1);
  await f.post(`${questionRoute(context, 0)}/submit`, { answer: correctAnswer(context.authored[0]), requestId: 'persistent-retry' });
  assert.equal((await f.get(context.route)).summary.independentCorrect, 0);
  for (const file of ['learning.json', 'learning.json.bak']) {
    const data = JSON.parse(await readFile(path.join(f.dataDir, file), 'utf8'));
    assert.equal(data.schemaVersion, 1);
    assert.ok(data.profiles.some((profile) => profile.id === f.profileId));
  }
  assert.equal((await readdir(f.dataDir)).some((name) => name.includes('.tmp-')), false);
});

test('progress for all released modules survives concurrent writes and server reopen', async (t) => {
  const f = await fixture(t);
  const expected = modules.map((module, index) => ({ moduleId: module.id, mode: 'learn', step: index % module.learningSteps.length }));
  await Promise.all(expected.map((progress) => f.post(`${f.base}/progress`, progress)));
  await f.reopen();
  const profile = await f.get(f.base);
  assert.equal(Object.keys(profile.progress).length, moduleIds.length);
  for (const { moduleId, mode, step } of expected) {
    assert.equal(profile.progress[moduleId].mode, mode);
    assert.equal(profile.progress[moduleId].step, step);
    assert.ok(profile.progress[moduleId].updatedAt);
  }
});

test('a damaged main record recovers from backup and the next save preserves valid main and backup files', async (t) => {
  const f = await fixture(t);
  const context = await f.round();
  await f.post(`${questionRoute(context, 0)}/submit`, { answer: wrongAnswer(context.authored[0]), requestId: 'recover-first' });
  const expectedRound = await f.get(context.route);
  // One further successful save ensures the backup contains the round and answer.
  await f.post(`${f.base}/progress`, { moduleId: moduleIds[1], mode: 'learn', step: 1 });
  const backupBefore = JSON.parse(await readFile(path.join(f.dataDir, 'learning.json.bak'), 'utf8'));
  assert.equal(backupBefore.profiles[0].rounds[0].states[context.authored[0].id].attemptCount, 1);
  await f.stop();
  await writeFile(path.join(f.dataDir, 'learning.json'), '{ damaged record');
  await f.reopen();
  assert.deepEqual(await f.get(context.route), expectedRound);
  await f.post(`${f.base}/progress`, { moduleId: moduleIds[1], mode: 'learn', step: 2 });
  for (const file of ['learning.json', 'learning.json.bak']) {
    const data = JSON.parse(await readFile(path.join(f.dataDir, file), 'utf8'));
    assert.equal(data.profiles[0].id, f.profileId);
    assert.equal(data.profiles[0].rounds[0].states[context.authored[0].id].attemptCount, 1);
  }
});

test('local static assets and QR are available without external resources while source, textbook and records are inaccessible', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.dataDir, 'private-test.txt'), 'PRIVATE_LEARNING_RECORD');
  const index = await f.request('/');
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(index.body, /<html/i);
  const assetTags = index.body.match(/<(?:script|link|img)\b[^>]*>/gi) || [];
  const urls = assetTags.map((tag) => tag.match(/(?:src|href)=["']([^"']+)["']/i)?.[1]).filter(Boolean);
  for (const assetUrl of urls) {
    assert.equal(/^(?:https?:)?\/\//i.test(assetUrl), false, `external startup asset: ${assetUrl}`);
    if (assetUrl.startsWith('data:')) continue;
    const result = await f.request(new URL(assetUrl, `${f.url}/`).pathname);
    if (/\.(?:css|js)(?:\?|$)/.test(assetUrl)) {
      assert.doesNotMatch(result.body, /(?:@import\s+(?:url\()?\s*["']?https?:|import\s*\(?\s*["']https?:)/i);
    }
  }
  const qr = await f.request(f.bootstrap.connection.qrUrl);
  assert.match(qr.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(qr.body, /<svg\b/);
  assert.ok((qr.body.match(/h1v1h-1z/g) || []).length > 100, 'QR must contain an actual module matrix');
  assert.doesNotMatch(qr.body, /https?:\/\/(?!www\.w3\.org)/);
  await f.get('/api/qr.svg?url=https%3A%2F%2Fexample.com', 400);

  const textbook = encodeURIComponent('（根据2022年版课程标准修订）义务教育教科书·数学七年级上册--540ac93d.pdf');
  for (const route of [
    '/server.mjs', '/domain/content.mjs', '/vendor/qrcode.cjs', '/docs/requirements.md',
    '/learning.json', '/data/learning.json', '/private-test.txt', '/.git/config',
    `/textbooks/${textbook}`, '/%2e%2e%2fserver.mjs', '/%2e%2e%2fdata%2flearning.json',
  ]) {
    const result = await f.get(route, 404);
    assert.equal(typeof result.error, 'string');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_LEARNING_RECORD|schemaVersion/);
  }
  assert.ok((await f.get('/api/does-not-exist', 404)).error);
});
