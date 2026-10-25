import { createServer } from 'node:http';
import { readFile, mkdir, open, rename, copyFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import qrcode from './vendor/qrcode.cjs';
import { modules, generateQuestions, gradeAnswer, publicQuestion } from './domain/content.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const VERSION = '0.5.0';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2' };
const chapterNames = ['有理数', '有理数的运算', '代数式', '整式的加减', '一元一次方程', '几何图形初步'];
const chapterCounts = [12, 25, 18, 17, 35, 44];
const now = () => new Date().toISOString();
const clone = value => structuredClone(value);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireValue = (condition, status, message) => { if (!condition) throw new HttpError(status, message); };
const knownModule = id => modules.some(module => module.id === id);

export function defaultDataDir() {
  if (process.env.MATH_DATA_DIR) return path.resolve(process.env.MATH_DATA_DIR);
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'InteractiveMathLearning');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'InteractiveMathLearning');
  return path.join(os.homedir(), '.interactive-math-learning');
}

function freshProfile(name) { return { id: randomUUID(), name, createdAt: now(), progress: {}, rounds: [], mistakes: [] }; }
function profileMeta(profile) { return { id: profile.id, name: profile.name, createdAt: profile.createdAt }; }
function newState() {
  return { attemptCount: 0, firstAnswer: null, firstCorrect: false, independentCorrect: false, usedHint: false, viewedSolution: false, completed: false, latestCorrect: false, completion: null, lastAnswer: null, feedback: '', requests: {} };
}
function visibleState(state, question) {
  const { requests, ...rest } = state;
  const result = clone(rest);
  if (state.usedHint) result.hint = question.hint;
  if (state.viewedSolution) { result.solution = question.solution; result.answerDisplay = question.answerDisplay; }
  return result;
}
function visibleRound(round) {
  const questions = round.questions.map(question => ({ ...publicQuestion(question), state: visibleState(round.states[question.id], question) }));
  const completed = questions.filter(question => question.state.completed).length;
  const independentCorrect = questions.filter(question => question.state.independentCorrect).length;
  return { id: round.id, moduleId: round.moduleId, createdAt: round.createdAt, questions, summary: { completed, total: 5, independentCorrect, passed: completed === 5 && independentCorrect >= 4, finished: completed === 5 } };
}
function visibleMistake(mistake) {
  const { question, requests, ...rest } = mistake;
  return { ...clone(rest), question: publicQuestion(question), hint: question.hint, solution: question.solution, answerDisplay: question.answerDisplay };
}
function visibleProfile(profile) {
  return { profile: profileMeta(profile), progress: clone(profile.progress), rounds: profile.rounds.map(visibleRound), mistakes: profile.mistakes.map(visibleMistake) };
}

async function loadStore(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const filename = path.join(dataDir, 'learning.json');
  const parse = async file => {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.schemaVersion !== 1 || !Array.isArray(data.profiles) || data.profiles.length === 0) throw new Error('数据格式不正确');
    return data;
  };
  let data; let recovered = false;
  try { data = await parse(filename); }
  catch (error) {
    if (error.code === 'ENOENT') data = { schemaVersion: 1, profiles: [freshProfile('我的学习')] };
    else {
      try { data = await parse(`${filename}.bak`); recovered = true; console.warn('已从上一次有效备份恢复学习记录。'); }
      catch { throw new Error(`学习记录无法读取，请保留数据目录并检查 learning.json 与备份：${dataDir}`); }
    }
  }
  let serial = Promise.resolve();
  async function persist(next) {
    const temp = `${filename}.tmp-${randomUUID()}`;
    const file = await open(temp, 'w', 0o600);
    try { await file.writeFile(JSON.stringify(next, null, 2), 'utf8'); await file.sync(); }
    finally { await file.close(); }
    if (!recovered) try { await copyFile(filename, `${filename}.bak`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(temp, filename);
    recovered = false;
  }
  // Persist the default profile before exposing its id to another device.
  if (recovered || !await stat(filename).catch(() => null)) await persist(data);
  return {
    async read(fn) { await serial; return fn(data); },
    transaction(fn) {
      const result = serial.then(async () => {
        const next = clone(data);
        const value = await fn(next);
        await persist(next);
        data = next;
        return value;
      });
      serial = result.catch(() => {});
      return result;
    },
    async flush() { await serial; }
  };
}

function lanAddresses() {
  return [...new Set(Object.values(os.networkInterfaces()).flat().filter(item => item && !item.internal && item.family === 'IPv4').map(item => item.address))];
}
async function bodyJson(req) {
  requireValue(req.headers['content-type']?.split(';')[0] === 'application/json', 415, '请使用 JSON 提交。');
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; requireValue(length <= 131072, 413, '提交内容过大。'); chunks.push(chunk); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    requireValue(value && typeof value === 'object' && !Array.isArray(value), 400, '提交格式不正确。');
    return value;
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, '提交内容不是有效 JSON。'); }
}
function findProfile(data, id) {
  const profile = data.profiles.find(item => item.id === id);
  requireValue(profile, 404, '没有找到该学习档案。');
  return profile;
}
function findQuestion(profile, rid, qid) {
  const round = profile.rounds.find(item => item.id === rid);
  requireValue(round, 404, '没有找到本轮练习。');
  const question = round.questions.find(item => item.id === qid);
  requireValue(question, 404, '没有找到该题目。');
  return { round, question, state: round.states[qid] };
}
function validateAnswer(answer) {
  requireValue(answer && typeof answer === 'object' && !Array.isArray(answer), 400, '请先填写答案。');
  requireValue(typeof answer.value === 'string' && answer.value.length <= 120, 400, '答案过长或格式不正确。');
  if (answer.step !== undefined) requireValue(typeof answer.step === 'string' && answer.step.length <= 120, 400, '步骤格式不正确。');
  return { value: answer.value, ...(answer.step === undefined ? {} : { step: answer.step }) };
}
function checkRequest(cache, requestId, answer) {
  requireValue(typeof requestId === 'string' && requestId.length > 0 && requestId.length <= 100, 400, '提交标识不正确，请重试。');
  requireValue(!['__proto__', 'constructor', 'prototype'].includes(requestId), 400, '提交标识不正确，请重试。');
  const prior = Object.hasOwn(cache, requestId) ? cache[requestId] : undefined;
  if (prior) requireValue(prior.signature === JSON.stringify(answer), 409, '该次提交已经保存，请刷新题目状态。');
  return prior?.result;
}

export async function createApp({ dataDir = defaultDataDir() } = {}) {
  const store = await loadStore(dataDir);
  let port = 0;
  function connection() {
    const localUrl = `http://127.0.0.1:${port}`;
    const lanUrls = lanAddresses().map(address => `http://${address}:${port}`);
    return { localUrl, lanUrls, qrUrl: `/api/qr.svg?url=${encodeURIComponent(lanUrls[0] || localUrl)}` };
  }
  const server = createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
    try {
      const host = req.headers.host || `127.0.0.1:${port}`;
      const hostname = new URL(`http://${host}`).hostname;
      const localHosts = ['localhost', '127.0.0.1', '[::1]', ...lanAddresses()];
      requireValue(localHosts.includes(hostname), 403, '请使用启动页面显示的本机或家庭网络地址。');
      if (req.method !== 'GET' && req.headers.origin) requireValue(req.headers.origin === `http://${host}`, 403, '请从本应用页面提交。');
      const url = new URL(req.url, `http://${host}`);
      const pathname = decodeURIComponent(url.pathname);
      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        return send(200, await store.read(data => ({ version: VERSION, modules, profiles: data.profiles.map(profileMeta), chapters: chapterNames.map((title, i) => ({ number: i + 1, title, count: chapterCounts[i] })), connection: connection() })));
      }
      if (req.method === 'GET' && pathname === '/api/qr.svg') {
        const target = url.searchParams.get('url');
        const info = connection();
        requireValue([info.localUrl, ...info.lanUrls, `http://localhost:${port}`].includes(target), 400, '二维码仅用于本机与家庭网络访问地址。');
        const qr = qrcode(0, 'M'); qr.addData(target); qr.make();
        const n = qr.getModuleCount(); const paths = [];
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) paths.push(`M${x + 4},${y + 4}h1v1h-1z`);
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="平板访问二维码"><rect width="100%" height="100%" fill="white"/><path d="${paths.join('')}" fill="#102d26"/></svg>`);
      }
      if (pathname === '/api/profiles' && req.method === 'POST') {
        const body = await bodyJson(req);
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        requireValue(name.length > 0 && name.length <= 24, 400, '请填写1至24字的学习档案名称。');
        return send(201, await store.transaction(data => {
          requireValue(data.profiles.length < 40, 400, '家庭档案已达上限。');
          const profile = freshProfile(name); data.profiles.push(profile); return profileMeta(profile);
        }));
      }
      const route = pathname.match(/^\/api\/profiles\/([^/]+)(?:\/(.*))?$/);
      if (route) {
        const [, profileId, tail = ''] = route;
        if (req.method === 'GET' && tail === '') return send(200, await store.read(data => visibleProfile(findProfile(data, profileId))));
        if (req.method === 'GET' && /^rounds\/[^/]+$/.test(tail)) {
          return send(200, await store.read(data => {
            const round = findProfile(data, profileId).rounds.find(item => item.id === tail.split('/')[1]);
            requireValue(round, 404, '没有找到本轮练习。'); return visibleRound(round);
          }));
        }
        if (req.method === 'POST') {
          const body = await bodyJson(req);
          if (tail === 'progress') {
            requireValue(knownModule(body.moduleId) && ['learn', 'practice'].includes(body.mode) && Number.isInteger(body.step) && body.step >= 0 && body.step <= 30, 400, '学习位置格式不正确。');
            return send(200, await store.transaction(data => {
              const profile = findProfile(data, profileId);
              profile.progress[body.moduleId] = { mode: body.mode, step: body.step, updatedAt: now() };
              return { progress: clone(profile.progress) };
            }));
          }
          if (tail === 'rounds') {
            requireValue(knownModule(body.moduleId), 400, '请选择已上线的知识点。');
            return send(201, await store.transaction(data => {
              const profile = findProfile(data, profileId); const id = randomUUID();
              const questions = generateQuestions(body.moduleId, id);
              const round = { id, moduleId: body.moduleId, seed: id, createdAt: now(), questions, states: Object.fromEntries(questions.map(question => [question.id, newState()])) };
              profile.rounds.push(round);
              profile.progress[body.moduleId] = { mode: 'practice', step: 0, updatedAt: now() };
              return visibleRound(round);
            }));
          }
          const questionRoute = tail.match(/^rounds\/([^/]+)\/questions\/([^/]+)\/(submit|hint|solution)$/);
          if (questionRoute) {
            const [, rid, qid, action] = questionRoute;
            return send(200, await store.transaction(data => {
              const profile = findProfile(data, profileId);
              const { round, question, state } = findQuestion(profile, rid, qid);
              if (action === 'hint' || action === 'solution') {
                if (action === 'hint') state.usedHint = true;
                else {
                  state.viewedSolution = true;
                  if (!state.completed) { state.completed = true; state.completion = 'solution'; }
                }
                const mistake = profile.mistakes.find(item => item.roundId === rid && item.questionId === qid);
                if (mistake) { mistake.usedHint = state.usedHint; mistake.viewedSolution = state.viewedSolution; }
                return action === 'hint' ? { hint: question.hint, round: visibleRound(round) } : { solution: question.solution, answerDisplay: question.answerDisplay, round: visibleRound(round) };
              }
              const answer = validateAnswer(body.answer);
              const previous = checkRequest(state.requests, body.requestId, answer);
              if (previous) return { ...previous, round: visibleRound(round) };
              requireValue(!state.latestCorrect, 409, '本题已经答对，可以进入下一题。');
              const result = gradeAnswer(question, answer);
              if (!result.valid) return { ...result, round: visibleRound(round) };
              const first = state.firstAnswer === null;
              if (first) {
                state.firstAnswer = clone(answer); state.firstCorrect = result.correct;
                state.independentCorrect = result.correct && !state.usedHint && !state.viewedSolution;
              }
              state.attemptCount++; state.lastAnswer = clone(answer); state.latestCorrect = result.correct; state.feedback = result.message;
              if (result.correct) {
                state.completed = true;
                state.completion = state.independentCorrect ? 'independent' : state.viewedSolution ? 'solution' : state.usedHint ? 'hint' : 'retry';
              }
              let mistake = profile.mistakes.find(item => item.roundId === rid && item.questionId === qid);
              if (first && !result.correct) {
                mistake = { id: randomUUID(), roundId: rid, questionId: qid, moduleId: round.moduleId, createdAt: now(), question: clone(question), firstAnswer: clone(answer), usedHint: state.usedHint, viewedSolution: state.viewedSolution, corrected: false, reviewAttempts: [], requests: {} };
                profile.mistakes.push(mistake);
              }
              if (mistake && result.correct) { mistake.corrected = true; mistake.correctedAt = now(); }
              state.requests[body.requestId] = { signature: JSON.stringify(answer), result };
              return { ...result, round: visibleRound(round) };
            }));
          }
          const reviewRoute = tail.match(/^mistakes\/([^/]+)\/review$/);
          if (reviewRoute) {
            return send(200, await store.transaction(data => {
              const profile = findProfile(data, profileId);
              const mistake = profile.mistakes.find(item => item.id === reviewRoute[1]);
              requireValue(mistake, 404, '没有找到该错题。');
              const answer = validateAnswer(body.answer);
              mistake.requests ||= {};
              const previous = checkRequest(mistake.requests, body.requestId, answer);
              if (previous) return { ...previous, mistake: visibleMistake(mistake) };
              const result = gradeAnswer(mistake.question, answer);
              if (result.valid) {
                mistake.reviewAttempts.push({ answer: clone(answer), correct: result.correct, at: now() });
                mistake.corrected = result.correct;
                if (result.correct) { mistake.corrected = true; mistake.correctedAt = now(); }
                mistake.requests[body.requestId] = { signature: JSON.stringify(answer), result };
              }
              return { ...result, mistake: visibleMistake(mistake) };
            }));
          }
        }
        throw new HttpError(404, '没有找到该操作。');
      }
      if (pathname.startsWith('/api/')) throw new HttpError(404, '没有找到该接口。');
      requireValue(req.method === 'GET' || req.method === 'HEAD', 405, '不支持该操作。');
      const filename = path.resolve(PUBLIC, `.${pathname === '/' ? '/index.html' : pathname}`);
      requireValue(filename.startsWith(`${PUBLIC}${path.sep}`) && !pathname.split('/').some(part => part.startsWith('.')), 404, '没有找到该页面。');
      const actual = await realpath(filename).catch(() => null);
      requireValue(actual && actual.startsWith(`${PUBLIC}${path.sep}`), 404, '没有找到该页面。');
      const contents = await readFile(actual);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(actual)] || 'application/octet-stream' });
      return res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (!(error instanceof HttpError)) console.error('本地服务错误：', error.message);
      send(error.status || 500, { error: error instanceof HttpError ? error.message : '暂时无法保存或读取，请保持页面并重试。' });
    }
  });
  return {
    server,
    listen(listenPort = 0, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(listenPort, host, () => { server.off('error', reject); port = server.address().port; resolve({ url: `http://127.0.0.1:${port}`, port }); });
      });
    },
    async close() { await store.flush(); if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let app;
  try {
    const port = Number(process.env.PORT || 3210);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 需要是1至65535之间的整数。');
    app = await createApp(); await app.listen(port, process.env.MATH_HOST || '0.0.0.0');
    console.log(`\n交互学数学 · ${VERSION} · ${modules.length} 个学习项目\n电脑访问：http://127.0.0.1:${port}`);
    for (const address of lanAddresses()) console.log(`平板访问：http://${address}:${port}`);
    console.log(`记录位置：${defaultDataDir()}\n保持此窗口运行，按 Control+C 停止。\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? `${process.env.PORT || 3210}端口正在使用。请检查已经打开的学习窗口，或关闭原服务后重试。` : `启动失败：${error.message}`);
    if (app) await app.close(); process.exitCode = 1;
  }
}
