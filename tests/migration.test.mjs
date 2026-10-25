import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { generateQuestions, publicQuestion } from '../domain/content.mjs';

const pilotIds = ['N-NEG-COMP', 'A-LIKE-COMBINE', 'G-BISECTOR-CALC'];
const foundationIds = ['C1-04', 'C1-05', 'C1-06', 'C1-07', 'C1-08'];
const chapterOneCompletionIds = ['C1-01', 'C1-02', 'C1-03', 'C1-09', 'C1-10', 'C1-11'];
const chapterTwoAdditiveIds = Array.from({ length: 7 }, (_, index) => `C2-${String(index + 1).padStart(2, '0')}`);
const legacyIds = [...pilotIds, ...foundationIds, ...chapterOneCompletionIds, ...chapterTwoAdditiveIds];
const addedIds = Array.from({ length: 7 }, (_, index) => `C2-${String(index + 8).padStart(2, '0')}`);
const archivedAt = '2026-10-23T00:00:00.000Z';

// This is a frozen schema-1 fixture, independent of the current generator. Its
// archived question ids, wording and answers must survive a content release.
function archivedQuestion(moduleId, index) {
  const common = {
    id: `archived-${moduleId}-${index + 1}`,
    moduleId,
    difficulty: index < 3 ? 'basic' : 'variation',
    prompt: `旧版原题快照 ${moduleId} 第${index + 1}题`,
  };
  if (moduleId === 'N-NEG-COMP') {
    const left = [8, 6, 10, 5, 7][index];
    const right = [3, 2, 4, 1, 2][index];
    return {
      ...common, mathHtml: `−${left}　□　−${right}`,
      input: { type: 'choice', label: '比较符号', options: [
        { value: '<', label: '小于' }, { value: '>', label: '大于' }, { value: '=', label: '等于' },
      ] },
      step: { label: '旧版关键步骤', options: [
        { value: 'farther', label: '左边负数的绝对值较大，所以数较小' },
        { value: 'nearer', label: '左边负数的绝对值较小' },
      ] },
      expected: { value: '<', step: 'farther' },
      hint: `旧版提示：比较${left}和${right}，再考虑负数。`,
      solution: [`${left}＞${right}，所以−${left}＜−${right}。`],
      answerDisplay: `−${left}＜−${right}`,
    };
  }
  if (moduleId === 'A-LIKE-COMBINE') {
    const values = ['5/2', '2', '3', '-2', '0'];
    const math = ['3x<sup>2</sup>−(1/2)x<sup>2</sup>', 'x<sup>2</sup>＋x<sup>2</sup>', '4x<sup>2</sup>−x<sup>2</sup>', 'x<sup>2</sup>−3x<sup>2</sup>', '2x<sup>2</sup>−2x<sup>2</sup>'];
    return {
      ...common, mathHtml: math[index],
      input: { type: 'number', label: '合并后的系数', suffixHtml: 'x<sup>2</sup>' },
      expected: { value: values[index] },
      hint: '旧版提示：系数相加，字母和指数不变。',
      solution: [`合并后系数为${values[index]}，字母部分x²不变；系数为0时结果为0。`],
      answerDisplay: values[index] === '0' ? '0' : `${values[index]}x²`,
    };
  }
  if (foundationIds.includes(moduleId)) return archivedFoundationQuestion(common, index);
  if (chapterOneCompletionIds.includes(moduleId)) return archivedChapterOneCompletionQuestion(common, index);
  if (chapterTwoAdditiveIds.includes(moduleId)) return archivedChapterTwoAdditiveQuestion(common, index);
  const whole = [130, 80, 100, 150, 60][index];
  return {
    ...common, mathHtml: `∠AOC＝${whole}°，∠AOB＝？`,
    input: { type: 'number', label: '角度', unit: '°' },
    diagram: { type: 'angle', angle: whole, rotation: 17, known: 'whole' },
    expected: { value: String(whole / 2) },
    hint: '旧版提示：OB平分整个角。',
    solution: [`由平分关系，∠AOB＝${whole}÷2＝${whole / 2}°。`],
    answerDisplay: `${whole / 2}°`,
  };
}

function archivedLine(min, max, labels, points = []) {
  return {
    type: 'numberline', min, max, arrow: true, originVisible: true,
    ticks: Array.from({ length: max - min + 1 }, (_, index) => {
      const position = min + index;
      return { position, ...(Object.hasOwn(labels, position) ? { label: labels[position] } : {}) };
    }),
    points: structuredClone(points),
  };
}

function archivedFoundationQuestion(common, index) {
  const step = {
    label: '旧0.2版关键步骤',
    options: [{ value: 'correct-method', label: '按原题的尺度与数学关系处理' }, { value: 'wrong-method', label: '忽略题目给出的条件' }],
  };
  let details;
  if (common.moduleId === 'C1-04') {
    const entries = [
      { mathHtml: '', diagram: { type: 'axis-check', variant: 'no-origin', unit: 0.5 }, input: { type: 'choice', label: '检查图示', options: [{ value: 'origin', label: '缺少0标记' }, { value: 'direction', label: '缺少正方向箭头' }, { value: 'spacing', label: '数值与间距不一致' }] }, expected: { value: 'origin' } },
      { mathHtml: '', diagram: { type: 'axis-check', variant: 'no-direction', unit: 2 }, input: { type: 'choice', label: '怎样修正', options: [{ value: 'origin', label: '补上0' }, { value: 'direction', label: '补上正方向箭头' }, { value: 'spacing', label: '调整间距' }] }, expected: { value: 'direction' } },
      { mathHtml: '', diagram: archivedLine(-1, 4, { 0: '0', 3: '6' }), input: { type: 'number', label: '每小格代表多少' }, expected: { value: '2' } },
      { mathHtml: '', diagram: archivedLine(-1, 4, { 0: '0', 3: '1' }), input: { type: 'number', label: '每小格代表多少' }, step, expected: { value: '1/3', step: 'correct-method' } },
      { mathHtml: '每小格代表1/2，0右边三个相邻刻度依次为？', diagram: archivedLine(-1, 4, { 0: '0' }), input: { type: 'choice', label: '连续补刻度', options: [{ value: 'half-sequence', label: '1/2，1，3/2' }, { value: 'whole-sequence', label: '1，2，3' }] }, step, expected: { value: 'half-sequence', step: 'correct-method' } },
    ];
    details = entries[index];
  } else if (common.moduleId === 'C1-05') {
    const positions = [-3, -1, 2, 4];
    const entries = [
      { mathHtml: '', diagram: archivedLine(-6, 6, { 0: '0', 1: '1' }, [{ position: -3, label: 'A' }]), input: { type: 'number', label: 'A表示的数' }, expected: { value: '-3' } },
      { mathHtml: '每小格代表1，哪个点表示2？', diagram: archivedLine(-4, 5, { 0: '0', 1: '1' }, positions.map((position, pointIndex) => ({ position, label: 'ABCD'[pointIndex] }))), input: { type: 'choice', label: '选择点', options: ['A', 'B', 'C', 'D'].map((value) => ({ value, label: `点${value}` })) }, expected: { value: 'C' } },
      { mathHtml: '', diagram: archivedLine(-6, 6, { 0: '0', 1: '1/2' }, [{ position: -3, label: 'B' }]), input: { type: 'number', label: 'B表示的数' }, expected: { value: '-3/2' } },
      { mathHtml: '', diagram: archivedLine(-6, 6, { 0: '0', 1: '1/3' }, [{ position: 4, label: 'P' }]), input: { type: 'number', label: 'P表示的数' }, step, expected: { value: '4/3', step: 'correct-method' } },
      { mathHtml: '', diagram: archivedLine(-6, 6, { 0: '0', 1: '2' }, [{ position: -2.5, label: 'M' }]), input: { type: 'number', label: 'M表示的数' }, step, expected: { value: '-5', step: 'correct-method' } },
    ];
    details = entries[index];
  } else if (common.moduleId === 'C1-06') {
    const values = ['-5', '7/10', '0', '3/4', '3/2'];
    const math = ['5的相反数', '−7/10的相反数', '0的相反数', 'a的相反数是−3/4，a＝？', 'A与B关于原点对称，B表示哪个数？'];
    details = { mathHtml: math[index], input: { type: 'number', label: '填写对应的数' }, expected: { value: values[index] } };
    if (index >= 3) { details.step = step; details.expected.step = 'correct-method'; }
    if (index === 4) details.diagram = archivedLine(-6, 6, { 0: '0', 1: '1/2' }, [{ position: -3, label: 'A' }, { position: 3, label: 'B' }]);
  } else if (common.moduleId === 'C1-07') {
    const values = ['-4', '7/10', '0', '-3/4'];
    const math = ['−(＋4)', '−(−0.7)', '−0', '−(−(−3/4))'];
    details = index < 4
      ? { mathHtml: math[index], input: { type: 'number', label: '化简结果' }, expected: { value: values[index] } }
      : { mathHtml: 'a＜0，−a是？', input: { type: 'choice', label: '判断符号', options: [{ value: 'positive', label: '正数' }, { value: 'negative', label: '负数' }, { value: 'zero', label: '0' }] }, expected: { value: 'positive' } };
    if (index >= 3) { details.step = step; details.expected.step = 'correct-method'; }
  } else {
    const values = ['4', '3/4', '0', '7/10', '5/6'];
    const math = ['|−4|', '|3/4|', '|0|', '|−(−0.7)|', '|−(＋5/6)|'];
    details = { mathHtml: math[index], input: { type: 'number', label: '绝对值' }, expected: { value: values[index] } };
    if (index >= 3) { details.step = step; details.expected.step = 'correct-method'; }
  }
  return {
    ...common, ...details,
    hint: `旧0.2版提示：保留${common.moduleId}原题的尺度、位置和符号条件。`,
    solution: [`旧0.2版原解析：按原题条件计算，答案为${details.expected.value}。`],
    answerDisplay: details.input.type === 'choice'
      ? details.input.options.find((option) => option.value === details.expected.value).label
      : details.expected.value,
  };
}

// Hand-authored 0.3 snapshots deliberately include alternate numeric forms,
// reversed real-world directions, ties, strict ordering and impossible cases.
// They remain independent of whatever the current generators now produce.
function archivedChapterOneCompletionQuestion(common, index) {
  const step = {
    label: '旧0.3版关键步骤',
    options: [{ value: 'conditions-first', label: '先核对数值、方向或限制条件' }, { value: 'ignore-conditions', label: '只看外表，忽略题目条件' }],
  };
  const choice = (entries, expected) => ({
    input: { type: 'choice', label: '选择符合条件的答案', options: entries.map(([value, label]) => ({ value, label })) },
    expected: { value: expected },
  });
  const number = (value, label = '填写对应的数') => ({ input: { type: 'number', label }, expected: { value } });
  let details;
  if (common.moduleId === 'C1-01') {
    const categories = [['positive', '正数'], ['negative', '负数'], ['zero', '0']];
    const values = ['＋2.5', '−3/4', '−0', '−100%', '0/5'];
    const expected = ['positive', 'negative', 'zero', 'negative', 'zero'];
    details = { mathHtml: `${values[index]}属于哪一类？`, ...choice(categories, expected[index]) };
  } else if (common.moduleId === 'C1-02') {
    const entries = [
      { prompt: '气温由零上3℃降到零下2℃，零下2℃怎样记？', mathHtml: '以零上为正', ...number('-2'), input: { type: 'number', label: '记录温度', unit: '℃' } },
      { prompt: '海拔记作−12米，表示什么意思？', mathHtml: '以海平面以上为正', ...choice([['below', '海平面以下12米'], ['above', '海平面以上12米'], ['zero', '恰在海平面']], 'below') },
      { prompt: '收入为正，没有收支怎样记？', mathHtml: '本次没有收支', ...number('0') },
      { prompt: '某数量增长−5%，等价于怎样变化？', mathHtml: '增长−5%', ...choice([['decrease', '减少5%'], ['increase', '增加5%'], ['same', '保持不变']], 'decrease') },
      { prompt: '规定向下为正，从基准向上4米怎样记？', mathHtml: '向下为正', ...number('-4') },
    ];
    details = entries[index];
  } else if (common.moduleId === 'C1-03') {
    const values = ['2.0', '6/3', '0/5', '100%', '−7/4'];
    details = { mathHtml: `${values[index]}按数值属于哪一类？`, ...choice([['integer', '整数'], ['fraction', '非整数的分数']], index === 4 ? 'fraction' : 'integer') };
  } else if (common.moduleId === 'C1-09') {
    const entries = [
      { mathHtml: 'A＝−2，B＝5，哪个离0更近？', ...choice([['A', 'A更近'], ['B', 'B更近'], ['equal', '一样近']], 'A') },
      { mathHtml: 'A＝−3/4，B＝1/2，哪个离0更近？', ...choice([['A', 'A更近'], ['B', 'B更近'], ['equal', '一样近']], 'B') },
      { mathHtml: '每小格代表1/2，点M离0多远？', diagram: archivedLine(-5, 5, { 0: '0', 1: '1/2' }, [{ position: -3, label: 'M' }, { position: 2, label: 'A' }]), ...number('3/2', '点M到原点的距离') },
      { mathHtml: 'A＝−0.5，B＝1/2，哪个离0更近？', ...choice([['A', 'A更近'], ['B', 'B更近'], ['equal', '一样近']], 'equal') },
      { mathHtml: 'A＝−4，B＝4，C＝1，选出所有离0最远的点。', diagram: archivedLine(-5, 5, { 0: '0', 1: '1' }, [{ position: -4, label: 'A' }, { position: 4, label: 'B' }, { position: 1, label: 'C' }]), ...choice([['AB', 'A、B'], ['A', '只有A'], ['B', '只有B'], ['ABC', 'A、B、C']], 'AB') },
    ];
    details = entries[index];
  } else if (common.moduleId === 'C1-10') {
    const entries = [
      { mathHtml: '把−2，0，3从小到大排列。', ...choice([['ascending', '−2＜0＜3'], ['descending', '3＜0＜−2'], ['zero-first', '0＜−2＜3']], 'ascending') },
      { mathHtml: '把−1/2，−3/4，0从小到大排列。', ...choice([['ascending', '−3/4＜−1/2＜0'], ['swapped', '−1/2＜−3/4＜0'], ['zero-first', '0＜−1/2＜−3/4']], 'ascending') },
      { mathHtml: '把2，−5，1从大到小排列。', ...choice([['descending', '2＞1＞−5'], ['ascending', '−5＞1＞2'], ['swapped', '1＞2＞−5']], 'descending') },
      { mathHtml: '把|−3|，−(−1)，−2从小到大排列。', ...choice([['ascending', '−2＜−(−1)＜|−3|'], ['swapped', '−(−1)＜−2＜|−3|'], ['absolute-first', '|−3|＜−(−1)＜−2']], 'ascending') },
      { mathHtml: '把−3/4，0.5，−(−2)从大到小排列。', ...choice([['descending', '−(−2)＞0.5＞−3/4'], ['swapped', '0.5＞−(−2)＞−3/4'], ['negative-first', '−3/4＞0.5＞−(−2)']], 'descending') },
    ];
    details = entries[index];
  } else {
    const entries = [
      { mathHtml: '|a|＝3，a的所有可能值为？', ...choice([['both', '3或−3'], ['positive', '只有3'], ['negative', '只有−3']], 'both') },
      { mathHtml: '|a|＝0，a＝？', ...number('0') },
      { mathHtml: '|a|＝3/4且a＜0，a＝？', ...number('-3/4') },
      { mathHtml: '|a|＝−2，有没有符合条件的数？', ...choice([['none', '没有'], ['negative', 'a＝−2'], ['both', 'a＝±2']], 'none') },
      { mathHtml: '|a|＝0且a＞0，有没有符合条件的数？', ...choice([['none', '没有'], ['zero', 'a＝0'], ['positive', 'a＝1']], 'none') },
    ];
    details = entries[index];
  }
  if (index >= 3) { details.step = step; details.expected.step = 'conditions-first'; }
  return {
    ...common, ...details,
    hint: `旧0.3版提示：${common.moduleId}先看原题的数值与全部条件。`,
    solution: [`旧0.3版原解析：按题目给出的条件判断，答案为${details.expected.value}。`],
    answerDisplay: details.input.type === 'choice'
      ? details.input.options.find((option) => option.value === details.expected.value).label
      : `${details.expected.value}${details.input.unit || ''}`,
  };
}

// Fixed 0.4 questions retain literal decimals, signed grouping expressions,
// deviation/total distinctions and scaled distance diagrams. No live generator
// supplies any part of this historical fixture.
function archivedChapterTwoAdditiveQuestion(common, index) {
  const number = (mathHtml, value, extra = {}) => ({
    mathHtml, input: { type: 'number', label: '计算结果' }, expected: { value }, ...extra,
  });
  const step = (correctLabel, wrongLabel = '丢掉符号，只计算绝对值') => ({
    label: '旧0.4版关键步骤',
    options: [{ value: 'original-method', label: correctLabel }, { value: 'changed-method', label: wrongLabel }],
  });
  const relationInput = {
    type: 'choice', label: '大小关系',
    options: [{ value: 'lt', label: '小于' }, { value: 'eq', label: '等于' }, { value: 'gt', label: '大于' }],
  };
  let details;
  if (common.moduleId === 'C2-01') {
    const math = ['(−3)＋(−4)', '(−1.3)＋(0.7)', '(0)＋(−9)', '(−2/7)＋(3/7)', '(−0.7)＋(0.7)'];
    const values = ['-7', '-3/5', '-9', '1/7', '0'];
    details = number(math[index], values[index]);
    if (index >= 3) details.step = step(index === 3 ? '异号且绝对值不同，取绝对值较大加数的符号' : '相反数相加得0');
  } else if (common.moduleId === 'C2-02') {
    const entries = [
      { mathHtml: '(−8)＋(3)　?　(−8)', input: relationInput, expected: { value: 'gt' } },
      { mathHtml: '(4)＋(−6)　?　(4)', input: relationInput, expected: { value: 'lt' } },
      { mathHtml: '(0)＋(0)　?　(0)', input: relationInput, expected: { value: 'eq' } },
      { mathHtml: 'a＋(−2/3)　?　a', input: relationInput, expected: { value: 'lt' }, step: step('加负数，和比原数小', '原数未知，所以不能比较') },
      { mathHtml: 'a＋b＜a，判断b的符号。', input: { type: 'choice', label: 'b的符号', options: [{ value: 'positive', label: '正数' }, { value: 'negative', label: '负数' }, { value: 'zero', label: '0' }] }, expected: { value: 'negative' }, step: step('和比原数小，所以b是负数', '只要有加号，b就是正数') },
    ];
    details = entries[index];
  } else if (common.moduleId === 'C2-03') {
    const entries = [
      number('(8)＋(−6)＋(−8)', '-6', { step: step('[(8)＋(−8)]＋[(−6)]', '[(8)＋(8)]＋[(−6)]') }),
      number('(4)＋(−3)＋(2)＋(−5)', '-2', { step: step('[(4)＋(2)]＋[(−3)＋(−5)]', '[(4)＋(2)]＋[(3)＋(5)]') }),
      number('(1/4)＋(−1/7)＋(3/4)', '6/7', { step: step('[(1/4)＋(3/4)]＋[(−1/7)]', '[(1/4)＋(3/4)]＋[(1/7)]') }),
      number('(0.7)＋(2.3)＋(−0.7)＋(−2.3)', '0', { step: step('[(0.7)＋(−0.7)]＋[(2.3)＋(−2.3)]', '[(0.7)＋(0.7)]＋[(2.3)＋(−2.3)]') }),
      number('(2/5)＋(−2/3)＋(3/5)＋(−1/3)', '0', { step: step('[(2/5)＋(3/5)]＋[(−2/3)＋(−1/3)]', '[(2/5)＋(3/5)]＋[(2/3)＋(1/3)]') }),
    ];
    details = entries[index];
  } else if (common.moduleId === 'C2-04') {
    const entries = [
      number('各袋偏差（千克）：(1)，(−2)，(1)', '30', { prompt: '共3袋，每袋标准10千克，求实际总质量。' }),
      number('各袋偏差（千克）：(0.2)，(−0.5)，(0.4)，(−0.1)', '80', { prompt: '共4袋，每袋标准20千克，求实际总质量。' }),
      number('各袋偏差（千克）：(2)，(−2)，(3)，(−3)', '0', { prompt: '共4袋，每袋标准10千克，只求带符号偏差和。' }),
      number('各袋偏差（千克）：(1/2)，(−1/4)，(1/4)', '31/2', { prompt: '共3袋，每袋标准5千克，求实际总质量。', step: step('5×3＋偏差和', '只把偏差和当作实际总质量') }),
      number('各袋偏差（千克）：(0)，(−1/2)，(−1/4)，(1/4)', '-1/2', { prompt: '共4袋，每袋标准5千克，只求带符号偏差和。', step: step('只把带符号偏差相加', '加上5×4得到偏差和') }),
    ];
    details = entries[index];
    details.input.unit = '千克';
  } else if (common.moduleId === 'C2-05') {
    const entries = [
      number('(−3)−(−5)', '2'), number('(2)−(7)', '-5'), number('(0)−(−4)', '4'),
      number('(1.7)−(−0.3)', '2', { step: step('(1.7)＋(0.3)', '(−1.7)＋(0.3)') }),
      number('(−3/7)−(2/7)', '-5/7', { step: step('(−3/7)＋(−2/7)', '(−3/7)＋(2/7)') }),
    ];
    details = entries[index];
  } else if (common.moduleId === 'C2-06') {
    const entries = [
      number('(−4)−(3)＋(−2)', '-9', { step: step('(−4)＋(−3)＋(−2)', '(−4)＋(3)＋(−2)') }),
      number('(5)−(−2)−(7)', '0', { step: step('(5)＋(2)＋(−7)', '(5)＋(−2)＋(7)') }),
      number('(0)−(−3)＋(4)', '7', { step: step('(0)＋(3)＋(4)', '(0)＋(−3)＋(4)') }),
      number('(−1.3)＋(0.2)−(−0.7)＋(0.4)', '0', { step: step('(−1.3)＋(0.2)＋(0.7)＋(0.4)', '(−1.3)＋(0.2)＋(−0.7)＋(0.4)') }),
      number('(2/7)−(−1/3)＋(3/7)−(−2/3)', '12/7', { step: step('(2/7)＋(1/3)＋(3/7)＋(2/3)', '(2/7)＋(−1/3)＋(3/7)＋(−2/3)') }),
    ];
    details = entries[index];
  } else {
    const entries = [
      number('A表示2，B表示5。', '3', { diagram: archivedLine(-1, 6, { 0: '0', 1: '1' }, [{ position: 2, label: 'A' }, { position: 5, label: 'B' }]) }),
      number('A表示−3，B表示−7。', '4', { diagram: archivedLine(-8, 1, { 0: '0', 1: '1' }, [{ position: -3, label: 'A' }, { position: -7, label: 'B' }]) }),
      number('A和B都表示−3，两点重合。', '0', { diagram: archivedLine(-4, 1, { 0: '0', 1: '1' }, [{ position: -3, label: 'A、B' }]) }),
      number('a＝−1/2，b＝3/2，求两点距离并检验候选式。', '2', { diagram: archivedLine(-2, 4, { 0: '0', 1: '1/2' }, [{ position: -1, label: 'A' }, { position: 3, label: 'B' }]), step: step('|a−b|', 'a−b') }),
      number('a＝2/3，b＝−4/3，交换端点后距离也应相同。', '2', { diagram: archivedLine(-5, 3, { 0: '0', 1: '1/3' }, [{ position: 2, label: 'A' }, { position: -4, label: 'B' }]), step: step('|a−b|', 'b−a') }),
    ];
    details = entries[index];
    details.input.label = '两点之间的距离';
  }
  if (details.step) details.expected.step = 'original-method';
  return {
    ...common, ...details,
    hint: `旧0.4版提示：保留${common.moduleId}题面的完整符号、单位与目标。`,
    solution: [`旧0.4版原解析：按原题计算，${details.input.label}为${details.expected.value}。`],
    answerDisplay: details.input.type === 'choice'
      ? details.input.options.find((option) => option.value === details.expected.value).label
      : `${details.expected.value}${details.input.unit || ''}`,
  };
}

function correctAnswer(question) {
  return { value: String(question.expected.value), ...(question.expected.step === undefined ? {} : { step: String(question.expected.step) }) };
}

function archivedWrongAnswer(question) {
  return {
    ...correctAnswer(question),
    value: question.input.type === 'choice' ? question.input.options.find((option) => option.value !== question.expected.value).value : '999',
  };
}

function archivedState(question, index) {
  const wrong = index === 0;
  const answer = wrong ? archivedWrongAnswer(question) : correctAnswer(question);
  const result = { valid: true, correct: !wrong, message: wrong ? '旧版反馈：再想一想。' : '旧版反馈：答对了。' };
  const requestId = `archived-first-${question.id}`;
  return {
    attemptCount: 1, firstAnswer: answer, firstCorrect: !wrong,
    independentCorrect: !wrong, usedHint: index === 2, viewedSolution: index === 2,
    completed: !wrong, latestCorrect: !wrong, completion: wrong ? null : 'independent',
    lastAnswer: answer, feedback: result.message,
    requests: { [requestId]: { signature: JSON.stringify(answer), result } },
  };
}

function archivedStore() {
  const rounds = legacyIds.map((moduleId) => {
    const questions = Array.from({ length: 5 }, (_, index) => archivedQuestion(moduleId, index));
    return {
      id: `archived-round-${moduleId}`, moduleId, seed: `unavailable-legacy-generator-${moduleId}`,
      createdAt: archivedAt, questions,
      states: Object.fromEntries(questions.map((question, index) => [question.id, archivedState(question, index)])),
    };
  });
  const mistakes = rounds.map((round) => {
    const answer = correctAnswer(round.questions[0]);
    return {
      id: `archived-mistake-${round.moduleId}`, roundId: round.id,
      questionId: round.questions[0].id, moduleId: round.moduleId, createdAt: archivedAt,
      question: structuredClone(round.questions[0]), firstAnswer: archivedWrongAnswer(round.questions[0]),
      usedHint: false, viewedSolution: false, corrected: true, correctedAt: archivedAt,
      reviewAttempts: [{ answer, correct: true, at: archivedAt }],
      requests: {
        [`archived-review-${round.questions[0].id}`]: {
          signature: JSON.stringify(answer),
          result: { valid: true, correct: true, message: '旧0.3版订正反馈：原题已订正。' },
        },
      },
    };
  });
  return {
    schemaVersion: 1,
    profiles: [
      {
        id: 'archived-family-student', name: '旧版学生', createdAt: archivedAt,
        progress: Object.fromEntries(legacyIds.map((moduleId, index) => [moduleId, { mode: 'learn', step: index % 3, updatedAt: archivedAt }])),
        rounds, mistakes,
      },
      { id: 'archived-other-student', name: '另一位旧版学生', createdAt: archivedAt, progress: {}, rounds: [], mistakes: [] },
    ],
  };
}

test('twenty-one fixed 0.4 schema-1 modules preserve original questions, diagrams, reviews and first scores when seven multiplication/division modules are added', async (t) => {
  const dataDir = await mkdtemp(path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'interactive-math-upgrade-'));
  const store = archivedStore();
  const original = structuredClone(store.profiles[0]);
  const filename = path.join(dataDir, 'learning.json');
  await writeFile(filename, JSON.stringify(store));
  let app;
  let url;
  t.after(async () => {
    if (app) await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  async function start() {
    app = await createApp({ dataDir });
    ({ url } = await app.listen(0, '127.0.0.1'));
  }
  async function request(route, body, status = 200) {
    const response = await fetch(`${url}${route}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  await start();
  const base = `/api/profiles/${original.id}`;
  const bootstrap = await request('/api/bootstrap');
  assert.deepEqual(bootstrap.modules.map((module) => module.id).sort(), [...legacyIds, ...addedIds].sort());
  assert.deepEqual(bootstrap.profiles.map((profile) => profile.id), store.profiles.map((profile) => profile.id));
  const restored = await request(base);
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), store, 'opening the new release must not rewrite historical snapshots or first scores');
  assert.deepEqual(restored.progress, original.progress);
  assert.equal(restored.rounds.length, legacyIds.length);
  assert.equal(restored.mistakes.length, legacyIds.length);

  for (const round of original.rounds) {
    const publicRound = restored.rounds.find((item) => item.id === round.id);
    assert.deepEqual(publicRound.summary, { completed: 4, total: 5, independentCorrect: 4, passed: false, finished: false });
    assert.deepEqual(publicRound.questions.map((question) => question.id), round.questions.map((question) => question.id));
    for (const [index, question] of round.questions.entries()) {
      assert.equal(publicRound.questions[index].prompt, question.prompt);
      assert.equal(publicRound.questions[index].mathHtml, question.mathHtml);
      assert.deepEqual(publicRound.questions[index].input, question.input);
      if (question.step) assert.deepEqual(publicRound.questions[index].step, question.step);
      if (question.diagram) assert.deepEqual(publicRound.questions[index].diagram, question.diagram);
      const beforePublishing = structuredClone(question);
      const published = publicQuestion(question);
      if (published.input.options) published.input.options[0].label = 'mutated public option';
      if (published.step) published.step.options[0].label = 'mutated public step';
      if (published.diagram?.type === 'numberline') {
        published.diagram.ticks[0].position = 999;
        published.diagram.ticks.push({ position: 999, label: 'mutated public tick' });
        if (published.diagram.points.length) published.diagram.points[0].label = 'mutated public point';
      } else if (published.diagram) published.diagram.type = 'mutated public diagram';
      assert.deepEqual(question, beforePublishing, 'public diagram/step/choice copies must not mutate archived records');
      assert.equal(Object.hasOwn(publicRound.questions[index], 'expected'), false);
      assert.deepEqual(publicRound.questions[index].state.firstAnswer, round.states[question.id].firstAnswer);
      assert.equal(publicRound.questions[index].state.independentCorrect, index !== 0);
    }
    // Help viewed after a historical successful first attempt must not revoke it.
    assert.equal(publicRound.questions[2].state.usedHint, true);
    assert.equal(publicRound.questions[2].state.viewedSolution, true);
    assert.equal(publicRound.questions[2].state.independentCorrect, true);
    assert.deepEqual(publicRound.questions[2].state.solution, round.questions[2].solution);

    const question = round.questions[0];
    const roundRoute = `${base}/rounds/${round.id}`;
    const submitRoute = `${roundRoute}/questions/${question.id}/submit`;
    const replay = await request(submitRoute, {
      answer: archivedWrongAnswer(question), requestId: `archived-first-${question.id}`,
    });
    assert.equal(replay.correct, false);
    assert.equal(replay.message, '旧版反馈：再想一想。');
    assert.equal(replay.round.questions[0].state.attemptCount, 1);
    assert.equal((await request(base)).mistakes.length, legacyIds.length);

    const mistake = restored.mistakes.find((item) => item.roundId === round.id);
    const archivedMistake = original.mistakes.find((item) => item.id === mistake.id);
    assert.equal(mistake.hint, question.hint);
    assert.deepEqual(mistake.solution, question.solution);
    assert.equal(mistake.answerDisplay, question.answerDisplay);
    assert.equal(mistake.question.prompt, question.prompt);
    assert.equal(mistake.corrected, true);
    assert.deepEqual(mistake.reviewAttempts, archivedMistake.reviewAttempts);
    const reviewRoute = `${base}/mistakes/${mistake.id}/review`;
    const oldReviewReplay = await request(reviewRoute, {
      answer: correctAnswer(question), requestId: `archived-review-${question.id}`,
    });
    assert.equal(oldReviewReplay.correct, true);
    assert.equal(oldReviewReplay.message, '旧0.3版订正反馈：原题已订正。');
    assert.deepEqual(oldReviewReplay.mistake.reviewAttempts, archivedMistake.reviewAttempts);
    const reviewed = await request(reviewRoute, {
      answer: correctAnswer(question), requestId: `upgrade-review-${question.id}`,
    });
    assert.equal(reviewed.correct, true);
    assert.equal(reviewed.mistake.corrected, true);
    assert.equal(reviewed.mistake.reviewAttempts.length, 2);
    assert.deepEqual(reviewed.mistake.reviewAttempts[0], archivedMistake.reviewAttempts[0]);
    const newReviewReplay = await request(reviewRoute, {
      answer: correctAnswer(question), requestId: `upgrade-review-${question.id}`,
    });
    assert.equal(newReviewReplay.mistake.reviewAttempts.length, 2);
    assert.deepEqual(await request(roundRoute), replay.round);

    const resumed = await request(submitRoute, { answer: correctAnswer(question), requestId: `upgrade-resume-${question.id}` });
    assert.equal(resumed.correct, true);
    assert.deepEqual(resumed.round.summary, { completed: 5, total: 5, independentCorrect: 4, passed: true, finished: true });
    assert.equal(resumed.round.questions[0].state.attemptCount, 2);
    assert.equal(resumed.round.questions[0].state.firstCorrect, false);
    assert.equal(resumed.round.questions[0].state.completion, 'retry');
    assert.deepEqual(resumed.round.questions[0].state.firstAnswer, archivedWrongAnswer(question));
  }

  const completedLegacy = (await request(base)).rounds;
  for (const [index, moduleId] of addedIds.entries()) {
    const round = await request(`${base}/rounds`, { moduleId }, 201);
    const firstQuestion = generateQuestions(moduleId, round.id)[0];
    const answered = await request(`${base}/rounds/${round.id}/questions/${firstQuestion.id}/submit`, {
      answer: correctAnswer(firstQuestion), requestId: `new-module-first-${moduleId}`,
    });
    assert.equal(answered.correct, true);
    assert.equal(answered.round.summary.independentCorrect, 1);
    await request(`${base}/progress`, { moduleId, mode: 'learn', step: index % 2 });
  }
  const afterNewContent = await request(base);
  for (const moduleId of legacyIds) assert.deepEqual(afterNewContent.progress[moduleId], original.progress[moduleId]);
  assert.deepEqual(afterNewContent.rounds.filter((round) => legacyIds.includes(round.moduleId)), completedLegacy);
  assert.equal(afterNewContent.rounds.length, legacyIds.length + addedIds.length);
  assert.equal(afterNewContent.mistakes.length, legacyIds.length);

  await app.close();
  await start();
  assert.deepEqual(await request(base), afterNewContent);
  for (const round of original.rounds) {
    const question = round.questions[0];
    const currentRound = afterNewContent.rounds.find((item) => item.id === round.id);
    const submitRoute = `${base}/rounds/${round.id}/questions/${question.id}/submit`;
    const historicalReplay = await request(submitRoute, {
      answer: archivedWrongAnswer(question), requestId: `archived-first-${question.id}`,
    });
    assert.equal(historicalReplay.correct, false);
    assert.equal(historicalReplay.message, '旧版反馈：再想一想。');
    assert.deepEqual(historicalReplay.round, currentRound);
    const retryReplay = await request(submitRoute, {
      answer: correctAnswer(question), requestId: `upgrade-resume-${question.id}`,
    });
    assert.equal(retryReplay.correct, true);
    assert.deepEqual(retryReplay.round, currentRound);
    const reviewReplay = await request(`${base}/mistakes/archived-mistake-${round.moduleId}/review`, {
      answer: correctAnswer(question), requestId: `archived-review-${question.id}`,
    });
    assert.equal(reviewReplay.message, '旧0.3版订正反馈：原题已订正。');
    assert.equal(reviewReplay.mistake.reviewAttempts.length, 2);
  }
  assert.deepEqual(await request(base), afterNewContent, 'request caches remain idempotent across a process restart');
  const untouched = await request('/api/profiles/archived-other-student');
  assert.deepEqual(untouched.progress, {});
  assert.deepEqual(untouched.rounds, []);
  assert.deepEqual(untouched.mistakes, []);
  const persisted = JSON.parse(await readFile(filename, 'utf8'));
  assert.equal(persisted.schemaVersion, 1);
  for (const savedRound of persisted.profiles[0].rounds.filter((round) => legacyIds.includes(round.moduleId))) {
    const previous = original.rounds.find((round) => round.id === savedRound.id);
    assert.deepEqual(savedRound.questions, previous.questions);
    for (const question of previous.questions) {
      assert.deepEqual(savedRound.states[question.id].firstAnswer, previous.states[question.id].firstAnswer);
      assert.equal(savedRound.states[question.id].firstCorrect, previous.states[question.id].firstCorrect);
      assert.equal(savedRound.states[question.id].independentCorrect, previous.states[question.id].independentCorrect);
      assert.deepEqual(savedRound.states[question.id].requests[`archived-first-${question.id}`], previous.states[question.id].requests[`archived-first-${question.id}`]);
    }
  }
  for (const mistake of persisted.profiles[0].mistakes) {
    const previous = original.mistakes.find((item) => item.id === mistake.id);
    assert.deepEqual(mistake.question, previous.question);
    assert.deepEqual(mistake.firstAnswer, previous.firstAnswer);
    assert.deepEqual(mistake.reviewAttempts[0], previous.reviewAttempts[0]);
    assert.deepEqual(mistake.requests[`archived-review-${mistake.questionId}`], previous.requests[`archived-review-${mistake.questionId}`]);
  }
});
