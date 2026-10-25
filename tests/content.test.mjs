import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { modules, generateQuestions, gradeAnswer, publicQuestion } from '../domain/content.mjs';

const numeric = value => ({ input: { type: 'number' }, expected: { value } });
const seeds = Array.from({ length: 200 }, (_, i) => `round-${i}`);

test('twenty-eight modules include twelve first-chapter and fourteen second-chapter goals with complete content', () => {
  assert.deepEqual(modules.map(m => m.id), ['N-NEG-COMP', 'A-LIKE-COMBINE', 'G-BISECTOR-CALC', 'C1-04', 'C1-05', 'C1-06', 'C1-07', 'C1-08', 'C1-01', 'C1-02', 'C1-03', 'C1-09', 'C1-10', 'C1-11', 'C2-01', 'C2-02', 'C2-03', 'C2-04', 'C2-05', 'C2-06', 'C2-07', 'C2-08', 'C2-09', 'C2-10', 'C2-11', 'C2-12', 'C2-13', 'C2-14']);
  assert.equal(modules.filter(m => m.chapter === 1).length, 12);
  assert.equal(modules.filter(m => m.chapter === 2).length, 14);
  for (const m of modules) {
    for (const key of ['title', 'chapterTitle', 'section', 'pages', 'goal', 'lead', 'rule']) assert.ok(m[key]);
    assert.ok(m.prerequisites.length && m.learningSteps.length >= 3);
    assert.ok(m.example.question && m.example.answer && m.example.steps.length >= 2);
    assert.ok(m.learningSteps.every(s => s.title && s.prompt && s.instruction));
    assert.ok((m.prerequisiteIds || []).every(id => modules.some(candidate => candidate.id === id)));
  }
});

test('every seeded round is reproducible, JSON serializable, 3+2, and has no repeated problem', () => {
  for (const m of modules) for (const seed of seeds) {
    const questions = generateQuestions(m.id, seed);
    assert.deepEqual(questions, generateQuestions(m.id, seed));
    assert.deepEqual(JSON.parse(JSON.stringify(questions)), questions);
    assert.equal(questions.length, 5);
    assert.equal(questions.filter(q => q.difficulty === 'basic').length, 3);
    assert.equal(questions.filter(q => q.difficulty === 'variation').length, 2);
    assert.equal(new Set(questions.map(q => q.id)).size, 5);
    assert.equal(new Set(questions.map(q => `${q.prompt}|${q.mathHtml}|${JSON.stringify(q.diagram)}`)).size, 5);
    assert.ok(questions.every(q => q.moduleId === m.id && q.hint && q.solution.length >= 2 && q.answerDisplay));
  }
  for (const m of modules) assert.notDeepEqual(generateQuestions(m.id, 'a'), generateQuestions(m.id, 'b'));
  assert.throws(() => generateQuestions('not-a-module', 'a'), RangeError);
});

test('all generated correct answers pass; valid mathematical mistakes differ from invalid input', () => {
  for (const m of modules) for (const seed of seeds) for (const q of generateQuestions(m.id, seed)) {
    assert.deepEqual(gradeAnswer(q, { ...q.expected }), { valid: true, correct: true, message: '答对了！' });
    const wrong = q.input.type === 'choice' ? q.input.options.find(o => o.value !== q.expected.value).value : '999999';
    assert.equal(gradeAnswer(q, { value: wrong, step: q.expected.step }).valid, true);
    assert.equal(gradeAnswer(q, { value: wrong, step: q.expected.step }).correct, false);
    assert.equal(gradeAnswer(q, { value: '', step: q.expected.step }).valid, false);
    if (q.step) {
      assert.equal(gradeAnswer(q, { value: q.expected.value }).valid, false);
      const other = q.step.options.find(o => o.value !== q.expected.step).value;
      assert.deepEqual(Object.fromEntries(Object.entries(gradeAnswer(q, { value: q.expected.value, step: other })).filter(([k]) => k !== 'message')), { valid: true, correct: false });
    }
  }
});

test('number grading is exact for fractions, decimal equivalents, signs and very large integers', () => {
  const good = [
    ['1/3', '2/6'], ['-1/2', '−0.5'], ['3/4', ' 6 / 8 '], ['-2/3', '2/-3'],
    ['0', '-0.000'], ['0', '0/999'], ['1/2', '.5'], ['5', '5.'], ['1/2', '＋０．５'],
    ['9007199254740993', '18014398509481986/2'], ['1/100000000000000000000', '0.00000000000000000001'],
  ];
  for (const [expected, value] of good) assert.equal(gradeAnswer(numeric(expected), { value }).correct, true, `${value} = ${expected}`);
  for (const [expected, value] of [['1/3', '0.3333333333333333'], ['9007199254740993', '9007199254740992'], ['0', '0.00000000000000000001']]) {
    assert.equal(gradeAnswer(numeric(expected), { value }).valid, true);
    assert.equal(gradeAnswer(numeric(expected), { value }).correct, false);
  }
});

test('zero divisors, malformed answers, injection, infinity and unbounded inputs are invalid', () => {
  for (const value of ['', ' ', '1/0', '0/0', '3//4', '1.2/3', '1+2', 'NaN', 'Infinity', '1e3', '3x', '<img onerror=alert(1)>', '9'.repeat(300)]) {
    assert.equal(gradeAnswer(numeric('1'), { value }).valid, false, value);
  }
  for (const answer of [null, undefined, [], '1', { value: 1 }, { value: {} }]) assert.equal(gradeAnswer(numeric('1'), answer).valid, false);
  const choice = generateQuestions('N-NEG-COMP', 'x')[0];
  assert.equal(gradeAnswer(choice, { value: '<' }).valid, false);
});

test('negative comparison covers exact fraction equality and requires the right absolute-value step', () => {
  for (const seed of seeds) {
    const q = generateQuestions('N-NEG-COMP', seed);
    assert.ok(q[0].mathHtml.includes('−') && q[1].mathHtml.includes('.'));
    assert.ok(q[2].mathHtml.includes('class="frac"'));
    assert.equal(q[4].expected.value, 'eq');
    assert.equal(q[4].expected.step, 'abs-eq');
    assert.notEqual(q[3].expected.value, 'eq');
    const reverse = { lt: 'abs-gt', gt: 'abs-lt', eq: 'abs-eq' };
    assert.equal(q[3].expected.step, reverse[q[3].expected.value]);
  }
});

// Recompute from the displayed problem, not the generator's expected answer.
// All generated operands here are small, so integer cross-products are exact.
function printedNumber(html) {
  const fraction = /class="frac"><span>([^<]+)<\/span><span>(\d+)<\/span>/.exec(html);
  if (fraction) return [Number(fraction[1].replace('−', '-')), Number(fraction[2])];
  const s = html.replaceAll('−', '-').trim();
  const sign = s.startsWith('-') ? -1 : 1;
  const [whole, tail = ''] = s.replace(/^[+-]/, '').split('.');
  return [sign * Number(whole + tail), 10 ** tail.length];
}
test('negative comparison answers agree with the numbers actually rendered', () => {
  const canonical = ([n, d]) => {
    let a = Math.abs(n), b = d;
    while (b) [a, b] = [b, a % b];
    return `${n / a}/${d / a}`;
  };
  for (const seed of seeds) {
    const pairs = new Set();
    for (const q of generateQuestions('N-NEG-COMP', seed)) {
      const [left, right] = q.mathHtml.split('<span class="math-gap">　?　</span>');
      const a = printedNumber(left), b = printedNumber(right);
      const [an, ad] = a, [bn, bd] = b;
      const delta = an * bd - bn * ad;
      assert.equal(q.expected.value, delta < 0 ? 'lt' : delta > 0 ? 'gt' : 'eq');
      pairs.add([canonical(a), canonical(b)].sort().join('|'));
    }
    assert.equal(pairs.size, 5, 'do not repeat the same mathematical pair with a different representation');
  }
});

function coefficientSum(html) {
  const flat = html.replace(/<sup>[^<]*<\/sup>/g, '')
    .replace(/<span class="frac"><span>([^<]+)<\/span><span>([^<]+)<\/span><\/span>/g, '$1/$2');
  let n = 0, d = 1;
  for (const m of flat.matchAll(/([＋−]?)(\d+(?:\/\d+)?)?([a-z]+)/g)) {
    const [a, b = '1'] = (m[2] || '1').split('/');
    const signed = Number(a) * (m[1] === '−' ? -1 : 1);
    n = n * Number(b) + signed * d;
    d *= Number(b);
  }
  return `${n}/${d}`;
}
test('coefficient answers agree with the rendered terms, including implicit signs and fractions', () => {
  for (const seed of seeds) {
    const q = generateQuestions('A-LIKE-COMBINE', seed);
    for (const item of q.slice(0, 3)) assert.equal(gradeAnswer(item, { value: coefficientSum(item.mathHtml) }).correct, true);
    assert.equal(gradeAnswer(numeric('0'), { value: coefficientSum(q[3].mathHtml) }).correct, true);
    const correctHtml = q[4].input.options.find(o => o.value === q[4].expected.value).html;
    assert.equal(gradeAnswer(numeric(coefficientSum(q[4].mathHtml)), { value: coefficientSum(correctHtml) }).correct, true);
  }
});

test('like terms include implicit ±1, exact fractions, cancellation and unchanged letters/exponents', () => {
  for (const seed of seeds) {
    const q = generateQuestions('A-LIKE-COMBINE', seed);
    assert.equal(q[0].input.type, 'number');
    assert.equal(q[1].mathHtml.startsWith('−a<sup>2</sup>'), true);
    assert.equal(q[2].mathHtml.startsWith('xy<sup>2</sup>'), true);
    assert.equal(q[2].expected.value.includes('/'), true);
    assert.equal(q[3].answerDisplay, '0');
    const correctCancellation = q[3].input.options.find(o => o.value === q[3].expected.value);
    assert.equal(correctCancellation.html, '0');
    const correct = q[4].input.options.find(o => o.value === q[4].expected.value);
    assert.ok(correct.html.endsWith('x<sup>2</sup>y'));
    assert.equal(q[4].input.options.filter(o => o.html.includes('x<sup>6</sup>y<sup>3</sup>')).length, 1);
    for (const item of q.filter(x => x.input.type === 'choice')) {
      assert.equal(new Set(item.input.options.map(o => o.html)).size, item.input.options.length);
      assert.ok(item.input.options.every(o => /^[a-d]$/.test(o.value)));
    }
  }
});

test('angle diagrams have valid ranges and all three known/target relations, without extra topics', () => {
  const rotations = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('G-BISECTOR-CALC', seed);
    assert.deepEqual(q.slice(0, 3).map(x => x.diagram.known), ['whole', 'half', 'other-half']);
    for (const item of q) {
      assert.ok(item.diagram.angle > 0 && item.diagram.angle < 180);
      assert.equal(item.input.unit, '°');
      assert.ok(!/[′″]/.test(item.prompt + item.mathHtml));
      assert.ok(Number.isFinite(item.diagram.rotation));
      rotations.add(item.diagram.rotation);
    }
    assert.equal(q[0].expected.value, String(q[0].diagram.angle / 2));
    assert.equal(q[1].expected.value, String(q[1].diagram.angle));
    assert.equal(q[2].expected.value, String(q[2].diagram.angle / 2));
    assert.equal(q[3].expected.step, 'half');
    assert.equal(q[4].expected.step, 'double');
  }
  assert.ok(rotations.size > 10);
});

test('public questions whitelist data, omit answer/hint/solution and do not share mutable objects', () => {
  for (const m of modules) for (const q of generateQuestions(m.id, '<script>alert(1)</script>')) {
    const original = structuredClone(q);
    q.secret = { answer: 'hidden' };
    q.input.expected = 'nested secret';
    if (q.step) q.step.options[0].correct = true;
    if (q.diagram) q.diagram.expected = 'diagram secret';
    const out = publicQuestion(q);
    const json = JSON.stringify(out);
    for (const key of ['expected', 'hint', 'solution', 'answerDisplay', 'secret', 'correct']) assert.equal(json.includes(`"${key}"`), false, key);
    assert.equal(json.includes('<script>'), false);
    assert.equal(json.includes('onerror'), false);
    assert.ok(typeof out.mathHtml === 'string' && out.input);
    if (out.input.options) out.input.options[0].label = 'changed';
    if (out.step) out.step.options[0].label = 'changed';
    if (out.diagram) out.diagram.angle = 1000;
    assert.equal(q.mathHtml, original.mathHtml);
    if (q.input.options) assert.equal(q.input.options[0].label, original.input.options[0].label);
    if (q.step) assert.equal(q.step.options[0].label, original.step.options[0].label);
    if (q.diagram) assert.equal(q.diagram.angle, original.diagram.angle);
  }
});

test('the three original generators retain their frozen question snapshots', () => {
  const fingerprints = {
    'N-NEG-COMP': '64eb0410e1023c16e62af5333da95a64b556688bf24cafe28b27b92dad8612d7',
    'A-LIKE-COMBINE': '606f4d09563f9462696588ab85ecf35572d82dc82b3a4a5c0920d818c9c7d1fb',
    'G-BISECTOR-CALC': 'd1ba37627919465864282d0c37b205baeb8d382b1a54814cae6d59da3129573c',
  };
  for (const [id, fingerprint] of Object.entries(fingerprints)) {
    const source = Array.from({ length: 5 }, (_, i) => generateQuestions(id, `legacy-${i}`));
    assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'), fingerprint);
    for (const snapshot of source.flat()) assert.equal(gradeAnswer(JSON.parse(JSON.stringify(snapshot)), snapshot.expected).correct, true);
  }
});

// Independent test arithmetic reads only visible source conditions. It does
// not call the content generator's private rational/expression helpers.
const tAdd = ([a, b], [c, d]) => [a * d + c * b, b * d];
const tMultiply = ([a, b], [c, d]) => [a * c, b * d];
const tDivide = ([a, b], [c, d]) => { assert.notEqual(c, 0); return [a * d, b * c]; };
const tNegate = ([a, b]) => [-a, b];
const tEqual = ([a, b], [c, d]) => a * d === c * b;
const tText = ([n, d]) => `${n}/${d}`;
function visibleMath(html) {
  return html.replace(/<span class="frac"><span>([^<]+)<\/span><span>([^<]+)<\/span><\/span>/g, '$1/$2').replace(/<[^>]*>/g, '').replaceAll('−', '-').replaceAll('＋', '+');
}
function sourceNumber(text) {
  let s = text.replaceAll('−', '-').replaceAll('＋', '+').trim();
  const percent = s.endsWith('%');
  if (percent) s = s.slice(0, -1);
  const result = s.includes('/') ? s.split('/').map(Number) : printedNumber(s);
  return percent ? [result[0], result[1] * 100] : result;
}
function evaluateVisible(html) {
  const source = visibleMath(html).replace(/\s+/g, '');
  let at = 0;
  function value() {
    const token = source[at];
    if (token === '+' || token === '-') { at++; const inner = value(); return token === '-' ? tNegate(inner) : inner; }
    if (token === '(' || token === '|') {
      at++;
      const inner = value();
      assert.equal(source[at++], token === '(' ? ')' : '|', source);
      return token === '|' ? [Math.abs(inner[0]), inner[1]] : inner;
    }
    const number = /^\d+(?:\.\d+)?(?:\/\d+)?/.exec(source.slice(at));
    assert.ok(number, source);
    at += number[0].length;
    return sourceNumber(number[0]);
  }
  const result = value();
  assert.equal(at, source.length, source);
  return result;
}
function optionValue(options, predicate) {
  const answers = options.filter(predicate);
  assert.equal(answers.length, 1, JSON.stringify(options));
  return answers[0].value;
}
function verifyDerived(question, value, step) {
  const answer = { value: typeof value === 'string' ? value : tText(value), ...(step === undefined ? {} : { step }) };
  assert.equal(gradeAnswer(question, answer).correct, true, `${question.moduleId}: ${question.prompt} ${question.mathHtml}`);
}
function lineValue(diagram, position) {
  const anchors = diagram.ticks.filter(tick => tick.label !== undefined);
  assert.ok(anchors.length >= 2);
  const [a, b] = anchors;
  const delta = tAdd(sourceNumber(b.label), tNegate(sourceNumber(a.label)));
  const slope = tDivide(delta, sourceNumber(String(b.position - a.position)));
  return tAdd(sourceNumber(a.label), tMultiply(slope, sourceNumber(String(position - a.position))));
}
function lineUnit(diagram) {
  return tAdd(lineValue(diagram, 1), tNegate(lineValue(diagram, 0)));
}

test('axis questions are independently solved from variants, given scales and candidate sequences', () => {
  const variants = new Set(), units = new Set();
  const judgement = {
    valid: text => text.includes('都已表示'),
    'no-origin': text => text.includes('缺少') && text.includes('0标记'),
    'no-direction': text => text.includes('缺少') && text.includes('箭头'),
    'uneven-units': text => text.includes('间距不相等'),
  };
  const repair = {
    valid: text => text.startsWith('保持图示'),
    'no-origin': text => text.includes('补上0'),
    'no-direction': text => text.includes('补箭头'),
    'uneven-units': text => text.includes('间距调整为相等'),
  };
  for (const seed of seeds) {
    const q = generateQuestions('C1-04', seed);
    for (const index of [0, 1]) {
      variants.add(q[index].diagram.variant); units.add(q[index].diagram.unit);
      assert.match(q[index].prompt, /规范画法/);
      assert.ok(q[index].diagram.unit > 0);
      const predicate = (index === 0 ? judgement : repair)[q[index].diagram.variant];
      verifyDerived(q[index], optionValue(q[index].input.options, o => predicate(o.label)));
    }
    verifyDerived(q[2], lineUnit(q[2].diagram));
    const divisionStep = optionValue(q[3].step.options, o => o.label.includes('÷'));
    verifyDerived(q[3], lineUnit(q[3].diagram), divisionStep);
    const unit = sourceNumber(/每小格代表([^，]+)，/.exec(q[4].prompt)[1]);
    const sequence = [1, 2, 3].map(n => tMultiply(unit, [n, 1]));
    const correctSequence = optionValue(q[4].input.options, o => o.label.split('，').every((text, i) => tEqual(sourceNumber(text), sequence[i])));
    const incrementStep = optionValue(q[4].step.options, o => o.label.startsWith('每向右一小格'));
    verifyDerived(q[4], correctSequence, incrementStep);
  }
  assert.deepEqual([...variants].sort(), ['no-direction', 'no-origin', 'uneven-units', 'valid']);
  assert.ok(units.has(0.5) && units.has(2));
});

test('point questions agree with independently inferred coordinates and do not label the requested value', () => {
  const positions = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-05', seed);
    for (const index of [0, 2, 3, 4]) {
      const item = q[index], point = item.diagram.points[0];
      positions.add(point.position);
      assert.ok(/^[A-Z]$/.test(point.label));
      const atPoint = item.diagram.ticks.find(tick => tick.position === point.position);
      assert.equal(atPoint?.label, undefined, 'the requested number must not be printed at the point');
      const answer = lineValue(item.diagram, point.position);
      const step = item.step && optionValue(item.step.options, o => o.label.startsWith('先看每小格'));
      verifyDerived(item, answer, step || undefined);
    }
    const target = sourceNumber(/哪一个表示([^？]+)？/.exec(q[1].prompt)[1]);
    const point = q[1].diagram.points.filter(p => tEqual(lineValue(q[1].diagram, p.position), target));
    assert.equal(point.length, 1);
    verifyDerived(q[1], optionValue(q[1].input.options, o => o.label === `点${point[0].label}`));
  }
  assert.ok([...positions].some(p => p < 0) && [...positions].some(p => p > 0));
  assert.ok([...positions].some(p => !Number.isInteger(p)), 'cover half-grid positions');
});

test('opposite questions are solved from displayed operands and symmetric point conditions', () => {
  for (const seed of seeds) {
    const q = generateQuestions('C1-06', seed);
    for (const item of q.slice(0, 3)) verifyDerived(item, tNegate(evaluateVisible(item.mathHtml)));
    const known = /a的相反数是(.+)，a＝？/.exec(visibleMath(q[3].mathHtml))[1];
    const reverseStep = optionValue(q[3].step.options, o => o.label.startsWith('再取一次相反数'));
    verifyDerived(q[3], tNegate(sourceNumber(known)), reverseStep);
    const source = sourceNumber(/A点表示([^。]+)。/.exec(q[4].prompt)[1]);
    const a = q[4].diagram.points.find(p => p.label === 'A'), b = q[4].diagram.points.find(p => p.label === 'B');
    assert.equal(a.position + b.position, 0);
    assert.ok(tEqual(lineValue(q[4].diagram, a.position), source));
    const symmetricStep = optionValue(q[4].step.options, o => o.label.includes('另一侧'));
    verifyDerived(q[4], tNegate(source), symmetricStep);
    assert.equal(gradeAnswer(q[2], { value: '-0.0' }).correct, true);
  }
});

test('nested signs and symbolic a conditions are independently evaluated across all sign cases', () => {
  const symbolCases = new Set(), depths = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-07', seed);
    for (const item of q.slice(0, 3)) verifyDerived(item, evaluateVisible(item.mathHtml));
    const count = (q[3].mathHtml.match(/−/g) || []).length;
    depths.add(count);
    const countStep = optionValue(q[3].step.options, o => o.label === `取相反数${count}次`);
    verifyDerived(q[3], evaluateVisible(q[3].mathHtml), countStep);
    const condition = /a([＞＜＝])0/.exec(q[4].mathHtml)[1];
    symbolCases.add(condition);
    const result = { '＞': '负数', '＜': '正数', '＝': '0' }[condition];
    const choice = optionValue(q[4].input.options, o => o.label === result);
    const symbolicStep = optionValue(q[4].step.options, o => o.label.includes('结合a的已知符号'));
    verifyDerived(q[4], choice, symbolicStep);
  }
  assert.deepEqual([...symbolCases].sort(), ['＜', '＝', '＞']);
  assert.deepEqual([...depths].sort(), [3, 4]);
});

test('absolute values follow rendered signs and distances, including zero and inner simplification', () => {
  for (const seed of seeds) {
    const q = generateQuestions('C1-08', seed);
    for (const item of q.slice(0, 3)) {
      const answer = evaluateVisible(item.mathHtml);
      assert.ok(answer[0] >= 0);
      verifyDerived(item, answer);
    }
    const inner = evaluateVisible(q[3].mathHtml.slice(1, -1));
    const innerStep = optionValue(q[3].step.options, o => tEqual(sourceNumber(o.label), inner));
    verifyDerived(q[3], evaluateVisible(q[3].mathHtml), innerStep);
    const distanceStep = optionValue(q[4].step.options, o => o.label.includes('结果不能是负数'));
    verifyDerived(q[4], evaluateVisible(q[4].mathHtml), distanceStep);
    assert.ok(q.every(item => !/求原数|找原数|由绝对值/.test(item.prompt)), 'inverse absolute value belongs to a later project');
  }
});

test('new public diagrams copy nested arrays, preserve necessary labels and discard private data', () => {
  for (const moduleId of ['C1-04', 'C1-05', 'C1-06']) for (const q of generateQuestions(moduleId, 'diagram-security')) {
    if (!q.diagram) continue;
    q.diagram.expected = 'hidden';
    if (q.diagram.ticks) q.diagram.ticks[0].solution = 'nested hidden';
    if (q.diagram.points?.length) q.diagram.points[0].expected = 'point hidden';
    const original = structuredClone(q);
    const out = publicQuestion(q);
    assert.ok(!JSON.stringify(out.diagram).includes('hidden'));
    if (out.diagram.type === 'numberline') {
      assert.deepEqual(Object.keys(out.diagram).sort(), ['arrow', 'max', 'min', 'originVisible', 'points', 'ticks', 'type']);
      assert.ok(out.diagram.min < out.diagram.max && out.diagram.min <= 0 && out.diagram.max >= 0);
      assert.notEqual(out.diagram.ticks, q.diagram.ticks);
      assert.notEqual(out.diagram.points, q.diagram.points);
      for (const tick of out.diagram.ticks) assert.ok(Object.keys(tick).every(key => ['position', 'label'].includes(key)));
      for (const point of out.diagram.points) assert.deepEqual(Object.keys(point).sort(), ['label', 'position']);
      out.diagram.ticks[0].label = 'changed';
      if (out.diagram.points.length) out.diagram.points[0].label = 'changed';
      assert.deepEqual(q.diagram, original.diagram);
    } else assert.deepEqual(Object.keys(out.diagram).sort(), ['type', 'unit', 'variant']);
  }
});

test('all eight version 0.2 generators preserve their frozen multi-seed snapshots', () => {
  const fingerprints = {
    'N-NEG-COMP': '8eafc39cd80e0675a9cd7d599700e763de546094162f24eb05eb26f3af0ee824',
    'A-LIKE-COMBINE': '29d679c07c55ca0bad57d11d8344cb465b419295e871da3b62e1d0b0029e68aa',
    'G-BISECTOR-CALC': '905c95f03601618106a28c94dff94396dc49f9175cb279bcbd9a8323ee4d0e16',
    'C1-04': 'b3cf6a599805ec2d8194d6986f142cf1d00271c2e0afe75df0c7f3e2e6452822',
    'C1-05': 'e41946b81a32b000d728a04df0d528d5c9d3d1c39bfba49314de367443adac6c',
    'C1-06': '443c7a07782e56dde9c807f80805b40d024c25521aeee5834e93e9ce93cbe027',
    'C1-07': '8cc9ad09405e3b642c25993d8af8d6d728c1b0002a13be6d2dcb0fb43aebb33f',
    'C1-08': '4271fab385c4fb1e9c4c91b1b44667179f4138db3bb319beb9910277a0ce8465',
  };
  for (const [id, fingerprint] of Object.entries(fingerprints)) {
    const snapshots = Array.from({ length: 5 }, (_, i) => generateQuestions(id, `v020-${i}`));
    assert.equal(createHash('sha256').update(JSON.stringify(snapshots)).digest('hex'), fingerprint);
    for (const snapshot of snapshots.flat()) assert.equal(gradeAnswer(JSON.parse(JSON.stringify(snapshot)), snapshot.expected).correct, true);
  }
});

const valueSign = ([n]) => n > 0 ? '正数' : n < 0 ? '负数' : '0';
const tMagnitude = ([n, d]) => [Math.abs(n), Math.abs(d)];
const tCompare = ([a, b], [c, d]) => Math.sign(a * d - c * b);
function sameValues(actual, expected) {
  return actual.length === expected.length && actual.every(a => expected.some(b => tEqual(a, b))) && expected.every(b => actual.some(a => tEqual(a, b)));
}

test('sign classification uses actual values, including omitted plus, percentages and all zero forms', () => {
  const zeroForms = new Set(), percentSigns = new Set(), claims = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-01', seed);
    for (const item of q.slice(0, 4)) {
      const value = sourceNumber(visibleMath(item.mathHtml));
      verifyDerived(item, optionValue(item.input.options, o => o.label === valueSign(value)), item.step && optionValue(item.step.options, o => o.label.startsWith('仍看它与0的关系')));
    }
    zeroForms.add(visibleMath(q[2].mathHtml));
    percentSigns.add(valueSign(sourceNumber(visibleMath(q[3].mathHtml))));
    assert.match(q[3].mathHtml, /%/);
    claims.add(q[4].prompt);
    verifyDerived(q[4], optionValue(q[4].input.options, o => o.label === '不对，0既不是正数，也不是负数'), optionValue(q[4].step.options, o => o.label.startsWith('用0检查')));
  }
  for (const zero of ['0', '-0', '+0', '0%', '0/5']) assert.ok(zeroForms.has(zero));
  assert.deepEqual([...percentSigns].sort(), ['正数', '负数']);
  assert.equal(claims.size, 2);
});

test('signed context answers follow each stated baseline/direction, including reverse interpretation and zero deviations', () => {
  const directions = new Set(), zeroCases = new Set(), firstContexts = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-02', seed);
    let firstValue;
    if (q[0].input.unit === '%') {
      firstContexts.add('negative-growth');
      firstValue = [-Number(/减少(\d+)%/.exec(q[0].prompt)[1]), 1];
      assert.match(q[0].prompt, /无变化为0%/);
    } else {
      firstContexts.add('temperature');
      const [, direction, amount] = /零(下|上)(\d+)℃应/.exec(q[0].prompt);
      firstValue = [Number(amount) * (direction === '下' ? -1 : 1), 1];
      assert.match(q[0].prompt, /以0℃为基准/);
    }
    verifyDerived(q[0], firstValue);
    const altitude = sourceNumber(/海拔记为([^米]+)米/.exec(q[1].prompt)[1]);
    assert.match(q[1].prompt, /海平面为0米/);
    const meaning = `比海平面${altitude[0] < 0 ? '低' : '高'}${Math.abs(altitude[0] / altitude[1])}米`;
    verifyDerived(q[1], optionValue(q[1].input.options, o => o.label === meaning));
    let money;
    if (q[2].prompt.includes('没有收入也没有支出')) { money = [0, 1]; zeroCases.add('money'); }
    else { const [, direction, amount] = /本次(收入|支出)(\d+)元/.exec(q[2].prompt); money = [Number(amount) * (direction === '收入' ? 1 : -1), 1]; }
    verifyDerived(q[2], money);
    let deviation;
    if (q[3].prompt.includes('恰好等于标准质量')) { deviation = [0, 1]; zeroCases.add('deviation'); }
    else { const [, direction, amount] = /比标准(多|少)(\d+)克/.exec(q[3].prompt); deviation = [Number(amount) * (direction === '多' ? 1 : -1), 1]; }
    assert.doesNotMatch(q[3].prompt, /比标准[多少]0克/);
    verifyDerived(q[3], deviation, optionValue(q[3].step.options, o => o.label.startsWith('先与标准比较')));
    const [, direction, amount] = /随后水位(上升|下降)([^米]+)米/.exec(q[4].prompt);
    directions.add(direction);
    assert.match(q[4].prompt, /下降为正、上升为负/);
    const water = sourceNumber(amount);
    verifyDerived(q[4], direction === '上升' ? tNegate(water) : water, optionValue(q[4].step.options, o => o.label.startsWith('按本题规定')));
  }
  assert.deepEqual([...firstContexts].sort(), ['negative-growth', 'temperature']);
  assert.deepEqual([...directions].sort(), ['上升', '下降']);
  assert.deepEqual([...zeroCases].sort(), ['deviation', 'money']);
});

test('rational classification ignores written form and validates finite/recurring decimal claims', () => {
  const disguised = new Set(), signClasses = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-03', seed);
    for (const item of q.slice(0, 2)) {
      const [n, d] = sourceNumber(visibleMath(item.mathHtml));
      const category = n % d === 0 ? '整数' : '非整数分数';
      verifyDerived(item, optionValue(item.input.options, o => o.label === category));
    }
    disguised.add(visibleMath(q[0].mathHtml));
    const signClass = valueSign(sourceNumber(visibleMath(q[2].mathHtml)));
    signClasses.add(signClass);
    verifyDerived(q[2], optionValue(q[2].input.options, o => o.label === signClass));
    const decimal = sourceNumber(q[3].mathHtml);
    verifyDerived(q[3], optionValue(q[3].input.options, o => tEqual(sourceNumber(o.label), decimal)), optionValue(q[3].step.options, o => o.label.startsWith('它可以写成')));
    const recurring = /^0\.(\d+)…（(\d+)循环）$/.exec(q[4].mathHtml);
    assert.ok(recurring && recurring[1] === recurring[2].repeat(3));
    verifyDerived(q[4], optionValue(q[4].input.options, o => o.label.startsWith('属于有理数')), optionValue(q[4].step.options, o => o.label.startsWith('依据循环小数')));
    assert.doesNotMatch(q.map(item => item.prompt + item.mathHtml).join(''), /无理数|π|√/);
  }
  for (const text of ['2.0', '6/3', '0/5', '100%']) assert.ok(disguised.has(text));
  assert.deepEqual([...signClasses].sort(), ['0', '正数', '负数']);
});

test('distance comparisons use magnitude, preserve equal distances and keep all tied farthest numbers', () => {
  const graphKinds = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-09', seed);
    for (const index of [0, 1, 3]) {
      const item = q[index], [left, right] = visibleMath(item.mathHtml).split('　与　').map(sourceNumber).map(tMagnitude);
      const relation = tCompare(left, right);
      const near = item.prompt.includes('更近');
      const side = relation === 0 ? '两个数到原点的距离相等' : `${(near ? relation < 0 : relation > 0) ? '左' : '右'}边的数离原点${near ? '更近' : '更远'}`;
      const step = item.step && optionValue(item.step.options, o => o.label.startsWith('比较绝对值'));
      verifyDerived(item, optionValue(item.input.options, o => o.label === side), step || undefined);
    }
    assert.ok(tEqual(...visibleMath(q[1].mathHtml).split('　与　').map(sourceNumber).map(tMagnitude)));
    const far = q[2].prompt.includes('最远'); graphKinds.add(far ? 'far' : 'near');
    const pointDistances = q[2].diagram.points.map(p => ({ label: p.label, distance: tMagnitude(lineValue(q[2].diagram, p.position)) }));
    const sorted = [...pointDistances].sort((a, b) => tCompare(a.distance, b.distance));
    const point = far ? sorted.at(-1) : sorted[0];
    verifyDerived(q[2], optionValue(q[2].input.options, o => o.label === `点${point.label}`));
    for (const p of q[2].diagram.points) assert.ok(q[2].solution[0].includes(`点${p.label}距原点${Math.abs(p.position)}小格`));
    const sources = visibleMath(q[4].mathHtml).split('，').map(sourceNumber);
    const max = sources.map(tMagnitude).sort(tCompare).at(-1);
    const expected = sources.filter(value => tEqual(tMagnitude(value), max));
    assert.equal(expected.length, 2);
    verifyDerived(q[4], optionValue(q[4].input.options, o => sameValues(o.label.split('和').map(sourceNumber), expected)), optionValue(q[4].step.options, o => o.label.includes('保留全部并列')));
  }
  assert.deepEqual([...graphKinds].sort(), ['far', 'near']);
});

test('ordering options are complete strict chains independently evaluated from all source expressions', () => {
  for (const seed of seeds) for (const q of generateQuestions('C1-10', seed)) {
    const sourceValues = visibleMath(q.mathHtml).split('；').map(evaluateVisible);
    assert.ok(sourceValues.some(([n]) => n < 0) && sourceValues.some(([n]) => n === 0) && sourceValues.some(([n]) => n > 0));
    for (let i = 0; i < sourceValues.length; i++) for (let j = i + 1; j < sourceValues.length; j++) assert.ok(!tEqual(sourceValues[i], sourceValues[j]));
    const descending = q.prompt.includes('大到小'), sign = descending ? '＞' : '＜';
    const choice = optionValue(q.input.options, option => {
      const values = option.label.split(sign).map(evaluateVisible);
      return sameValues(values, sourceValues) && values.slice(1).every((value, i) => tCompare(values[i], value) === (descending ? 1 : -1));
    });
    const step = q.step && optionValue(q.step.options, o => o.label.startsWith('先化简各数'));
    verifyDerived(q, choice, step || undefined);
    assert.equal(new Set(q.input.options.map(o => o.label)).size, 4);
    if (q.difficulty === 'variation') assert.ok(q.mathHtml.includes('|') && q.mathHtml.includes('('));
  }
});

test('inverse absolute value returns all ± candidates, filters signs and handles zero uniqueness/empty results', () => {
  const uniqueSigns = new Set();
  for (const seed of seeds) {
    const q = generateQuestions('C1-11', seed);
    for (const index of [0, 3]) {
      const item = q[index];
      const distance = sourceNumber(/距离是([^，]+)，/.exec(item.prompt)[1]);
      const negative = item.prompt.includes('a是负数'); uniqueSigns.add(negative ? '-' : '+');
      const step = item.step && optionValue(item.step.options, o => o.label.startsWith('先找正负两个候选'));
      verifyDerived(item, negative ? tNegate(distance) : distance, step || undefined);
    }
    assert.equal(q[1].mathHtml, '|a|＝0');
    verifyDerived(q[1], [0, 1]);
    const distance = sourceNumber(/距离是([^，]+)，/.exec(q[2].prompt)[1]);
    assert.ok(distance[0] > 0);
    const candidates = [tNegate(distance), distance];
    verifyDerived(q[2], optionValue(q[2].input.options, o => sameValues(o.label.replace(/^只有/, '').split('或').map(sourceNumber), candidates)));
    assert.match(q[4].prompt, /距离是0.*要求a是[正负]数/);
    verifyDerived(q[4], optionValue(q[4].input.options, o => o.label === '没有符合条件的数'), optionValue(q[4].step.options, o => o.label.startsWith('距离0只留下0')));
    assert.ok(q.every(item => item.input.type === 'choice' || item.input.type === 'number'));
  }
  assert.deepEqual([...uniqueSigns].sort(), ['+', '-']);
});

// A separate small test parser reads the expressions students see. It handles
// binary addition/subtraction, parentheses, grouping brackets and absolute
// values, using integer cross-products instead of floating point arithmetic.
function arithmeticFromSource(html) {
  const source = visibleMath(html).replace(/\s+/g, '').replaceAll('[', '(').replaceAll(']', ')');
  let at = 0;
  function primary() {
    const token = source[at];
    if (token === '+' || token === '-') { at++; const result = primary(); return token === '-' ? tNegate(result) : result; }
    if (token === '(' || token === '|') {
      at++;
      const result = expression();
      assert.equal(source[at++], token === '(' ? ')' : '|', source);
      return token === '|' ? tMagnitude(result) : result;
    }
    const number = /^\d+(?:\.\d+)?(?:\/\d+)?/.exec(source.slice(at));
    assert.ok(number, `unreadable visible arithmetic: ${source.slice(at)}`);
    at += number[0].length;
    return sourceNumber(number[0]);
  }
  function expression() {
    let result = term();
    while (source[at] === '+' || source[at] === '-') {
      const op = source[at++], next = term();
      result = tAdd(result, op === '-' ? tNegate(next) : next);
    }
    return result;
  }
  function term() {
    let result = primary();
    while (source[at] === '×' || source[at] === '÷') {
      const op = source[at++], next = primary();
      result = op === '×' ? tMultiply(result, next) : tDivide(result, next);
    }
    return result;
  }
  const result = expression();
  assert.equal(at, source.length, source);
  return result;
}
function sourceOperands(html) {
  return [...visibleMath(html).matchAll(/\(([+-]?\d+(?:\.\d+)?(?:\/\d+)?)\)/g)].map(match => sourceNumber(match[1]));
}
function canonicalValue([n, d]) {
  let a = Math.abs(n), b = Math.abs(d);
  while (b) [a, b] = [b, a % b];
  return `${n / a}/${d / a}`;
}
const operandMultiset = values => values.map(canonicalValue).sort();
const tSum = values => values.reduce(tAdd, [0, 1]);

test('addition follows the displayed operands and covers signed, non-cancelling decimal and fraction arithmetic', () => {
  const coverage = new Set();
  for (const seed of seeds) for (const q of generateQuestions('C2-01', seed)) {
    const operands = sourceOperands(q.mathHtml);
    assert.equal(operands.length, 2);
    const [a, b] = operands, result = arithmeticFromSource(q.mathHtml);
    const kind = a[0] === 0 || b[0] === 0 ? 'zero' : a[0] * b[0] > 0 ? 'same' : result[0] === 0 ? 'cancel' : 'opposite';
    coverage.add(kind);
    if (kind === 'same') coverage.add(a[0] > 0 ? 'both-positive' : 'both-negative');
    if (kind === 'opposite') coverage.add(result[0] > 0 ? 'opposite-positive-result' : 'opposite-negative-result');
    if (visibleMath(q.mathHtml).includes('.') && result[0] !== 0) coverage.add('non-cancelling-decimal');
    if (q.mathHtml.includes('class="frac"')) coverage.add('fraction');
    const predicates = { zero: o => o.label.includes('与0相加'), same: o => o.label.startsWith('同号'), cancel: o => o.label.startsWith('互为相反数'), opposite: o => o.label.startsWith('异号且') };
    const step = q.step && optionValue(q.step.options, predicates[kind]);
    verifyDerived(q, result, step || undefined);
  }
  for (const kind of ['zero', 'same', 'cancel', 'opposite', 'both-positive', 'both-negative', 'opposite-positive-result', 'opposite-negative-result', 'non-cancelling-decimal', 'fraction']) assert.ok(coverage.has(kind), kind);
});

test('sum-change comparisons derive from the increment, and reverse tasks cover all three signs', () => {
  const reverseSigns = new Set(), symbolicSigns = new Set();
  for (const seed of seeds) {
    const questions = generateQuestions('C2-02', seed);
    for (const q of questions.slice(0, 4)) {
      const [left, right] = q.mathHtml.split('<span class="math-gap">　?　</span>');
      const operands = sourceOperands(left), increment = operands.at(-1);
      let comparison = Math.sign(increment[0]);
      if (!left.startsWith('a')) comparison = tCompare(arithmeticFromSource(left), arithmeticFromSource(right));
      else symbolicSigns.add(Math.sign(increment[0]));
      const glyph = comparison > 0 ? '＞' : comparison < 0 ? '＜' : '＝';
      const step = q.step && optionValue(q.step.options, o => o.label.startsWith('看所加数的正负'));
      verifyDerived(q, optionValue(q.input.options, o => o.label.endsWith(glyph)), step || undefined);
    }
    const reverse = questions[4], relation = /a\+b([＜＞＝])a/.exec(visibleMath(reverse.mathHtml))[1];
    const category = { '＜': '负数', '＞': '正数', '＝': '0' }[relation];
    reverseSigns.add(category);
    verifyDerived(reverse, optionValue(reverse.input.options, o => o.label === category), optionValue(reverse.step.options, o => o.label.startsWith('加正数变大')));
  }
  assert.deepEqual([...reverseSigns].sort(), ['0', '正数', '负数']);
  assert.deepEqual([...symbolicSigns].sort(), [-1, 1]);
});

test('grouping checks every signed addend exactly once and actually enforces the intended convenient groups', () => {
  for (const seed of seeds) for (const [index, q] of generateQuestions('C2-03', seed).entries()) {
    const original = sourceOperands(q.mathHtml), signature = operandMultiset(original);
    const correctStep = optionValue(q.step.options, o => {
      const candidate = sourceOperands(o.label);
      return JSON.stringify(operandMultiset(candidate)) === JSON.stringify(signature);
    });
    const label = q.step.options.find(o => o.value === correctStep).label;
    const groups = [...label.matchAll(/\[([^\]]+)\]/g)].map(match => ({ values: sourceOperands(match[1]), sum: arithmeticFromSource(match[1]) }));
    assert.equal(groups.length, 2);
    if (index === 0) assert.equal(groups[0].sum[0], 0);
    if (index === 1) { assert.ok(groups[0].values.every(([n]) => n > 0)); assert.ok(groups[1].values.every(([n]) => n < 0)); }
    if (index === 2 || index === 4) assert.ok(tEqual(groups[0].sum, [1, 1]));
    if (index === 3) assert.ok(groups.every(group => group.sum[0] === 0));
    if (index === 4) assert.ok(tEqual(groups[1].sum, [-1, 1]));
    const answer = arithmeticFromSource(q.mathHtml);
    assert.ok(tEqual(arithmeticFromSource(label), answer));
    verifyDerived(q, answer, correctStep);
    for (const option of q.step.options.filter(o => o.value !== correctStep)) assert.equal(gradeAnswer(q, { value: tText(answer), step: option.value }).correct, false, 'a correct final sum alone must not pass a wrong grouping');
  }
});

test('standard-amount tasks distinguish signed deviation totals from actual totals using visible source quantities', () => {
  const coverage = new Set();
  for (const seed of seeds) for (const q of generateQuestions('C2-04', seed)) {
    const [, countText, standardText] = /共(\d+)袋，每袋标准质量为([^千]+)千克/.exec(q.prompt);
    const count = Number(countText), standard = sourceNumber(standardText), deviations = sourceOperands(q.mathHtml);
    assert.equal(deviations.length, count);
    const delta = tSum(deviations), baseline = tMultiply(standard, [count, 1]);
    const actual = tAdd(baseline, delta), asksTotal = q.prompt.includes('实际总质量');
    assert.ok(actual[0] > 0);
    coverage.add(asksTotal ? 'actual' : 'deviation');
    coverage.add(delta[0] < 0 ? 'negative-deviation' : delta[0] > 0 ? 'positive-deviation' : 'zero-deviation');
    const correctStep = q.step && optionValue(q.step.options, o => o.label === (asksTotal ? '标准质量×袋数＋偏差和' : '只把各袋带符号偏差相加'));
    verifyDerived(q, asksTotal ? actual : delta, correctStep || undefined);
    assert.equal(q.input.unit, '千克');
    if (delta[0] === 0) assert.ok(actual[0] > 0, 'zero deviation does not mean zero actual total');
    if (q.step) assert.equal(gradeAnswer(q, { value: tText(asksTotal ? delta : actual), step: correctStep }).correct, false, 'swapping deviation and actual totals must fail');
  }
  for (const kind of ['actual', 'deviation', 'negative-deviation', 'positive-deviation', 'zero-deviation']) assert.ok(coverage.has(kind));
});

test('subtraction keeps the minuend and reverses the whole subtrahend including signed decimal/fraction values', () => {
  const coverage = new Set();
  for (const seed of seeds) for (const q of generateQuestions('C2-05', seed)) {
    const [a, b] = sourceOperands(q.mathHtml);
    const result = tAdd(a, tNegate(b));
    assert.ok(tEqual(arithmeticFromSource(q.mathHtml), result));
    coverage.add(a[0] === 0 ? 'zero-minuend' : a[0] < 0 ? 'negative-minuend' : 'positive-minuend');
    coverage.add(b[0] < 0 ? 'negative-subtrahend' : 'positive-subtrahend');
    if (result[0] === 0) coverage.add('zero-difference');
    if (visibleMath(q.mathHtml).includes('.')) coverage.add('decimal');
    if (q.mathHtml.includes('class="frac"')) coverage.add('fraction');
    const step = q.step && optionValue(q.step.options, o => {
      const terms = sourceOperands(o.label);
      return terms.length === 2 && tEqual(terms[0], a) && tEqual(terms[1], tNegate(b));
    });
    verifyDerived(q, result, step || undefined);
  }
  for (const kind of ['zero-minuend', 'negative-minuend', 'positive-minuend', 'negative-subtrahend', 'positive-subtrahend', 'zero-difference', 'decimal', 'fraction']) assert.ok(coverage.has(kind), kind);
});

test('mixed sums bind signs to whole operands and require the complete converted sequence, including zero', () => {
  for (const seed of seeds) for (const q of generateQuestions('C2-06', seed)) {
    const source = visibleMath(q.mathHtml), matches = [...source.matchAll(/\(([+-]?\d+(?:\.\d+)?(?:\/\d+)?)\)/g)];
    let end = 0;
    const converted = matches.map((match, index) => {
      const operation = source.slice(end, match.index);
      end = match.index + match[0].length;
      assert.ok(index === 0 ? operation === '' : operation === '+' || operation === '-');
      const value = sourceNumber(match[1]);
      return operation === '-' ? tNegate(value) : value;
    });
    assert.equal(end, source.length);
    const step = optionValue(q.step.options, o => {
      const candidate = sourceOperands(o.label);
      return candidate.length === converted.length && candidate.every((value, i) => tEqual(value, converted[i]));
    });
    const result = tSum(converted);
    assert.ok(tEqual(arithmeticFromSource(q.mathHtml), result));
    verifyDerived(q, result, step);
    assert.equal(new Set(q.step.options.map(o => o.label)).size, q.step.options.length);
  }
});

test('new decimal tasks really render decimal operands while fraction tasks retain fractional notation', () => {
  const decimalIndices = { 'C2-01': 4, 'C2-03': 3, 'C2-04': 1, 'C2-05': 3, 'C2-06': 3 };
  const fractionIndices = { 'C2-01': 3, 'C2-03': 2, 'C2-04': 3, 'C2-05': 4, 'C2-06': 4 };
  for (const seed of seeds) for (const [id, decimalIndex] of Object.entries(decimalIndices)) {
    const questions = generateQuestions(id, seed), decimal = questions[decimalIndex], fraction = questions[fractionIndices[id]];
    assert.match(visibleMath(decimal.mathHtml), /\d+\.\d+/, `${id} must show decimal operands to the student`);
    assert.doesNotMatch(decimal.mathHtml, /class="frac"/);
    if (decimal.step && id !== 'C2-01') for (const option of decimal.step.options) assert.match(option.label, /\d+\.\d+/);
    assert.match(fraction.mathHtml, /class="frac"/, `${id} must also keep a real fraction task`);
  }
});

test('two-point distances agree with coordinates/diagram and test candidate formulas before and after endpoint exchange', () => {
  const cases = new Set();
  function candidateValue(label, a, b) {
    return arithmeticFromSource(label.replaceAll('a', `(${tText(a)})`).replaceAll('b', `(${tText(b)})`));
  }
  for (const seed of seeds) for (const [index, q] of generateQuestions('C2-07', seed).entries()) {
    const [, aText, bText] = /^a＝(.+)，b＝(.+)$/.exec(visibleMath(q.mathHtml));
    const a = sourceNumber(aText), b = sourceNumber(bText), distance = tMagnitude(tAdd(a, tNegate(b)));
    assert.ok(distance[0] >= 0);
    assert.ok(tEqual(distance, tMagnitude(tAdd(b, tNegate(a)))));
    cases.add(a[0] * b[0] < 0 ? 'cross-origin' : a[0] < 0 ? 'negative-side' : 'positive-side');
    if (tEqual(a, b)) {
      cases.add('coincident');
      assert.equal(distance[0], 0);
      assert.match(q.prompt, /两点重合/);
      assert.equal(q.diagram.points.length, 1);
      assert.equal(q.diagram.points[0].label, 'A、B');
      assert.ok(tEqual(lineValue(q.diagram, q.diagram.points[0].position), a));
    } else {
      const pointA = q.diagram.points.find(p => p.label === 'A'), pointB = q.diagram.points.find(p => p.label === 'B');
      assert.ok(tEqual(lineValue(q.diagram, pointA.position), a));
      assert.ok(tEqual(lineValue(q.diagram, pointB.position), b));
    }
    const step = q.step && optionValue(q.step.options, o => tEqual(candidateValue(o.label, a, b), distance) && (index !== 4 || tEqual(candidateValue(o.label, b, a), distance)));
    verifyDerived(q, distance, step || undefined);
    if (index === 4) {
      cases.add('swapped');
      const justOneOrder = q.step.options.find(o => o.label === 'a−b');
      assert.ok(tEqual(candidateValue(justOneOrder.label, a, b), distance));
      assert.ok(!tEqual(candidateValue(justOneOrder.label, b, a), distance));
      assert.equal(gradeAnswer(q, { value: tText(distance), step: justOneOrder.value }).correct, false);
    }
    if (q.step) assert.match(q.solution.join(''), /有限试例.*普遍证明/);
  }
  for (const kind of ['cross-origin', 'negative-side', 'positive-side', 'coincident', 'swapped']) assert.ok(cases.has(kind));
});

test('all fourteen version 0.3 generators retain their frozen multi-seed questions unchanged', () => {
  const fingerprints = {
    'N-NEG-COMP': '2905ef1da0ea5065c9d40ea711f7524af22fffead45cfeb5413d880e301f497e',
    'A-LIKE-COMBINE': '669a16d3ee645455f5c93cf0adc3aa08c822ba03d03e45bbacbdeb2200fe1502',
    'G-BISECTOR-CALC': '8a5eae2e904b846f453e4ad0068233e326a02cd469b6dfdc70e2e5faf09fd49f',
    'C1-04': 'a8f2e3e6bbc2664c83d52ef0527bfcd0fff3487e740c88e9a37ac306a9619ce2',
    'C1-05': 'b0d780aa3dc55d3938f3e444f9705d04fdf13e1ed9f5dd39200573149efefdd5',
    'C1-06': '4f305d4cf577e95b2327bcc040e192f4b9e08aaad7acde046a7478a1c93498e1',
    'C1-07': '8205827d7b387a88a4384940e18e29364bfe338bcd0f708f5dbce1a231555e6a',
    'C1-08': '3330584b7d27cc2932910e7dde21be4441ea694a686d65cec2844de0a6039974',
    'C1-01': 'b75d2a26aebddbb2cba0306e0356029b4326edaafdffce293897fc5d9454f296',
    'C1-02': '4e75b5d1176eb5f2837af1ee6a01b8ea6e3341513809ed3c30d885edbf748288',
    'C1-03': '507fa9daf1c502ddecb66501b1a4e3ef52446f3832f3651ba9f69fabe3a4e242',
    'C1-09': '500710eb95076a0f637312d7b8debc703b244c796568489a5e3f9a620af3efc6',
    'C1-10': 'ead1b930607634616d1dd42df46fae317ef6d3e85b7080d55cecf4980c97f4a1',
    'C1-11': 'fb2639bf4622dc590b2e25bee71de31a0c7290c6a88bfc536b41ed45b56bb1ec',
  };
  for (const [id, expected] of Object.entries(fingerprints)) {
    const questions = Array.from({ length: 5 }, (_, i) => generateQuestions(id, `v030-${i}`));
    assert.equal(createHash('sha256').update(JSON.stringify(questions)).digest('hex'), expected, id);
  }
});

test('two-factor products are independently solved from actual decimal/fraction operands and signed change contexts', () => {
  const coverage = new Set(), contexts = new Set();
  for (const seed of seeds) for (const [index, q] of generateQuestions('C2-08', seed).entries()) {
    const [a, b] = sourceOperands(q.mathHtml), result = tMultiply(a, b);
    const kind = a[0] === 0 || b[0] === 0 ? 'zero' : a[0] * b[0] > 0 ? 'same' : 'different';
    coverage.add(kind);
    if (index < 4) {
      assert.ok(tEqual(arithmeticFromSource(q.mathHtml), result));
      const step = q.step && optionValue(q.step.options, o => kind === 'zero' ? o.label.startsWith('有乘数为0') : o.label.includes(kind === 'same' ? '同号' : '异号'));
      verifyDerived(q, result, step || undefined);
    } else {
      assert.ok(a[0] < 0 && b[0] > 0 && result[0] < 0);
      const weather = q.prompt.includes('气温'), unit = weather ? '℃' : '元';
      contexts.add(weather ? 'temperature' : 'price-reduction');
      assert.equal(q.input.unit, unit);
      const count = Number((weather ? /登高(\d+)千米。/ : /售出(\d+)件。/).exec(q.prompt)[1]);
      assert.ok(tEqual(b, [count, 1]));
      const per = Number((weather ? /气温变化为−(\d+)℃/ : /每件商品降价(\d+)元/).exec(q.prompt)[1]);
      assert.ok(tEqual(a, [-per, 1]));
      const step = optionValue(q.step.options, o => tEqual(arithmeticFromSource(o.label), result));
      verifyDerived(q, result, step);
      assert.match(q.prompt, /总变化量|销售额变化量/);
    }
    if (index === 0) coverage.add(a[0] < 0 ? 'both-negative' : 'both-positive');
    if (index === 1) { assert.match(q.mathHtml, /\d+\.\d+/); assert.doesNotMatch(q.mathHtml, /class="frac"/); coverage.add('decimal'); }
    if (index === 3) { assert.match(q.mathHtml, /class="frac"/); assert.ok(Math.abs(a[0]) < a[1] && Math.abs(b[0]) < b[1]); coverage.add('proper-fractions'); }
  }
  for (const kind of ['zero', 'same', 'different', 'both-negative', 'both-positive', 'decimal', 'proper-fractions']) assert.ok(coverage.has(kind));
  assert.deepEqual([...contexts].sort(), ['price-reduction', 'temperature']);
});

test('reciprocal questions use product one, cover ±1/integers/fractions/reverse tasks and never invent a reciprocal for zero', () => {
  const units = new Set(), relationKinds = new Set(), representations = new Set();
  for (const seed of seeds) {
    const questions = generateQuestions('C2-09', seed);
    for (const index of [0, 1, 3]) {
      const q = questions[index], given = sourceNumber(visibleMath(q.mathHtml));
      assert.notEqual(given[0], 0);
      const reciprocal = [given[1], given[0]];
      assert.ok(tEqual(tMultiply(given, reciprocal), [1, 1]));
      const step = q.step && optionValue(q.step.options, o => o.label.startsWith('再求一次倒数'));
      verifyDerived(q, reciprocal, step || undefined);
      if (index === 0) units.add(given[0]);
      if (index === 3) representations.add(q.mathHtml.includes('.') ? 'decimal' : 'fraction');
    }
    const judge = questions[2], pair = visibleMath(judge.mathHtml).split('　与　').map(sourceNumber);
    const yes = tEqual(tMultiply(...pair), [1, 1]);
    relationKinds.add(yes ? 'reciprocals' : pair.some(([n]) => n === 0) ? 'zero-pair' : tSum(pair)[0] === 0 ? 'opposites' : 'other');
    verifyDerived(judge, optionValue(judge.input.options, o => o.label === (yes ? '互为倒数' : '不互为倒数')));
    const zero = questions[4];
    assert.equal(zero.mathHtml, '0');
    assert.equal(zero.input.type, 'choice');
    verifyDerived(zero, optionValue(zero.input.options, o => o.label === '0没有倒数'), optionValue(zero.step.options, o => o.label.startsWith('0乘任何数都为0')));
    for (const option of zero.input.options.filter(o => o.label !== '0没有倒数')) assert.equal(gradeAnswer(zero, { value: option.value, step: zero.expected.step }).correct, false);
  }
  assert.deepEqual([...units].sort(), [-1, 1]);
  assert.deepEqual([...representations].sort(), ['decimal', 'fraction']);
  for (const kind of ['reciprocals', 'zero-pair', 'opposites', 'other']) assert.ok(relationKinds.has(kind));
});

const tProduct = values => values.reduce(tMultiply, [1, 1]);
test('multiplication grouping preserves each signed factor and verifies useful groups as well as the final product', () => {
  for (const seed of seeds) for (const [index, q] of generateQuestions('C2-10', seed).entries()) {
    const factors = sourceOperands(q.mathHtml), multiset = operandMultiset(factors), result = arithmeticFromSource(q.mathHtml);
    assert.ok(tEqual(result, tProduct(factors)));
    const step = optionValue(q.step.options, o => JSON.stringify(operandMultiset(sourceOperands(o.label))) === JSON.stringify(multiset));
    const expression = q.step.options.find(o => o.value === step).label.split('：')[1];
    const groups = [...expression.matchAll(/\[([^\]]+)\]/g)].map(match => arithmeticFromSource(match[1]));
    assert.equal(groups.length, 2);
    assert.ok(tEqual(groups[0], index === 2 ? [100, 1] : index === 4 ? [-10, 1] : [1, 1]));
    if (index === 3) assert.ok(tEqual(groups[1], [2, 1]));
    assert.ok(tEqual(arithmeticFromSource(expression), result));
    assert.match(q.step.options.find(o => o.value === step).label, /交换律与结合律/);
    verifyDerived(q, result, step);
    for (const option of q.step.options.filter(o => o.value !== step)) assert.equal(gradeAnswer(q, { value: tText(result), step: option.value }).correct, false, 'final product cannot replace a correct grouping step');
  }
});

test('product-sign tasks inspect zero before parity and derive changed signs without multiplying magnitudes', () => {
  const changedCases = new Set(), negativeCounts = new Set();
  for (const seed of seeds) for (const q of generateQuestions('C2-11', seed)) {
    const factors = sourceOperands(q.mathHtml), changed = /第(\d+)个乘数换成/.exec(q.prompt);
    if (changed) { const index = Number(changed[1]) - 1; assert.notEqual(factors[index][0], 0); factors[index] = tNegate(factors[index]); }
    const zero = factors.some(([n]) => n === 0), negatives = factors.filter(([n]) => n < 0).length;
    const category = zero ? '0' : negatives % 2 ? '负数' : '正数';
    negativeCounts.add(negatives);
    if (changed) changedCases.add(category);
    const step = q.step && optionValue(q.step.options, o => zero ? o.label.startsWith('先发现乘数0') : o.label === `先排除0，再数出${negatives}个负乘数，按${negatives % 2 ? '奇' : '偶'}数判断`);
    verifyDerived(q, optionValue(q.input.options, o => o.label === category), step || undefined);
    assert.equal(q.input.type, 'choice');
    assert.match(q.prompt, /不计算/);
  }
  assert.ok(negativeCounts.has(0) && negativeCounts.has(1) && negativeCounts.has(2) && negativeCounts.has(3));
  assert.deepEqual([...changedCases].sort(), ['0', '正数', '负数']);
});

test('distribution checks complete forward/reverse transformations and avoids numerically accidental correct distractors', () => {
  const directions = new Set();
  for (const seed of seeds) for (const q of generateQuestions('C2-12', seed)) {
    const operands = sourceOperands(q.mathHtml), reverse = q.prompt.includes('逆用'), common = operands[0];
    directions.add(reverse ? 'reverse' : 'forward');
    const terms = reverse ? operands.filter((_, i) => i % 2 === 1) : operands.slice(1);
    assert.notEqual(common[0], 0); assert.ok(!tEqual(common, [1, 1]));
    assert.ok(terms.every(([n]) => n !== 0));
    if (reverse) for (let i = 0; i < operands.length; i += 2) assert.ok(tEqual(operands[i], common));
    const result = tMultiply(common, tSum(terms));
    assert.ok(tEqual(arithmeticFromSource(q.mathHtml), result));
    const step = optionValue(q.step.options, o => {
      const values = sourceOperands(o.label);
      if (reverse) return values.length === terms.length + 1 && tEqual(values[0], common) && terms.every((term, i) => tEqual(term, values[i + 1]));
      return values.length === terms.length * 2 && terms.every((term, i) => tEqual(values[2 * i], common) && tEqual(values[2 * i + 1], term));
    });
    assert.match(q.prompt, /完整步骤/);
    verifyDerived(q, result, step);
    for (const option of q.step.options) {
      const candidate = arithmeticFromSource(option.label);
      assert.equal(tEqual(candidate, result), option.value === step, `${q.mathHtml} -> ${option.label}`);
    }
  }
  assert.deepEqual([...directions].sort(), ['forward', 'reverse']);
});

test('division derives the reciprocal of a nonzero divisor, accepts a zero dividend and identifies only divisor-zero expressions as undefined', () => {
  const coverage = new Set();
  for (const seed of seeds) {
    const questions = generateQuestions('C2-13', seed);
    for (const q of questions.slice(0, 4)) {
      const [a, b] = sourceOperands(q.mathHtml);
      assert.notEqual(b[0], 0);
      const result = tDivide(a, b);
      assert.ok(tEqual(tMultiply(result, b), a));
      assert.ok(tEqual(arithmeticFromSource(q.mathHtml), result));
      coverage.add(a[0] === 0 ? 'zero-dividend' : a[0] * b[0] > 0 ? 'same-sign' : 'opposite-sign');
      const inverse = [b[1], b[0]];
      const step = q.step && optionValue(q.step.options, o => {
        const values = sourceOperands(o.label);
        return values.length === 2 && tEqual(values[0], a) && tEqual(values[1], inverse);
      });
      verifyDerived(q, result, step || undefined);
    }
    const boundary = questions[4];
    const invalid = optionValue(boundary.input.options, o => sourceOperands(o.label)[1][0] === 0);
    const zeroDividend = boundary.input.options.filter(o => sourceOperands(o.label)[0][0] === 0);
    assert.equal(zeroDividend.length, 1);
    assert.notEqual(sourceOperands(zeroDividend[0].label)[1][0], 0);
    const step = optionValue(boundary.step.options, o => o.label === '除数不能为0；0可以作被除数');
    verifyDerived(boundary, invalid, step);
    assert.equal(gradeAnswer(boundary, { value: zeroDividend[0].value, step }).correct, false);
  }
  assert.deepEqual([...coverage].sort(), ['opposite-sign', 'same-sign', 'zero-dividend']);
});

function canonicalRatioForm(label) {
  const s = visibleMath(label);
  if (/^-?\d+$/.test(s)) return !/^-0$/.test(s);
  const fraction = /^(-?\d+)\/(\d+)$/.exec(s);
  if (!fraction) return false;
  const n = Number(fraction[1]), d = Number(fraction[2]);
  if (n === 0 || d <= 1) return false;
  let a = Math.abs(n), b = d;
  while (b) [a, b] = [b, a % b];
  return a === 1;
}
test('canonical-ratio choices require equal values and the requested integer/coprime positive-denominator form', () => {
  const cases = new Set();
  for (const seed of seeds) for (const [index, q] of generateQuestions('C2-14', seed).entries()) {
    const source = sourceNumber(visibleMath(q.mathHtml));
    const step = q.step && optionValue(q.step.options, o => o.label.startsWith('既保持原值'));
    assert.equal(q.input.type, 'choice');
    assert.match(q.prompt, /分母为正/); assert.match(q.prompt, /互质整数/); assert.match(q.prompt, /直接写整数，0写0/);
    const value = optionValue(q.input.options, o => {
      const candidate = sourceNumber(o.label);
      return candidate[1] !== 0 && tEqual(source, candidate) && canonicalRatioForm(o.label);
    });
    verifyDerived(q, value, step || undefined);
    const selected = q.input.options.find(o => o.value === value);
    assert.ok(tEqual(sourceNumber(visibleMath(selected.html)), source));
    assert.equal(new Set(q.input.options.map(o => o.label)).size, q.input.options.length);
    for (const option of q.input.options.filter(o => o.value !== value)) {
      const candidate = sourceNumber(option.label);
      const outcome = gradeAnswer(q, { value: option.value, step });
      assert.equal(outcome.valid, true, 'a legal option is a valid submission even if its shown fraction has zero denominator');
      assert.equal(outcome.correct, false);
      if (candidate[1] !== 0 && tEqual(candidate, source)) { assert.match(outcome.message, /等值.*不符合本题规范/); cases.add('equivalent-not-canonical'); }
      if (candidate[1] === 0) cases.add('zero-denominator');
    }
    if (index === 0) { assert.match(visibleMath(q.mathHtml), /^-\d+\/-\d+$/); cases.add('double-negative'); }
    if (index === 1) { assert.match(visibleMath(q.mathHtml), /^\d+\/-\d+$/); cases.add('negative-denominator'); }
    if (index === 2) { assert.match(q.mathHtml, /\d+\.\d+/); cases.add('decimal'); }
    if (index === 3) { assert.equal(selected.label, '0'); cases.add('zero'); }
    if (index === 4) { assert.match(selected.label, /^[−-]?\d+$/); cases.add('integer'); }
  }
  for (const kind of ['double-negative', 'negative-denominator', 'decimal', 'zero', 'integer', 'equivalent-not-canonical', 'zero-denominator']) assert.ok(cases.has(kind));
});

test('version 0.5 decimal tasks visibly use decimals and fraction tasks retain fractional displays', () => {
  for (const seed of seeds) {
    for (const [id, index] of [['C2-08', 1], ['C2-10', 0], ['C2-10', 4], ['C2-11', 3], ['C2-12', 4], ['C2-13', 3], ['C2-14', 2]]) {
      const q = generateQuestions(id, seed)[index];
      assert.match(q.mathHtml, /\d+\.\d+/, id);
      assert.doesNotMatch(q.mathHtml, /class="frac"/, id);
    }
    for (const [id, index] of [['C2-08', 3], ['C2-10', 3], ['C2-12', 2], ['C2-13', 1]]) assert.match(generateQuestions(id, seed)[index].mathHtml, /class="frac"/, id);
  }
});

test('all twenty-one version 0.4 generators preserve the exact frozen questions across five seeds', () => {
  const fingerprints = {
    'N-NEG-COMP': '29f67d94e794cb3370f85d2a2043edcba69f5ecfb74cfd7841e463fda76f1ad7',
    'A-LIKE-COMBINE': 'd48d9e7356f431efd5b84178edefb2699dac4357fe6515d6886c06944307e5a6',
    'G-BISECTOR-CALC': 'fc029da938bc3c16189c48c8f244354c31d9f56e9a6229b43f52db975a272d39',
    'C1-04': 'fb3f7281a133d243239d712444cddb722b174a651e38db7964e698941009b1b7',
    'C1-05': '8fe098bf744123f2fe645667587baba6c86d32aaae73c3d5aaaedf9988d3a072',
    'C1-06': 'cccdebbdd37392d399126c2fb16012848019fcbad38ad945d7a3bb7af7dbefe1',
    'C1-07': 'c289e5dea9090462bdae0c53a408ef61b925ff535a5e2150fa3e88fc7693590d',
    'C1-08': '15362ae38842023a769c3a4bad5022e2cead49ccf1ff5cc56d1862dfc0d2b2da',
    'C1-01': '0ab052bd3b10916d5555a40d78d1b7f34f191f051aa1762a4ff8d6386195c903',
    'C1-02': '01dac88ccbeb028da193b9410ee9b8a0ff0d5e7e02c8fa6a4ff3a4bcbb4c53da',
    'C1-03': '85c5f517a814bb88bf7df8969b1c2ebced35702d4aca1ed3c8a0e199777479be',
    'C1-09': 'a2aba8b21af205a5e7b0f926701355e1c16928c3d1b4ffe225a5d70a604b8166',
    'C1-10': 'daedd8ebd0c60a8b8e9602e4f50a0bd2cf7790447d810373d27874ffa25a7632',
    'C1-11': '5ba9b0567b3132a8f81b6c7d6f7c9d969a095b4ddcc7a0f521c8b32fc4d17ed1',
    'C2-01': '475105ff3bf9f943425a6b3cb9599af44ec49b3495f85cfc46e530286b6c226b',
    'C2-02': '13b9cdd52af7fb14a8d7c95a8953b2245fe865456a3b519351bb76856fca45fb',
    'C2-03': 'b1becd1fff8402ccf657dea8f3fa5815f2a828c4d6d624702b3f5bdb02a2232f',
    'C2-04': 'dcbac59feddeeb963f0b09f636a7b5ed716616648d23122a32e12e921508a0e6',
    'C2-05': 'd69b2e4672c38d8a6120f3c221230bc4370f7d0a9a24a628d07e6b2d72c5bc53',
    'C2-06': '500171fc9a6821e88c482fc37102b3128619bfc3ae3bf675fc3161eb7ffbcd2e',
    'C2-07': '2b9b17703deb77caeded92c99515d6ecaea95ecc2768c8d12a3320f09cd5527c',
  };
  for (const [id, expected] of Object.entries(fingerprints)) {
    const rounds = Array.from({ length: 5 }, (_, i) => generateQuestions(id, `v040-${i}`));
    assert.equal(createHash('sha256').update(JSON.stringify(rounds)).digest('hex'), expected, id);
  }
});
