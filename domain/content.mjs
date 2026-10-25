// All HTML in this module is authored here. Seeds and submitted answers are
// never inserted into an HTML template.
export const modules = [
  {
    id: 'N-NEG-COMP', title: '两个负数，谁更大？', chapter: 1,
    chapterTitle: '有理数', section: '1.2.5', pages: '14—17',
    goal: '比较两个负有理数的大小。',
    lead: '零下7℃和零下3℃，哪个更冷？先猜一猜，再把两个数放到数轴上看看。',
    prerequisiteIds: ['C1-05', 'C1-08'],
    prerequisites: ['会在数轴上读数，右边的数更大。', '一个数的绝对值表示它到0的距离。'],
    rule: '两个负数比较大小，绝对值大的反而小；绝对值相等时，这两个负数也相等。',
    example: { question: '比较−7与−3的大小。', answer: '−7＜−3', steps: ['7＞3，所以−7到0的距离更远。', '−7在−3左边，因此−7＜−3。'] },
    learningSteps: [
      { title: '先做预测', prompt: '两个标记都在0左边，哪个数更大？', instruction: '先比较两个温度，想好答案后再拖动标记。' },
      { title: '动手观察', prompt: '负数离0越远，会变大还是变小？', instruction: '拖动两个负数标记，观察左右顺序与到0的距离。' },
      { title: '用规则解释', prompt: '比较负数时，为什么不能直接照搬绝对值的大小？', instruction: '先比较绝对值，再反过来填写负数之间的大小关系；两边相等时仍填等号。' },
    ],
  },
  {
    id: 'A-LIKE-COMBINE', title: '把同类项合起来', chapter: 4,
    chapterTitle: '整式的加减', section: '4.2', pages: '95—98',
    goal: '合并已给定的一组同类项，系数相加，字母与指数不变。',
    lead: '这些项的字母部分已经相同。合在一起时，什么改变，什么保持不变？',
    prerequisites: ['系数是字母部分前的数。x的系数是1，−x的系数是−1。', '给出的项已经是同类项，本项目不要求另行识别。'],
    rule: '合并同类项，只把系数相加，字母连同指数保持不变；系数和为0时，整项为0。',
    example: { question: '合并−3x²＋5x²。', answer: '2x²', steps: ['把系数相加：−3＋5＝2。', '字母部分x²保持不变，所以结果是2x²。'] },
    learningSteps: [
      { title: '看清固定部分', prompt: '这些项的字母和指数有什么共同点？', instruction: '观察每张项卡：给出的字母部分相同，暂时只看系数。' },
      { title: '合并带符号的系数', prompt: '正负系数放在一起会怎样？', instruction: '改变或合并系数，观察相加和抵消；字母部分不参与相加。' },
      { title: '写成一项', prompt: '如果系数和是1、−1或0，结果怎么写？', instruction: '系数1可以省略；−1只写负号；系数和为0时写0，不保留多余字母。' },
    ],
  },
  {
    id: 'G-BISECTOR-CALC', title: '平分一个角', chapter: 6,
    chapterTitle: '几何图形初步', section: '6.3.2', pages: '174—175',
    goal: '根据已知角平分关系，由整个角或其中一半求相关角度。',
    lead: '一条角平分线把一个角分成相等的两份。改变开口和朝向，倍半关系会改变吗？',
    prerequisites: ['∠AOC的顶点是O，两边是OA和OC。', '角平分线从角的顶点出发，将原角分成两个相等的角。'],
    rule: 'OB平分∠AOC时，∠AOB＝∠BOC＝∠AOC÷2，∠AOC＝2×∠AOB。旋转图形不会改变这个关系。',
    example: { question: 'OB平分∠AOC，∠AOC＝86°，求∠AOB。', answer: '∠AOB＝43°', steps: ['已知的是整个角，所求是它的一半。', '∠AOB＝86°÷2＝43°。'] },
    learningSteps: [
      { title: '找到两份', prompt: 'OB是角平分线，哪两个小角相等？', instruction: '认清OA、OB、OC和顶点O，观察两个小角的相等标记。' },
      { title: '改变图形', prompt: '角变大或转向后，两份还是一样大吗？', instruction: '调整整个角的开口和朝向，观察平分线跟随变化，两个小角始终相等。' },
      { title: '先认所求，再计算', prompt: '已知的是整个角，还是其中一半？', instruction: '整体求一半用÷2；一半求整体用×2；由一半求另一半，度数相同。' },
    ],
  },
  {
    id: 'C1-04', title: '认清一条数轴', chapter: 1,
    chapterTitle: '有理数', section: '1.2.2', pages: '8—10',
    goal: '根据原点、正方向、单位长度，检查并补全数轴。',
    lead: '一条有刻度的直线，就一定是数轴吗？找出0、方向和每小格表示的量。',
    prerequisiteIds: ['C1-02'],
    prerequisites: ['正负数表示相反方向，0可作为基准。', '本项目按规范画法，用0标原点，用箭头标正方向。'],
    rule: '数轴规定原点、正方向和单位长度。相等的格长应表示相等的数值增量；单位长度是表示数值1的长度，不一定等于一小格。',
    example: { question: '0到2之间分成4个等长小格，每小格代表多少？', answer: '每小格代表0.5；表示数值1的单位长度跨2小格。', steps: ['2÷4＝0.5，所以每小格代表0.5。', '0、0.5、1、1.5、2应依次对应相邻刻度。'] },
    learningSteps: [
      { title: '找全三个约定', prompt: '原点、正方向和单位长度分别在哪里？', instruction: '切换规范画法与缺少标记的图，检查是否标出0与正方向。' },
      { title: '检查等格等量', prompt: '相同的数值增量，对应的长度一样吗？', instruction: '比较相邻刻度的数值与距离，修正不一致的安排。' },
      { title: '一小格不一定是1', prompt: '每小格代表0.5或2时，单位长度在哪里？', instruction: '改变每小格表示的量，再补齐刻度；把“小格长度”与“表示1的单位长度”分清。' },
    ],
  },
  {
    id: 'C1-05', title: '数与点对上号', chapter: 1,
    chapterTitle: '有理数', section: '1.2.2', pages: '10—11',
    goal: '在给定数轴上，完成有理数与表示它的点的对应。',
    lead: '同一个点，在不同刻度尺度下可能表示不同的数。先看每小格代表多少，再读点。',
    prerequisiteIds: ['C1-03', 'C1-04'],
    prerequisites: ['数轴上向右为正方向，0左边表示负数。', '整数、小数、分数都可以表示有理数；本项目仅作必要回顾。'],
    rule: '先看原点、正方向与每小格表示的量，再按位置读数或标点。不能不看尺度就把第几格当作几。',
    example: { question: '每小格代表0.5，A在原点左边3小格，A表示哪个数？', answer: '−1.5', steps: ['A在0左边，因此表示负数。', '离0有3小格，3×0.5＝1.5，所以A表示−1.5。'] },
    learningSteps: [
      { title: '先读尺度', prompt: '从0到相邻刻度，数值增加多少？', instruction: '切换每小格表示的量，对照0与参照刻度。' },
      { title: '把数放到位置', prompt: '这个数应在0的哪边，离0几小格？', instruction: '拖动点表示给定有理数，包括负数、小数和分数。' },
      { title: '从位置读回数', prompt: '点在半格位置时，该怎样读？', instruction: '先判断方向，再结合尺度计数；练习时不把所求数直接标在点旁。' },
    ],
  },
  {
    id: 'C1-06', title: '找到相反数', chapter: 1,
    chapterTitle: '有理数', section: '1.2.3', pages: '11—12',
    goal: '求一个有理数的相反数，或由相反数确定原数。',
    lead: '从0向左右各走同样远，会得到一对什么数？如果出发点就是0呢？',
    prerequisiteIds: ['C1-05'],
    prerequisites: ['能在数轴上找到一个有理数的位置。', '相反方向与相同距离可以描述一对点的位置关系。'],
    rule: '只有符号不同的两个非零数互为相反数；0的相反数是0。一个数的相反数的相反数，还是原数。',
    example: { question: '一个数的相反数是−3/4，这个数是多少？', answer: '3/4', steps: ['原数与−3/4互为相反数。', '它在原点另一侧且到原点同样远，所以原数是3/4。'] },
    learningSteps: [
      { title: '翻到另一侧', prompt: '离原点同样远、方向相反的点在哪里？', instruction: '把数轴点关于原点翻转，比较翻转前后的数。' },
      { title: '试试0与分数', prompt: '0翻转后会移动吗？负分数翻转后呢？', instruction: '试正数、负数、0、小数与分数；到原点的距离保持，非零数换到另一侧。' },
      { title: '从相反数找原数', prompt: '已知相反数，怎样找回原数？', instruction: '再取一次相反数，观察两次翻转回到原位。' },
    ],
  },
  {
    id: 'C1-07', title: '读懂数前的负号', chapter: 1,
    chapterTitle: '有理数', section: '1.2.3', pages: '12',
    goal: '正确化简用正负号表示的相反数。',
    lead: '−(−5)里的两个负号各表示什么？把每一次“取相反数”变成一次翻转。',
    prerequisiteIds: ['C1-06'],
    prerequisites: ['给一个数取相反数，就是在它前面加负号。', '字母a可以表示正数、负数或0。'],
    rule: '外面的负号表示取括号内数的相反数。−(+a)＝−a，−(−a)＝a，−0＝0；−a的正负要看a的正负。',
    example: { question: '化简−(−0.5)。', answer: '0.5', steps: ['括号内的数是−0.5。', '再取它的相反数，得到0.5。'] },
    learningSteps: [
      { title: '从里面开始', prompt: '最里面是哪个数？', instruction: '先认清括号内的数，不把外面的负号直接当作结果为负。' },
      { title: '逐层翻转', prompt: '每多一个外部负号，会发生什么？', instruction: '由内向外，每个负号对应一次取相反数；正号保持原数。' },
      { title: '判断字母的情形', prompt: 'a是负数时，−a还是负数吗？', instruction: '分别试a为正、负、0的情形，只根据已给条件判断−a。' },
    ],
  },
  {
    id: 'C1-08', title: '把距离写成绝对值', chapter: 1,
    chapterTitle: '有理数', section: '1.2.4', pages: '13—14',
    goal: '求给定有理数或已化简数值的绝对值。',
    lead: '−4和4到0一样远。距离不带方向，用一个什么数表示这段长度？',
    prerequisiteIds: ['C1-05', 'C1-06', 'C1-07'],
    prerequisites: ['能读出数轴上的数，并求它的相反数。', '遇到括号与外部负号时，先用已学规则化简。'],
    rule: '绝对值是数轴上表示这个数的点到原点的距离。正数的绝对值是本身，负数的绝对值是相反数，0的绝对值是0；绝对值不会是负数。',
    example: { question: '求|−(−2.5)|。', answer: '2.5', steps: ['先化简绝对值内的数：−(−2.5)＝2.5。', '2.5到0的距离是2.5，所以绝对值是2.5。'] },
    learningSteps: [
      { title: '看点到0的距离', prompt: '原点左右相同距离的点，绝对值相同吗？', instruction: '拖动数轴点，观察数的正负与点到0的距离。' },
      { title: '写出分情形规则', prompt: '正数、负数和0，各怎样取绝对值？', instruction: '把带方向的数与不带方向的距离对照，特别观察0。' },
      { title: '先化简再取距离', prompt: '绝对值里面还有负号和括号时，先做什么？', instruction: '先化简内部符号，再求绝对值；本项目不反过来根据绝对值找原数。' },
    ],
  },
  {
    id: 'C1-01', title: '正数、负数与0', chapter: 1,
    chapterTitle: '有理数', section: '1.1', pages: '2—5',
    goal: '将给定数正确判为正数、负数或0。',
    lead: '正号可以省略，百分号也不决定正负。判断一个数属于哪一类，要把谁作为分界？',
    prerequisiteIds: [], prerequisites: ['认识小学学过的整数、小数、分数和百分数。', '0是正数与负数的分界。'],
    rule: '大于0的数是正数，小于0的数是负数；0既不是正数，也不是负数。省略正号不改变正数，百分数也按与0的关系判断。',
    example: { question: '把7、−0.5、0、−3%分为正数、负数和0。', answer: '7是正数；−0.5、−3%是负数；0单独一类。', steps: ['先与0比较，正号省略时仍可表示正数。', '0不能放入正数或负数；百分号不改变负号的意义。'] },
    learningSteps: [
      { title: '先看与0的关系', prompt: '哪些数大于0，哪些小于0？', instruction: '把数卡放入正数、负数和0三栏，特别观察0的归属。' },
      { title: '换个写法再判断', prompt: '省略正号或写成百分数后，类别变了吗？', instruction: '比较整数、小数、分数与百分数；负0和0仍表示同一个数。' },
      { title: '用0检验说法', prompt: '“不是正数就一定是负数”对吗？', instruction: '用0作为反例检查结论，不能把第三种情况漏掉。' },
    ],
  },
  {
    id: 'C1-02', title: '给相反的量一个符号', chapter: 1,
    chapterTitle: '有理数', section: '1.1', pages: '1—5',
    goal: '按约定的基准和正方向，用有理数表示、解释实际量或变化量。',
    lead: '同样是下降，规定下降为正时就要记正数。先读约定，再决定符号。',
    prerequisiteIds: ['C1-01'], prerequisites: ['能分清正数、负数和0。', '先明确以什么为基准，再看哪种方向规定为正。'],
    rule: '按题目明确的基准与正方向记数：与规定正方向一致记正，相反记负，没有变化或恰好等于基准记0。不能默认上升永远为正。',
    example: { question: '以开始时水位为0，规定下降为正。水位上升0.5米，变化量怎么记？', answer: '−0.5米', steps: ['题目把下降规定为正，上升与正方向相反。', '变化大小为0.5米，所以记为−0.5米。'] },
    learningSteps: [
      { title: '找到基准', prompt: '0在这里表示什么？', instruction: '切换温度、海拔、收支与标准偏差情境，先指出基准。' },
      { title: '按约定选符号', prompt: '哪种方向是正方向？', instruction: '保持量的大小，改变方向或约定，观察符号何时改变。' },
      { title: '解释带符号的量', prompt: '0或负数在这道题里是什么意思？', instruction: '把数读回情境，检查是否符合原来的基准与正方向。' },
    ],
  },
  {
    id: 'C1-03', title: '换种写法，还是同一类数', chapter: 1,
    chapterTitle: '有理数', section: '1.2.1', pages: '7—8、16、21',
    goal: '按数值把已学有理数分为整数／非整数分数，或正数／负数／0。',
    lead: '2.0、6/3、100%写法不同，却都表示整数。分类时不能只看小数点、分数线或百分号。',
    prerequisiteIds: ['C1-01'], prerequisites: ['认识整数、小数、分数和百分数的数值。', '正整数、0、负整数都是整数；分类依据是数值。'],
    rule: '有理数可以写成整数之比（分母不为0）。按数值可分成整数和非整数分数，也可按正数、负数和0分类。有限小数与无限循环小数都是有理数。',
    example: { question: '2.0、6/3、0/5、100%属于整数还是非整数分数？', answer: '四个数都属于整数。', steps: ['它们分别表示2、2、0、1，不能只看书写形式。', '“分数形式”可以表示整数；本分类中的另一类明确指非整数分数。'] },
    learningSteps: [
      { title: '先读出数值', prompt: '这个写法实际表示哪个数？', instruction: '把等值数卡放在一起，包括带小数点、分数线与百分号的写法。' },
      { title: '切换分类标准', prompt: '按整数分类和按正负分类，会得到同样的组吗？', instruction: '在两种分类图之间切换；0既是整数，又是正负分类中单独的一类。' },
      { title: '认识有理数的范围', prompt: '有限小数、无限循环小数能写成分数吗？', instruction: '有限小数用分数表示来核对；循环小数只识别其有理数归属，不在这里学习化分数算法。' },
    ],
  },
  {
    id: 'C1-09', title: '谁离0更近', chapter: 1,
    chapterTitle: '有理数', section: '1.2.4', pages: '13—14',
    goal: '根据数轴位置或数值，判断哪个数离原点更近或更远。',
    lead: '数更大，就一定离0更远吗？比较的是距离，要看绝对值。',
    prerequisiteIds: ['C1-08'], prerequisites: ['绝对值表示数到原点的距离。', '相反数位于原点两侧，到原点同样远。'],
    rule: '绝对值越小，离原点越近；绝对值越大，离原点越远。绝对值相同的数一样远；有多个并列结果时要全部保留。',
    example: { question: '−3与2，哪个离原点更近？', answer: '2离原点更近。', steps: ['它们的绝对值分别是3与2。', '2＜3，所以2离0更近；不能只按原数的正负判断距离。'] },
    learningSteps: [
      { title: '比较的是距离', prompt: '拖动一个点，它的正负与距离会怎样改变？', instruction: '观察点到0的长度，不把左右方向当作距离正负。' },
      { title: '检查相等情况', prompt: '两个点在不同侧，也可能一样远吗？', instruction: '把两点放在原点两侧相同距离处，比较绝对值。' },
      { title: '保留全部并列结果', prompt: '如果最远的距离有两个数达到，应选几个？', instruction: '先比较各自绝对值，再完整保留最近或最远的数。' },
    ],
  },
  {
    id: 'C1-10', title: '把数排好队', chapter: 1,
    chapterTitle: '有理数', section: '1.2.5', pages: '14—17、22',
    goal: '将一组给定有理数按指定大小顺序排列。',
    lead: '先确认要求从小到大还是从大到小；遇到绝对值和相反数，先化简再排队。',
    prerequisiteIds: ['C1-07', 'C1-08', 'N-NEG-COMP'], prerequisites: ['会比较负数：绝对值大的负数反而小。', '正数大于0，0大于负数；会化简相反数和绝对值。'],
    rule: '先化简各数，按数轴从左到右由小到大排列；降序反过来。正数、0、负数要一并考虑，比较负数时不能直接照搬绝对值顺序。',
    example: { question: '把−3、|−2|、0、−(+1)从小到大排列。', answer: '−3＜−(+1)＜0＜|−2|', steps: ['先化简：|−2|＝2，−(+1)＝−1。', '−3＜−1＜0＜2，再对应回原来各数的写法。'] },
    learningSteps: [
      { title: '认清排序方向', prompt: '从小到大和从大到小，连接符号分别是什么？', instruction: '切换升序与降序，观察整组顺序反转。' },
      { title: '先化简再定位', prompt: '带绝对值或外部负号的数，实际是多少？', instruction: '逐一化简，再放到数轴上；保留原来的表达式便于对应。' },
      { title: '完整检查一整列', prompt: '相邻两项都符合要求吗？', instruction: '依次检查大小关系，不因其中一对正确就认定整列正确。' },
    ],
  },
  {
    id: 'C1-11', title: '由距离找回数', chapter: 1,
    chapterTitle: '有理数', section: '1.2.4', pages: '14、23',
    goal: '根据绝对值及给定符号条件，确定全部符合条件的有理数。',
    lead: '离0有3个单位长度的数，是只有3，还是还有另一个？先找全，再按条件筛选。',
    prerequisiteIds: ['C1-06', 'C1-08'], prerequisites: ['互为相反数的两点离原点同样远。', '绝对值是距离，0到原点的距离是0。'],
    rule: '距离d＞0时，候选有−d和d；没有符号限制时两者都要保留。距离为0时只有0。再按正负等已给条件筛选，可能得到一个、两个或没有符合条件的数。',
    example: { question: '|a|＝3，没有其他符号条件，a可能是多少？', answer: 'a可能是−3或3。', steps: ['原点两侧各有一个距离为3的点。', '题目没有符号限制，所以两者都保留，不能只写正数。'] },
    learningSteps: [
      { title: '先找全部候选', prompt: '距离不是0时，原点两侧各有几个点？', instruction: '改变给定距离，先同时观察正负两个候选。' },
      { title: '按符号筛选', prompt: '加上正数或负数条件后，还剩哪个？', instruction: '先保留全部候选，再排除不符合条件的一侧。' },
      { title: '单独检查0', prompt: '距离为0时，会有两个不同的数吗？', instruction: '把两个候选合到0；若还要求正数或负数，检查是否有符合条件的数。' },
    ],
  },
  {
    id: 'C2-01', title: '把两个数相加', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.1', pages: '25—28',
    goal: '正确计算两个有理数的和。',
    lead: '先向左走3步，再向右走5步，最后在哪里？把两次有向移动与加法联系起来。',
    prerequisiteIds: ['C1-02', 'C1-05', 'C1-06', 'C1-08'],
    prerequisites: ['正负数可表示相反方向，绝对值表示大小。', '会进行小学学过的正数整数、小数和分数加减。'],
    rule: '同号相加，符号不变、绝对值相加；异号且绝对值不同，大的减小的，取绝对值较大加数的符号；相反数相加得0，与0相加不变。',
    example: { question: '计算(−3)＋5。', answer: '2', steps: ['两个加数异号，5的绝对值大，和取正号。', '5−3＝2，所以和为2。'] },
    learningSteps: [
      { title: '先用移动预测', prompt: '同向、反向移动，终点分别在哪里？', instruction: '从0开始依次完成两次有向移动，再把它们写成两个加数。' },
      { title: '归纳加法情形', prompt: '该相加还是相减，和取什么符号？', instruction: '分别试同号、异号、相反数与含0的情况，先定符号，再算绝对值。' },
      { title: '离开数轴计算', prompt: '换成小数和分数，法则还适用吗？', instruction: '用同一规则计算新题，不靠记住某个运动终点。' },
    ],
  },
  {
    id: 'C2-02', title: '加上一个数，会怎样', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.1', pages: '28',
    goal: '根据所加数的正负，判断和比原数大、小或相等。',
    lead: '不必算出具体的和，也能知道它比起点大还是小。关键看哪一个加数？',
    prerequisiteIds: ['C2-01', 'C1-10'], prerequisites: ['数轴向右的数更大，向左更小。', '知道加一个数对应从原位置再做一次有向移动。'],
    rule: '加正数，和比原数大；加负数，和比原数小；加0，和等于原数。这个规律与原数本身是正、负还是0无关。',
    example: { question: '不计算具体和，比较−8＋3与−8。', answer: '−8＋3＞−8', steps: ['所加的3是正数，数轴上从−8向右移动。', '因此和比原数−8大。'] },
    learningSteps: [
      { title: '固定起点', prompt: '原数是负数时，加正数会向哪边？', instruction: '固定一个起点，仅改变所加数，观察和与起点的位置关系。' },
      { title: '更换原数', prompt: '把起点改成正数或0，规律还成立吗？', instruction: '比较同一正、负或0增量对不同起点的影响。' },
      { title: '从变化反推', prompt: '若和比原数小，所加数应是什么符号？', instruction: '把大小关系与向左、向右、不移动对应，说明所加数的正负。' },
    ],
  },
  {
    id: 'C2-03', title: '换个分组更好算', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.1', pages: '28—30',
    goal: '利用加法交换律和结合律，选择合适分组计算多个有理数的和。',
    lead: '先把相反数放在一起，或把容易凑整的数放一组，能少算几步吗？',
    prerequisiteIds: ['C2-01'], prerequisites: ['能正确计算两个有理数的和。', '每个加数的符号必须和这个数一起移动。'],
    rule: '交换加数位置、改变加法分组不改变和；每个加数连同符号保持不变。可以优先把相反数、易凑整或同号的数分组。',
    example: { question: '怎样分组计算8＋(−6)＋(−8)？', answer: '[8＋(−8)]＋(−6)＝−6', steps: ['交换位置，把8与−8放在一起，再用结合律分组。', '相反数相加为0，剩下−6。'] },
    learningSteps: [
      { title: '找有用的组合', prompt: '哪些数相加能抵消或凑整？', instruction: '观察所有带符号数卡，先选一组有利于计算的加数。' },
      { title: '连同符号重排', prompt: '移动以后，每张数卡仍是原来的数吗？', instruction: '交换和分组时保留每个符号，不漏数、不重复数。' },
      { title: '写分组再求和', prompt: '为什么这一步与原式相等？', instruction: '先选择有效的分组步骤，再计算和；仅猜对最终答案还不够。' },
    ],
  },
  {
    id: 'C2-04', title: '偏差和不是总质量', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.1', pages: '29—30',
    goal: '用标准量×份数＋偏差和求实际总量，并区分偏差和与总量。',
    lead: '四袋都以10千克为标准。偏差和为0，实际总质量也是0吗？',
    prerequisiteIds: ['C1-02', 'C2-03'], prerequisites: ['超过标准记正，不足标准记负。', '会把多次带符号的偏差相加。'],
    rule: '偏差和表示总计超过或不足多少；实际总量＝每份标准量×份数＋偏差和。先认清题目问的是哪一个量。',
    example: { question: '3袋每袋标准10千克，偏差为＋1、−2、＋1千克，总质量多少？', answer: '30千克', steps: ['偏差和为1−2＋1＝0。', '实际总质量＝10×3＋0＝30千克，偏差为0不表示没有质量。'] },
    learningSteps: [
      { title: '选统一标准', prompt: '每份实际量由哪两部分组成？', instruction: '把每袋质量分成标准量与带符号偏差。' },
      { title: '先求偏差和', prompt: '偏差和为负数或0，分别表示什么？', instruction: '把各袋偏差相加，解释超过、不足或恰好相抵。' },
      { title: '回到实际总量', prompt: '题目要求偏差，还是实际总质量？', instruction: '求实际总量时加回所有标准量；求偏差和时不要混入标准质量。' },
    ],
  },
  {
    id: 'C2-05', title: '减去，就是加相反数', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.2', pages: '30—32',
    goal: '把减去一个有理数转为加其相反数，并正确计算差。',
    lead: '−3−(−5)中的两个减号作用相同吗？先找运算，再看减去的是哪个数。',
    prerequisiteIds: ['C1-06', 'C2-01'], prerequisites: ['会求一个数的相反数。', '知道减法可以看作加法的逆运算。'],
    rule: '减去一个数，等于加这个数的相反数：a−b＝a＋(−b)。被减数保持不变，只把减法变加法、把减数变相反数。',
    example: { question: '计算(−3)−(−5)。', answer: '(−3)＋5＝2', steps: ['运算是减法，减数是−5，它的相反数是5。', '被减数−3不变，得到(−3)＋5＝2。'] },
    learningSteps: [
      { title: '区分两种负号', prompt: '哪一个符号表示减法，哪一个属于数本身？', instruction: '先框出整个被减数与减数，不把减数的符号丢掉。' },
      { title: '只转换减数', prompt: '减去−5，对应加哪个数？', instruction: '保持被减数，改变运算并取整个减数的相反数。' },
      { title: '再用加法计算', prompt: '0减负数、较小数减较大数会得到什么？', instruction: '用同一转换规则计算整数、小数、分数的新题。' },
    ],
  },
  {
    id: 'C2-06', title: '把加减统一成和', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.2', pages: '32—34',
    goal: '把加减混合式转成带符号的和，并正确计算。',
    lead: '先让每个加数带好自己的符号，再交换位置，才不会把加减算乱。',
    prerequisiteIds: ['C2-03', 'C2-05'], prerequisites: ['减去一个数等于加它的相反数。', '会连同加数的符号交换与分组。'],
    rule: '先把每一个减法转成加相反数，保留每项应有的符号；统一成和后，可以把符号与数整体重排分组。省略括号与加号不表示可以丢掉符号。',
    example: { question: '把(−20)＋3−(−5)−7统一成和并计算。', answer: '(−20)＋3＋5＋(−7)＝−19', steps: ['减去−5转为加5，减去7转为加−7。', '把−20与−7一组，3与5一组，得到−27＋8＝−19。'] },
    learningSteps: [
      { title: '逐个转换减法', prompt: '每个减数的相反数是什么？', instruction: '先保持原顺序，把每处减法转为加法。' },
      { title: '组成带符号的和', prompt: '省略括号后，哪个符号属于哪个加数？', instruction: '把每个符号与数绑定成完整数卡，核对不漏项、不重复。' },
      { title: '重排并求和', prompt: '现在可以怎样分组简算？', instruction: '保留符号地重排，先给出正确转换步骤，再算最终结果。' },
    ],
  },
  {
    id: 'C2-07', title: '两点之间有多远', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.1.2', pages: '33',
    goal: '由数轴端点求两点距离，选择候选表达式并用新例验证。',
    lead: '教材在这里提出探究。先观察几个端点位置，猜一个表达式，再交换端点、跨过原点和重合时验证。',
    prerequisiteIds: ['C1-05', 'C1-08', 'C2-05'], prerequisites: ['距离不能是负数，交换两个端点不会改变距离。', '会计算两数之差及它的绝对值。'],
    rule: '本项目通过例子探究：两点距离可用两数之差的绝对值表示。用交换端点、跨原点和重合的新例检验；这不是教材该页直接给出的现成公式。',
    example: { question: 'A表示2，B表示−3。若先猜用a−b表示距离，交换端点后还适用吗？', answer: '两次距离都是5；差的符号会变，取绝对值后才保持非负。', steps: ['2−(−3)＝5，但交换后(−3)−2＝−5，距离不应变成负数。', '把差取绝对值，两个顺序都得到5，再用其他例子检验。'] },
    learningSteps: [
      { title: '先观察再猜想', prompt: '同侧、异侧的两点间有多少单位长度？', instruction: '先用刻度观察具体距离，提出一个可能的两数表达式。' },
      { title: '用交换端点检验', prompt: '候选表达式会因端点顺序而变成负数吗？', instruction: '交换A与B的角色，比较有向差与实际距离；用反例修正猜想。' },
      { title: '再验跨原点与重合', prompt: '新的位置或两个点重合时，猜想还成立吗？', instruction: '把同点、跨原点、分数刻度作为新例，确认距离非负且重合时为0。' },
    ],
  },
  {
    id: 'C2-08', title: '两个数相乘', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.1', pages: '38—40、47',
    goal: '正确计算两个有理数的积，并用乘法表示给定情境中的总变化。',
    lead: '让一个乘数逐次减少1，积会怎样变化？把规律延续到负数，再检查符号和大小。',
    prerequisiteIds: ['C1-08', 'C2-01'], prerequisites: ['会求绝对值，理解带符号的变化量。', '会进行小学学过的正数整数、小数与分数乘法。'],
    rule: '非零两数相乘，同号得正、异号得负，绝对值相乘；有乘数为0，积为0。实际变化先按题目规定确定每份变化的正负，再乘份数。',
    example: { question: '每登高1千米，气温变化−6℃；登高3千米，气温变化多少？', answer: '(−6)×3＝−18℃，即下降18℃。', steps: ['上升为正、下降为负，每千米的变化是−6℃。', '异号相乘得负，6×3＝18，总变化是−18℃。'] },
    learningSteps: [
      { title: '补全规律表', prompt: '乘数递减时，怎样保持运算规律一致？', instruction: '从正数和0开始补表，预测负乘数对应的积，再用不同例子核对。' },
      { title: '先符号后大小', prompt: '遇到0、同号和异号，分别先判断什么？', instruction: '先检查0，再由符号确定正负，最后将绝对值相乘。' },
      { title: '解释实际变化', prompt: '负的变化量代表减少了多少？', instruction: '把每份带符号变化乘份数，区分总变化与最后的温度或售价。' },
    ],
  },
  {
    id: 'C2-09', title: '乘成1的伙伴', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.1', pages: '40、47',
    goal: '求非零有理数的倒数，判断倒数关系并解释0没有倒数。',
    lead: '不是把两数加成0，而是让它们相乘得到1。负数的这个伙伴是什么符号？',
    prerequisiteIds: ['C2-08'], prerequisites: ['会精确计算有理数乘法。', '知道非零分数可以交换分子与分母。'],
    rule: '乘积为1的两个数互为倒数；非零数的倒数与它同号，分数可交换分子分母。1和−1的倒数都是自身；0与任何数相乘都为0，所以0没有倒数。',
    example: { question: '−2/3与哪个数互为倒数？', answer: '−3/2', steps: ['倒数要使乘积为1，负数的倒数也应为负数。', '(−2/3)×(−3/2)＝1，因此它们互为倒数。'] },
    learningSteps: [
      { title: '把乘积调成1', prompt: '换一个数，能让两个数相乘等于1吗？', instruction: '试整数与分数，观察倒数的符号和分子分母位置。' },
      { title: '区分倒数与相反数', prompt: '乘积为1与和为0要求相同吗？', instruction: '分别计算乘积和和，确认本题使用倒数关系。' },
      { title: '检查特殊边界', prompt: '±1与0分别会怎样？', instruction: '验证1与−1各自的倒数；用0的乘法解释没有任何数能与0乘成1。' },
    ],
  },
  {
    id: 'C2-10', title: '乘数换位再分组', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.1', pages: '40—43',
    goal: '利用乘法交换律与结合律，保留符号重排分组并简算多个数的积。',
    lead: '先把能乘成1或整十数的乘数放在一起，能少算几步吗？',
    prerequisiteIds: ['C2-08'], prerequisites: ['会计算两个有理数的积。', '符号属于整个乘数，移动时不能改号。'],
    rule: '乘法交换律允许交换乘数位置，结合律允许改变分组；每个原乘数连同符号都保留一次。可以优先把互为倒数、易约分或易凑整的乘数组合。',
    example: { question: '怎样分组计算2×3×0.5×(−7)？', answer: '[2×0.5]×[3×(−7)]＝−21', steps: ['用交换律与结合律，把2与0.5放一组。', '第一组得1，第二组得−21，所以积为−21。'] },
    learningSteps: [
      { title: '找方便的组合', prompt: '哪些乘数能乘成1或整十数？', instruction: '查看所有带符号乘数卡，先选有助于简算的一组。' },
      { title: '整体换位分组', prompt: '分组后，每个原乘数仍保留了吗？', instruction: '连符号一起移动，避免改号、漏乘或重复乘。' },
      { title: '解释所用运算律', prompt: '为什么这个分组与原式等价？', instruction: '选择保留原乘数的分组步骤，指出换位与分组，再计算最终积。' },
    ],
  },
  {
    id: 'C2-11', title: '只看积的符号', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.1', pages: '42—43',
    goal: '先检查0，再根据负乘数个数的奇偶判断积为正、负或0。',
    lead: '不用把所有数的大小相乘，只数负号就够了吗？还要先找一个特殊乘数。',
    prerequisiteIds: ['C2-08'], prerequisites: ['非零两数同号相乘为正，异号相乘为负。', '任何数与0相乘都得0。'],
    rule: '先检查是否含0：只要有0，积就是0。所有乘数非零时，负乘数有偶数个则积为正，有奇数个则积为负；0个负乘数也属于偶数个。',
    example: { question: '只判断(−2)×3×(−5)×(−7)的符号。', answer: '负数', steps: ['没有乘数为0，共有3个负乘数。', '3是奇数，所以积为负数，无需计算绝对值。'] },
    learningSteps: [
      { title: '先检查0', prompt: '含0时，负号个数还能决定正负吗？', instruction: '先找0；发现0就直接判定积为0。' },
      { title: '数负乘数', prompt: '不含0时，负号怎样两两抵消？', instruction: '将负乘数成对配合，比较奇数个与偶数个负乘数。' },
      { title: '改变一个符号', prompt: '把一个非零乘数改为相反数，积的符号会怎样？', instruction: '重新检查0与奇偶，只判断符号，不计算积的绝对值。' },
    ],
  },
  {
    id: 'C2-12', title: '展开与合并简算', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.1', pages: '41—43',
    goal: '正确使用分配律及其逆向形式简化数值算式并计算。',
    lead: '一个数乘一个和，可以把它分别送到每一项；相同的乘数也可以收回一次。',
    prerequisiteIds: ['C2-01', 'C2-08'], prerequisites: ['会计算带符号的加法和乘法。', '知道括号中的每一项都要参与运算。'],
    rule: '展开时，共同乘数分别与括号中的每一项相乘，保留各项符号；逆用时，把共同乘数提到括号外，其余带符号数相加。每项都参与，不漏乘、不改号。',
    example: { question: '简算(1/4＋1/6−1/2)×12。', answer: '3＋2−6＝−1', steps: ['让12分别乘括号中的三项，得到(1/4)×12＋(1/6)×12−(1/2)×12。', '分别得3、2、6，再按符号相加为−1。'] },
    learningSteps: [
      { title: '逐项展开', prompt: '括号中的每一项，都乘到了共同乘数吗？', instruction: '把共同乘数连到每个带符号项，核对没有漏项。' },
      { title: '逆向收拢', prompt: '两项或三项都有什么相同乘数？', instruction: '保留共同乘数一次，把其余各项连同符号放回括号中。' },
      { title: '选择简便路径', prompt: '先算和还是先分配，哪一条更方便？', instruction: '选择正确的展开或合并步骤，再计算整数、小数和分数算式。' },
    ],
  },
  {
    id: 'C2-13', title: '除以一个数怎样算', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.2', pages: '43—45',
    goal: '把除以非零有理数转为乘其倒数，并正确计算商。',
    lead: '什么数乘−4会得到8？从乘法的逆运算找到商，再试乘倒数。',
    prerequisiteIds: ['C2-08', 'C2-09'], prerequisites: ['会求非零数的倒数并进行有理数乘法。', '除法是乘法的逆运算。'],
    rule: '除以一个不为0的数，等于乘这个数的倒数；被除数保持不变。除数必须非0；0可以作被除数，0除以任何非零数都得0。',
    example: { question: '把8÷(−4)转成乘法并计算。', answer: '8×(−1/4)＝−2', steps: ['除数−4的倒数是−1/4，被除数8不变。', '8×(−1/4)＝−2，异号相除得到负数。'] },
    learningSteps: [
      { title: '先检查除数', prompt: '0可以在哪个位置出现？', instruction: '拒绝除数为0的运算；区分0作被除数的合法情形。' },
      { title: '乘除数的倒数', prompt: '应改成倒数，还是相反数？', instruction: '保持被除数，选择除数的倒数作为新的乘数。' },
      { title: '计算并用乘法验证', prompt: '商乘除数，能回到被除数吗？', instruction: '计算整数、小数和分数的商，再用乘法检查。' },
    ],
  },
  {
    id: 'C2-14', title: '写成规范整数之比', chapter: 2,
    chapterTitle: '有理数的运算', section: '2.2.2', pages: '44—45',
    goal: '把带符号分数或有限小数化为分母为正、整数互质的整数之比，能化为整数时直接写整数。',
    lead: '两个写法数值相同，是否都满足本项目约定的规范形式？先确定值，再检查表示。',
    prerequisiteIds: ['C1-03', 'C2-13'], prerequisites: ['有理数能写为两个整数之比，分母不能为0。', '会约分并判断分数的正负。'],
    rule: '本项目约定：分数的分子、分母是互质整数，分母为正；可化成整数时直接写整数，0写成0。先保留原值，再同时检查符号、约分与表示形式。有限小数按小数位数化为分数后约分。',
    example: { question: '按本项目规范化简(−45)/(−12)。', answer: '15/4', steps: ['分子分母同为负数，原值为正，先写成45/12。', '分子分母同除以3，得到分母正、整数互质的15/4。'] },
    learningSteps: [
      { title: '先确定原值', prompt: '负号在分子、分母或分数前，值怎样变化？', instruction: '先判断整体符号，任何合法改写都必须保持数值不变。' },
      { title: '约分并规范符号', prompt: '分母为正了吗，分子分母还有公因数吗？', instruction: '统一分母符号并约分，整数直接写整数，0直接写0。' },
      { title: '从等值写法中选择', prompt: '哪项既等值又满足规范？', instruction: '逐项检查数值和形式，有限小数先写成整数之比；分母为0的写法不成立。' },
    ],
  },
];

const abs = n => n < 0n ? -n : n;
function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1n; }
function rational(n, d = 1n) {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function parseNumber(value) {
  if (typeof value !== 'string') return null;
  const s = value.normalize('NFKC').replace(/[−﹣]/g, '-').trim();
  // Limits protect the local service from unbounded BigInt work, while still
  // accepting numbers far beyond Number.MAX_SAFE_INTEGER without rounding.
  if (!s || s.length > 260) return null;
  if (s.includes('/')) {
    const parts = s.split('/').map(x => x.trim());
    if (parts.length !== 2 || !parts.every(x => /^[+-]?\d+$/.test(x) && x.replace(/[+-]/g, '').length <= 120)) return null;
    return rational(BigInt(parts[0]), BigInt(parts[1]));
  }
  const m = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(s);
  if (!m) return null;
  const whole = m[2] || '0';
  const tail = m[4] ?? m[3] ?? '';
  if (whole.length + tail.length > 120) return null;
  const sign = m[1] === '-' ? -1n : 1n;
  return rational(sign * BigInt(whole + tail), 10n ** BigInt(tail.length));
}
const equal = (a, b) => a.n === b.n && a.d === b.d;
const compare = (a, b) => { const delta = a.n * b.d - b.n * a.d; return delta < 0n ? 'lt' : delta > 0n ? 'gt' : 'eq'; };
const encode = a => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
const negate = a => ({ n: -a.n, d: a.d });
const magnitude = a => ({ n: abs(a.n), d: a.d });
const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const relationText = { lt: '＜', eq: '＝', gt: '＞' };
const relationOptions = () => [{ value: 'lt', label: '小于 ＜' }, { value: 'eq', label: '等于 ＝' }, { value: 'gt', label: '大于 ＞' }];
const numberInput = (label, extra = {}) => ({ type: 'number', label, placeholder: '可填整数、小数或分数，如 3/4', ...extra });
function fractionHtml(n, d) {
  return `<span class="frac"><span>${String(n).replace('-', '−')}</span><span>${d}</span></span>`;
}
function numberHtml(a) { return a.d === 1n ? String(a.n).replace('-', '−') : fractionHtml(a.n, a.d); }
const display = s => String(s).replaceAll('-', '−');

function hash(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function random(seed) {
  let a = hash(seed);
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const int = (rng, low, high) => low + Math.floor(rng() * (high - low + 1));
const pick = (rng, items) => items[int(rng, 0, items.length - 1)];
function shuffle(rng, items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = int(rng, 0, i); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function resultChoices(rng, results) {
  let expected;
  const options = shuffle(rng, results).map((r, i) => {
    const value = String.fromCharCode(97 + i);
    if (r.correct) expected = value;
    return { value, label: r.text, html: r.html };
  });
  return { input: { type: 'choice', label: '选择已经合并的结果', options }, value: expected };
}

function comparisonQuestion(a, b, leftHtml, rightHtml, leftText, rightText, difficulty, withStep = false) {
  const value = compare(a, b);
  const absRelation = compare(magnitude(a), magnitude(b));
  const q = {
    difficulty, prompt: '比较两个负数的大小，选择合适的符号。',
    mathHtml: `${leftHtml}<span class="math-gap">　?　</span>${rightHtml}`,
    input: { type: 'choice', label: '两个负数的大小关系', options: relationOptions() },
    hint: '先比较两个数的绝对值。两个负数，绝对值大的反而小；绝对值相等时原数相等。',
    solution: [`两个数的绝对值分别是${encode(magnitude(a))}与${encode(magnitude(b))}。`, `绝对值的关系是${relationText[absRelation]}。`, `所以${leftText}${relationText[value]}${rightText}。`],
    answerDisplay: `${leftText}${relationText[value]}${rightText}`, expected: { value },
  };
  if (withStep) {
    q.step = { label: '关键步骤：先比较两个绝对值', options: relationOptions().map(o => ({ value: `abs-${o.value}`, label: `左边绝对值${o.label}` })) };
    q.expected.step = `abs-${absRelation}`;
  }
  return q;
}
function negatives(rng) {
  const ai = int(rng, 1, 24); let bi = int(rng, 1, 24); if (bi === ai) bi = bi % 24 + 1;
  const decimalNumerator = () => { let n; do { n = int(rng, 5, 139); } while (n % 10 === 0); return n; };
  const ad = decimalNumerator(); let bd; do { bd = decimalNumerator(); } while (bd === ad);
  const nonterminating = () => {
    let value; do { value = rational(BigInt(-int(rng, 1, 17)), BigInt(pick(rng, [3, 7, 9, 11]))); } while (value.d === 1n);
    return value;
  };
  // Distinct operand families also prevent a fraction reducing to the exact
  // same pair used by the integer/decimal question in this round.
  const af = nonterminating();
  let bf; do { bf = nonterminating(); } while (equal(af, bf));
  const mixedA = nonterminating();
  let mixedB; do { mixedB = rational(BigInt(-int(rng, 1, 29)), 10n); } while (equal(mixedA, mixedB));
  const denominator = pick(rng, [2, 4, 5, 8, 10]);
  const numerator = int(rng, 1, denominator * 3 - 1);
  const same = rational(BigInt(-numerator), BigInt(denominator));
  const decimal = String(-numerator / denominator);
  return [
    comparisonQuestion(rational(BigInt(-ai)), rational(BigInt(-bi)), `−${ai}`, `−${bi}`, `−${ai}`, `−${bi}`, 'basic'),
    comparisonQuestion(rational(BigInt(-ad), 10n), rational(BigInt(-bd), 10n), `−${(ad / 10).toFixed(1)}`, `−${(bd / 10).toFixed(1)}`, `−${(ad / 10).toFixed(1)}`, `−${(bd / 10).toFixed(1)}`, 'basic'),
    comparisonQuestion(af, bf, fractionHtml(af.n, af.d), fractionHtml(bf.n, bf.d), display(encode(af)), display(encode(bf)), 'basic'),
    comparisonQuestion(mixedA, mixedB, fractionHtml(mixedA.n, mixedA.d), display(String(Number(mixedB.n) / Number(mixedB.d))), display(encode(mixedA)), display(String(Number(mixedB.n) / Number(mixedB.d))), 'variation', true),
    comparisonQuestion(same, same, fractionHtml(-numerator, denominator), display(decimal), `−${numerator}/${denominator}`, display(decimal), 'variation', true),
  ];
}

const coefficientStep = () => ({ label: '关键步骤：合并时应怎样处理？', options: [
  { value: 'add-coefficients', label: '系数相加，字母和指数不变' },
  { value: 'add-exponents', label: '系数与指数都相加' },
  { value: 'multiply-coefficients', label: '系数相乘，字母不变' },
] });
function termHtml(c, letters, first = false) {
  const negative = c.n < 0n;
  const value = magnitude(c);
  const sign = negative ? '−' : first ? '' : '＋';
  const coefficient = equal(value, rational(1n)) ? '' : numberHtml(value);
  return `${sign}${coefficient}${letters}`;
}
function termText(c, letters) {
  if (c.n === 0n) return '0';
  if (equal(c, rational(1n))) return letters;
  if (equal(c, rational(-1n))) return `−${letters}`;
  return `${c.d === 1n ? display(c.n) : `(${display(encode(c))})`}${letters}`;
}
function combineQuestion(coefficients, suffixHtml, suffixText, difficulty) {
  const sum = coefficients.reduce(add, rational(0n));
  const expression = coefficients.map((c, i) => termHtml(c, suffixHtml, i === 0)).join('');
  const coefficientText = coefficients.map(encode).join(' ＋ ');
  return {
    difficulty, prompt: '给出的各项已经是同类项。合并后，在字母部分前填入系数。',
    mathHtml: expression, input: numberInput('合并后的系数', { suffixHtml }),
    hint: '把每一项的系数连同正负号一起相加。字母及指数保持不变；没有写出的系数可能是1或−1。',
    solution: [`系数相加：${coefficientText}＝${encode(sum)}。`, `字母部分${suffixText}不变。`, `合并结果为${termText(sum, suffixText)}。`],
    answerDisplay: termText(sum, suffixText), expected: { value: encode(sum) },
  };
}
function likeTerms(rng) {
  const c1 = int(rng, 2, 9), c2 = int(rng, 2, 8);
  const denominator = pick(rng, [3, 4, 5, 6, 8]);
  const numerator = int(rng, 1, denominator - 1);
  const cancel = rational(BigInt(int(rng, 1, 9)), BigInt(pick(rng, [2, 3, 4, 5])));
  const cancellation = combineQuestion([cancel, negate(cancel)], 'a<sup>2</sup>b', 'a²b', 'variation');
  const cancelledExpression = cancellation.mathHtml;
  const cancelledOptions = resultChoices(rng, [
    { text: '0', html: '0', correct: true },
    { text: termText(add(cancel, cancel), 'a²b'), html: termHtml(add(cancel, cancel), 'a<sup>2</sup>b', true) },
    { text: '保留原来两项，不合并', html: cancelledExpression },
    { text: 'a⁴b²', html: 'a<sup>4</sup>b<sup>2</sup>' },
  ]);
  cancellation.prompt = '给出的各项已经是同类项。选择合并成一项后的结果。';
  cancellation.input = cancelledOptions.input;
  cancellation.step = coefficientStep();
  cancellation.expected = { value: cancelledOptions.value, step: 'add-coefficients' };
  let left, right, sum;
  do { left = int(rng, 2, 10); right = int(rng, 1, 7); sum = 1 - left + right; } while (sum === 0);
  const varied = combineQuestion([rational(BigInt(-left)), rational(1n), rational(BigInt(right))], 'x<sup>2</sup>y', 'x²y', 'variation');
  const variedOptions = resultChoices(rng, [
    { text: termText(rational(BigInt(sum)), 'x²y'), html: termHtml(rational(BigInt(sum)), 'x<sup>2</sup>y', true), correct: true },
    { text: termText(rational(BigInt(sum)), 'x⁶y³'), html: termHtml(rational(BigInt(sum)), 'x<sup>6</sup>y<sup>3</sup>', true) },
    { text: termText(rational(BigInt(sum)), 'x²'), html: termHtml(rational(BigInt(sum)), 'x<sup>2</sup>', true) },
    { text: '保留原来三项，不合并', html: varied.mathHtml },
  ]);
  varied.prompt = '给出的各项已经是同类项。哪一个结果既合并了系数，又保留了字母和指数？';
  varied.input = variedOptions.input;
  varied.step = coefficientStep();
  varied.expected = { value: variedOptions.value, step: 'add-coefficients' };
  return [
    combineQuestion([rational(BigInt(c1)), rational(BigInt(c2))], 'x', 'x', 'basic'),
    combineQuestion([rational(-1n), rational(BigInt(int(rng, 2, 8)))], 'a<sup>2</sup>', 'a²', 'basic'),
    combineQuestion([rational(1n), rational(BigInt(-numerator), BigInt(denominator))], 'xy<sup>2</sup>', 'xy²', 'basic'),
    cancellation, varied,
  ];
}

function angleQuestion(whole, known, target, rotation, difficulty, withStep = false) {
  const half = whole / 2;
  const knownValue = known === 'whole' ? whole : half;
  const knownAngle = known === 'whole' ? '∠AOC' : known === 'half' ? '∠AOB' : '∠BOC';
  const targetAngle = target === 'whole' ? '∠AOC' : '∠AOB';
  const result = target === 'whole' ? whole : half;
  const operation = known === 'whole' ? 'half' : target === 'whole' ? 'double' : 'same';
  const calculation = operation === 'half' ? `${knownValue}÷2＝${result}` : operation === 'double' ? `${knownValue}×2＝${result}` : `${knownValue}＝${result}`;
  const q = {
    difficulty, prompt: `OB是∠AOC的平分线。已知${knownAngle}＝${knownValue}°，求${targetAngle}的度数。`,
    mathHtml: `${knownAngle}＝${knownValue}°，${targetAngle}＝？`,
    input: numberInput(`${targetAngle}的度数`, { unit: '°' }),
    diagram: { type: 'angle', angle: whole, rotation, known },
    hint: '先分清已知和所求：整体求一半除以2，一半求整体乘2，两半相等。',
    solution: ['OB是角平分线，所以∠AOB＝∠BOC，∠AOC＝2×∠AOB。', `${targetAngle}＝${calculation}°。`],
    answerDisplay: `${targetAngle}＝${result}°`, expected: { value: String(result) },
  };
  if (withStep) {
    q.step = { label: '关键步骤：本题应怎样求所需角？', options: [
      { value: 'half', label: '已知整体，除以2求一半' },
      { value: 'double', label: '已知一半，乘2求整体' },
      { value: 'same', label: '已知一半，另一半与它相等' },
    ] };
    q.expected.step = operation;
  }
  return q;
}
function angles(rng) {
  const rotation = () => int(rng, -10, 10) * 15;
  return [
    angleQuestion(int(rng, 20, 80) * 2, 'whole', 'half', rotation(), 'basic'),
    angleQuestion(int(rng, 12, 79) * 2, 'half', 'whole', rotation(), 'basic'),
    angleQuestion(int(rng, 10, 77) * 2, 'other-half', 'half', rotation(), 'basic'),
    angleQuestion(int(rng, 31, 149) + 0.5, 'whole', 'half', rotation(), 'variation', true),
    angleQuestion(int(rng, 15, 75) * 2 + 1, 'half', 'whole', rotation(), 'variation', true),
  ];
}

function chooseAnswer(rng, label, entries) {
  let value;
  const options = shuffle(rng, entries).map((entry, index) => {
    const key = String.fromCharCode(97 + index);
    if (entry.correct) value = key;
    return { value: key, label: entry.label, ...(entry.html === undefined ? {} : { html: entry.html }) };
  });
  return { input: { type: 'choice', label, options }, value };
}
function attachStep(rng, question, label, entries) {
  const choice = chooseAnswer(rng, label, entries);
  question.step = { label, options: choice.input.options.map(({ value, label: text }) => ({ value, label: text })) };
  question.expected.step = choice.value;
  return question;
}
function numericQuestion({ result, label = '填写答案', ...fields }) {
  const value = typeof result === 'object' ? encode(result) : String(result);
  return { ...fields, input: numberInput(label), expected: { value } };
}
function numberline(min, max, tickLabels, points = []) {
  return {
    type: 'numberline', min, max,
    ticks: Array.from({ length: Math.floor(max) - Math.ceil(min) + 1 }, (_, index) => {
      const position = Math.ceil(min) + index;
      return { position, ...(Object.hasOwn(tickLabels, position) ? { label: tickLabels[position] } : {}) };
    }),
    points: points.map(point => ({ ...point })), arrow: true, originVisible: true,
  };
}
const scaled = (unit, position) => {
  const p = parseNumber(String(position));
  return rational(unit.n * p.n, unit.d * p.d);
};
const readable = value => display(encode(value));
const axisNames = {
  valid: '原点、正方向、等格等量的刻度都已表示',
  'no-origin': '缺少表示原点的0标记',
  'no-direction': '缺少表示正方向的箭头',
  'uneven-units': '相等数值增量对应的刻度间距不相等',
};
function axisStructure(rng) {
  const variants = shuffle(rng, Object.keys(axisNames));
  const unit = pick(rng, [0.5, 1, 2, 3]);
  const firstChoice = chooseAnswer(rng, '按本项目规范画法判断', Object.entries(axisNames).map(([key, label]) => ({ label, correct: key === variants[0] })));
  const fixes = {
    valid: '保持图示：原点、正方向、等格等量的刻度已齐全',
    'no-origin': '在相应基准刻度补上0，明确原点',
    'no-direction': '在直线右端补箭头，明确正方向',
    'uneven-units': '把相等数值增量对应的刻度间距调整为相等',
  };
  const secondChoice = chooseAnswer(rng, '选择合适的处理', Object.entries(fixes).map(([key, label]) => ({ label, correct: key === variants[1] })));
  const base = {
    difficulty: 'basic', hint: '按题目约定检查：0标原点，箭头标正方向，相等的数值增量应对应相等的长度。',
  };
  const count = int(rng, 2, 4), amount = int(rng, 2, 5), known = count * amount;
  const denominator = pick(rng, [3, 4, 5, 6]);
  const numerator = int(rng, 1, denominator - 1);
  const fractionUnit = rational(BigInt(numerator), BigInt(denominator));
  const scale = numericQuestion({
    difficulty: 'variation', prompt: `图中0到${numerator}之间分成${denominator}个等长小格。每小格代表多少？`, mathHtml: '',
    diagram: numberline(-1, denominator + 1, { 0: '0', [denominator]: String(numerator) }), result: fractionUnit, label: '每小格代表的数值',
    hint: '把两个已知刻度的数值差，平均分给中间的等长小格。不要默认一小格就是1。',
    solution: [`0到${numerator}的数值差为${numerator}，分成${denominator}个等长小格。`, `每小格代表${numerator}÷${denominator}＝${readable(fractionUnit)}。`], answerDisplay: `每小格代表${readable(fractionUnit)}`,
  });
  attachStep(rng, scale, '关键步骤：怎样求每小格代表的量？', [
    { label: '两个已知刻度的数值差÷小格数', correct: true }, { label: '两个已知刻度的数值差×小格数' }, { label: '不看标注，直接认定每小格代表1' },
  ]);
  const sequenceUnit = pick(rng, [rational(1n, 2n), rational(2n), rational(3n)]);
  const sequenceText = values => values.map(readable).join('，');
  const correctSequence = [1, 2, 3].map(n => scaled(sequenceUnit, n));
  const sequenceChoice = chooseAnswer(rng, '选择从左到右应填的数', [
    { label: sequenceText(correctSequence), correct: true },
    { label: '1，2，3' },
    { label: sequenceText(correctSequence.map(negate)) },
    { label: sequenceText([1, 2, 4].map(n => scaled(sequenceUnit, n))) },
  ]);
  const sequence = {
    difficulty: 'variation', prompt: `原点右侧最先的三个刻度相邻间距相等。每小格代表${readable(sequenceUnit)}，从左到右应依次填什么数？`,
    mathHtml: '0 → □ → □ → □', diagram: numberline(-1, 4, { 0: '0' }), input: sequenceChoice.input,
    hint: '从0开始，每向右前进一小格，就增加题目规定的每格数值。',
    solution: [`每小格代表${readable(sequenceUnit)}，不能把所有图的一小格都默认成1。`, `右侧三个刻度依次是${sequenceText(correctSequence)}。`],
    answerDisplay: sequenceText(correctSequence), expected: { value: sequenceChoice.value },
  };
  attachStep(rng, sequence, '关键步骤：怎样连续补刻度？', [
    { label: '每向右一小格，增加同样的规定数值', correct: true }, { label: '无论尺度怎样，都依次填写1、2、3' }, { label: '距离原点越远，每一格增加得越多' },
  ]);
  return [
    { ...base, prompt: '按本项目约定的规范画法，用0标原点、箭头标正方向。观察图，选择正确判断。', mathHtml: '', diagram: { type: 'axis-check', variant: variants[0], unit }, input: firstChoice.input, solution: ['先检查原点与正方向的明确标记，再核对相等数值增量对应的间距。', axisNames[variants[0]] + '。'], answerDisplay: axisNames[variants[0]], expected: { value: firstChoice.value } },
    { ...base, prompt: '按用0与箭头明确标记的规范画法，应怎样处理这张图，才能满足数轴的三个约定？', mathHtml: '', diagram: { type: 'axis-check', variant: variants[1], unit }, input: secondChoice.input, solution: ['按本项目规范画法，先看0和箭头，再检查等格等量。', fixes[variants[1]] + '。'], answerDisplay: fixes[variants[1]], expected: { value: secondChoice.value } },
    numericQuestion({ ...base, prompt: `图中0到${known}之间分成${count}个等长小格。每小格代表多少？`, mathHtml: '', diagram: numberline(-1, count + 1, { 0: '0', [count]: String(known) }), result: amount, label: '每小格代表的数值', solution: [`数值差${known}被平均分成${count}份。`, `每小格代表${known}÷${count}＝${amount}；它不一定等于表示1的单位长度。`], answerDisplay: `每小格代表${amount}` }),
    scale, sequence,
  ];
}

function pointRead(rng, { point, position, unit, difficulty, withStep = false }) {
  const result = scaled(unit, position);
  const q = numericQuestion({
    difficulty, prompt: `数轴向右为正方向，每小格代表${readable(unit)}。图中${point}点表示哪个数？`, mathHtml: '',
    diagram: numberline(-6, 6, { 0: '0', 1: readable(unit) }, [{ position, label: point }]), result, label: `${point}点表示的数`,
    hint: '先看0与每小格代表的量，再看点在原点哪一侧、相隔多少小格；半格也要计入。',
    solution: [`${point}位于原点${position < 0 ? '左' : '右'}侧，距原点${Math.abs(position)}小格。`, `每小格代表${readable(unit)}，所以该点表示${readable(result)}。`], answerDisplay: `${point}表示${readable(result)}`,
  });
  if (withStep) attachStep(rng, q, '关键步骤：应怎样结合位置与尺度读数？', [
    { label: '先看每小格代表的量，再按左右方向和格数读数', correct: true },
    { label: '忽略每小格代表的量，把小格数直接当作数值' },
    { label: '只算到原点的距离，不管点在左边还是右边' },
  ]);
  return q;
}
function pointsAndNumbers(rng) {
  const positions = [-3, -1, 2, 4];
  const letters = shuffle(rng, ['A', 'B', 'C', 'D']);
  const selected = int(rng, 0, positions.length - 1);
  const target = positions[selected];
  const pointChoice = chooseAnswer(rng, '选择对应的点', letters.map((letter, index) => ({ label: `点${letter}`, correct: index === selected })));
  return [
    pointRead(rng, { point: 'A', position: pick(rng, [-4, -3, 2, 3, 4]), unit: rational(1n), difficulty: 'basic' }),
    { difficulty: 'basic', prompt: `每小格代表1。在图中的A、B、C、D四个点中，哪一个表示${target}？`, mathHtml: '', diagram: numberline(-4, 5, { 0: '0', 1: '1' }, positions.map((position, index) => ({ position, label: letters[index] }))), input: pointChoice.input, hint: '正数在原点右侧，负数在左侧，再按每格1找到位置。', solution: [`${target}在原点${target < 0 ? '左' : '右'}侧${Math.abs(target)}小格处。`, `对应图中的点${letters[selected]}。`], answerDisplay: `点${letters[selected]}`, expected: { value: pointChoice.value } },
    pointRead(rng, { point: 'B', position: pick(rng, [-5, -3, 3, 5]), unit: rational(1n, 2n), difficulty: 'basic' }),
    pointRead(rng, { point: 'P', position: pick(rng, [-4, -2, 2, 4]), unit: rational(1n, 3n), difficulty: 'variation', withStep: true }),
    pointRead(rng, { point: 'M', position: pick(rng, [-2.5, -1.5, 1.5, 2.5]), unit: rational(2n), difficulty: 'variation', withStep: true }),
  ];
}

function oppositeQuestion(value, difficulty, reverse = false) {
  const result = negate(value);
  return numericQuestion({
    difficulty, prompt: reverse ? '已知一个数的相反数如下，求这个数。' : '求下面这个数的相反数。',
    mathHtml: reverse ? `a的相反数是${numberHtml(value)}，a＝？` : numberHtml(value), result,
    hint: '非零数取相反数，符号改变、到原点的距离不变；0的相反数仍是0。反过来找原数，也再取一次相反数。',
    solution: [reverse ? '原数与已知的数互为相反数。' : '先看原数的正负；0单独考虑。', `${readable(value)}的相反数是${readable(result)}。`], answerDisplay: readable(result),
  });
}
function opposites(rng) {
  const reverseValue = rational(BigInt(-int(rng, 1, 7)), BigInt(pick(rng, [3, 4, 5, 8])));
  const reverse = oppositeQuestion(reverseValue, 'variation', true);
  attachStep(rng, reverse, '关键步骤：怎样由相反数找原数？', [
    { label: '再取一次相反数，就回到原数', correct: true }, { label: '始终保留已知数的符号' }, { label: '直接把已知数乘2' },
  ]);
  const position = pick(rng, [-5, -3, 3, 5]);
  const source = rational(BigInt(position), 2n);
  const geometric = numericQuestion({
    difficulty: 'variation', prompt: `A点表示${readable(source)}。A与B在原点两侧，且到原点同样远，B表示哪个数？`, mathHtml: '',
    diagram: numberline(-6, 6, { 0: '0', 1: '1/2' }, [{ position, label: 'A' }, { position: -position, label: 'B' }]), result: negate(source), label: 'B点表示的数',
    hint: 'B与A关于原点对称；两数互为相反数，保持到0的距离，只改变方向。',
    solution: ['A与B在原点两侧且到原点同样远，因此它们表示的数互为相反数。', `A表示${readable(source)}，所以B表示${readable(negate(source))}。`], answerDisplay: `B表示${readable(negate(source))}`,
  });
  attachStep(rng, geometric, '关键步骤：相反数在数轴上怎样对应？', [
    { label: '到原点距离不变，换到原点另一侧', correct: true }, { label: '到原点距离加倍，仍在原来一侧' }, { label: '不改变表示的数，只换点的名称' },
  ]);
  return [
    oppositeQuestion(rational(BigInt(int(rng, 2, 19))), 'basic'),
    oppositeQuestion(rational(BigInt(-pick(rng, [3, 7, 13, 17, 23, 27, 35])), 10n), 'basic'),
    oppositeQuestion(rational(0n), 'basic'), reverse, geometric,
  ];
}

function signedExpression(value, depth, innerSign = '-') {
  let html = numberHtml(magnitude(value));
  for (let i = 0; i < depth; i++) html = `${i === 0 && innerSign === '+' ? '＋' : '−'}(${html})`;
  return html;
}
function signQuestion(html, result, difficulty) {
  return numericQuestion({
    difficulty, prompt: '化简下面用正负号表示的数。', mathHtml: html, result,
    hint: '从最里面开始：正号保持原数，每个负号取一次相反数；0取相反数仍是0。',
    solution: ['从内向外逐层取相反数，不把外层负号直接当作最终结果的符号。', `化简结果为${readable(result)}。`], answerDisplay: readable(result),
  });
}
function signSimplification(rng) {
  const positive = rational(BigInt(int(rng, 2, 18)));
  const decimal = rational(BigInt(pick(rng, [3, 7, 13, 17, 23, 27, 35])), 10n);
  const fraction = rational(BigInt(int(rng, 1, 7)), BigInt(pick(rng, [3, 4, 5, 8])));
  const depth = pick(rng, [3, 4]);
  const nested = signQuestion(signedExpression(fraction, depth), depth % 2 ? negate(fraction) : fraction, 'variation');
  attachStep(rng, nested, '关键步骤：从内向外一共取几次相反数？', [2, 3, 4].map(n => ({ label: `取相反数${n}次`, correct: n === depth })));
  const sign = pick(rng, ['positive', 'negative', 'zero']);
  const signNames = { positive: '正数', negative: '负数', zero: '0' };
  const oppositeSign = { positive: 'negative', negative: 'positive', zero: 'zero' };
  const signChoice = chooseAnswer(rng, '选择−a的情况', Object.entries(signNames).map(([key, label]) => ({ label, correct: key === oppositeSign[sign] })));
  const symbolic = {
    difficulty: 'variation', prompt: `已知a是${signNames[sign]}，−a是正数、负数还是0？`, mathHtml: `a${sign === 'positive' ? '＞' : sign === 'negative' ? '＜' : '＝'}0，−a是？`, input: signChoice.input,
    hint: '−a表示a的相反数。先看题目对a的符号给了什么条件。',
    solution: [`题目已知a是${signNames[sign]}，外面的负号表示取它的相反数。`, `所以−a是${signNames[oppositeSign[sign]]}。`], answerDisplay: `−a是${signNames[oppositeSign[sign]]}`, expected: { value: signChoice.value },
  };
  attachStep(rng, symbolic, '关键步骤：字母前的负号表示什么？', [
    { label: '取a的相反数，须结合a的已知符号', correct: true }, { label: '只要前面有负号，就一定表示负数' }, { label: '忽略已知条件，直接认定a是正数' },
  ]);
  return [signQuestion(`−(＋${numberHtml(positive)})`, negate(positive), 'basic'), signQuestion(signedExpression(decimal, 2), decimal, 'basic'), signQuestion('−0', rational(0n), 'basic'), nested, symbolic];
}

function absoluteQuestion(html, inner, difficulty) {
  const result = magnitude(inner);
  return numericQuestion({
    difficulty, prompt: '求下面这个数的绝对值；如有内部正负号，先化简。', mathHtml: `|${html}|`, result,
    hint: '先得到绝对值里面的数，再求它到原点的距离。距离不能是负数，0到原点的距离是0。',
    solution: [`绝对值里面的数化简为${readable(inner)}。`, `它到原点的距离是${readable(result)}，所以绝对值为${readable(result)}。`], answerDisplay: readable(result),
  });
}
function absoluteValues(rng) {
  const negative = rational(BigInt(-int(rng, 2, 19)));
  const decimal = rational(BigInt(pick(rng, [3, 7, 13, 17, 23, 27, 35])), 10n);
  const fraction = rational(BigInt(pick(rng, [1, 3, 5, 7])), BigInt(pick(rng, [4, 6, 8])));
  const simplified = absoluteQuestion(signedExpression(decimal, 2), decimal, 'variation');
  const stepChoices = chooseAnswer(rng, '先化简绝对值内的数', [
    { label: readable(decimal), correct: true }, { label: readable(negate(decimal)) }, { label: '0' },
  ]);
  simplified.step = { label: stepChoices.input.label, options: stepChoices.input.options.map(({ value, label }) => ({ value, label })) };
  simplified.expected.step = stepChoices.value;
  const mixedSigns = absoluteQuestion(`−(＋${numberHtml(fraction)})`, negate(fraction), 'variation');
  attachStep(rng, mixedSigns, '关键步骤：怎样理解绝对值的结果？', [
    { label: '它是到原点的距离，结果不能是负数', correct: true }, { label: '绝对值等于本身的数一定是正数，0不算' }, { label: '负数到原点的距离也应写成负数' },
  ]);
  return [
    absoluteQuestion(numberHtml(negative), negative, 'basic'),
    absoluteQuestion(numberHtml(fraction), fraction, 'basic'),
    absoluteQuestion('0', rational(0n), 'basic'), simplified, mixedSigns,
  ];
}

// Authored representations retain their written form while carrying an exact
// value privately during generation. No representation parser is exposed as
// a new answer type: all result lists and classifications use choice inputs.
function represented(text) {
  const percent = text.endsWith('%');
  const source = percent ? text.slice(0, -1) : text;
  let value = parseNumber(source);
  if (percent) value = rational(value.n, value.d * 100n);
  const parts = text.includes('/') ? text.split('/') : null;
  return { text: display(text), html: parts ? fractionHtml(parts[0], parts[1]) : display(text), value };
}
const signCategory = value => value.n > 0n ? '正数' : value.n < 0n ? '负数' : '0';
function categoryQuestion(rng, source, kind, difficulty) {
  const integer = source.value.d === 1n;
  const category = kind === 'integer' ? integer ? '整数' : '非整数分数' : signCategory(source.value);
  const labels = kind === 'integer' ? ['整数', '非整数分数'] : ['正数', '负数', '0'];
  const chosen = chooseAnswer(rng, '选择数值所属类别', labels.map(label => ({ label, correct: label === category })));
  return {
    difficulty, prompt: kind === 'integer' ? '按实际数值判断，下面的数属于整数还是非整数分数？' : '下面的数是正数、负数还是0？',
    mathHtml: source.html, input: chosen.input,
    hint: kind === 'integer' ? '先看这个写法实际表示的数值。分数线、小数点和百分号都不能单独决定类别。' : '先看它与0的关系。正号可以省略；0既不是正数，也不是负数。',
    solution: [`${source.text}表示的数值为${readable(source.value)}。`, `因此属于${category}。`],
    answerDisplay: category, expected: { value: chosen.value },
  };
}
function signsAndZero(rng) {
  const positive = represented(pick(rng, [String(int(rng, 1, 28)), `${int(rng, 1, 9)}.5`]));
  const negative = represented(`-${int(rng, 1, 7)}/${pick(rng, [3, 4, 5, 8])}`);
  const zero = represented(pick(rng, ['0', '-0', '+0', '0%', '0/5']));
  const percent = represented(`${pick(rng, ['', '-', '+'])}${int(rng, 1, 95)}%`);
  const percentage = categoryQuestion(rng, percent, 'sign', 'variation');
  attachStep(rng, percentage, '关键步骤：百分数的正负怎样判断？', [
    { label: '仍看它与0的关系，百分号不决定正负', correct: true }, { label: '只要有百分号就一定是正数' }, { label: '忽略负号，只看数字大小' },
  ]);
  const claim = pick(rng, ['不是正数的数一定是负数', '不是负数的数一定是正数']);
  const claimChoice = chooseAnswer(rng, '选择正确判断', [
    { label: '不对，0既不是正数，也不是负数', correct: true },
    { label: '对，所有数只分成正数和负数两类' },
    { label: '对，因为0同时属于正数和负数' },
  ]);
  const counterexample = {
    difficulty: 'variation', prompt: `“${claim}。”这句话对吗？`, mathHtml: '', input: claimChoice.input,
    hint: '检查0能否成为这句话的反例，不要漏掉0这一类。',
    solution: ['0既不是正数，也不是负数。', '把0代入这句话，就能发现它不成立。'], answerDisplay: '不对，0是反例', expected: { value: claimChoice.value },
  };
  attachStep(rng, counterexample, '关键步骤：应用哪个数检查这句话？', [
    { label: '用0检查，因为0既非正数也非负数', correct: true }, { label: '只检查任意一个正数就足够' }, { label: '只看数字前有没有写加号' },
  ]);
  return [categoryQuestion(rng, positive, 'sign', 'basic'), categoryQuestion(rng, negative, 'sign', 'basic'), categoryQuestion(rng, zero, 'sign', 'basic'), percentage, counterexample];
}

function contextNumber(fields, result, unit, reasoning) {
  const question = numericQuestion({ ...fields, result, label: `带符号的数值（${unit}）`, hint: '先找基准和题目规定的正方向，再判断这个量与正方向相同还是相反；没有变化或恰好等于基准时记0。', solution: [reasoning, `应记为${readable(result)}${unit}。`], answerDisplay: `${readable(result)}${unit}` });
  question.input.unit = unit;
  return question;
}
function contextualSigns(rng) {
  const temperature = int(rng, 1, 19), below = rng() < 0.5;
  const elevation = int(rng, 1, 30) * 10, lower = rng() < 0.5;
  const signedElevation = lower ? -elevation : elevation;
  const elevationMeaning = chooseAnswer(rng, '选择带符号海拔的实际含义', [
    { label: `比海平面${lower ? '低' : '高'}${elevation}米`, correct: true },
    { label: `比海平面${lower ? '高' : '低'}${elevation}米` },
    { label: '与海平面一样高' },
  ]);
  const elevationQuestion = {
    difficulty: 'basic', prompt: `以海平面为0米，规定高于海平面为正、低于海平面为负。某地海拔记为${display(signedElevation)}米，这表示什么？`, mathHtml: `海拔＝${display(signedElevation)}米`, input: elevationMeaning.input,
    hint: '把符号与海平面基准对应：正表示高于，负表示低于；数值大小表示相差多少米。',
    solution: [`海拔以海平面为0米，${lower ? '负' : '正'}号表示${lower ? '低于' : '高于'}海平面。`, `所以表示比海平面${lower ? '低' : '高'}${elevation}米。`], answerDisplay: `比海平面${lower ? '低' : '高'}${elevation}米`, expected: { value: elevationMeaning.value },
  };
  const movement = pick(rng, ['收入', '支出', '没有收入也没有支出']);
  const money = int(rng, 1, 40), moneyValue = movement === '收入' ? money : movement === '支出' ? -money : 0;
  const standard = pick(rng, [500, 1000, 2500]), deviation = int(rng, 0, 7) * 5, surplus = rng() < 0.5;
  const deviationDescription = deviation === 0 ? '这袋物品的质量恰好等于标准质量' : `这袋比标准${surplus ? '多' : '少'}${deviation}克`;
  const deviationReason = deviation === 0 ? '实际质量恰好等于标准，偏差为0。' : `偏差以${standard}克为基准，${surplus ? '超过标准，与规定正方向相同' : '不足标准，与规定正方向相反'}。`;
  const deviationQuestion = contextNumber({ difficulty: 'variation', prompt: `一袋物品的标准质量是${standard}克，以标准质量为基准，超过标准的克数记为正。${deviationDescription}，偏差应记为多少？`, mathHtml: '' }, rational(BigInt(surplus ? deviation : -deviation)), '克', deviationReason);
  attachStep(rng, deviationQuestion, '关键步骤：偏差的正负以什么判断？', [
    { label: '先与标准比较，超过记正，不足记负', correct: true }, { label: '把实际总质量直接当作偏差' }, { label: '只要物品有质量，偏差就一定是正数' },
  ]);
  const water = represented(pick(rng, ['0.5', '1.5', '2.5', '3.5']));
  const rising = rng() < 0.5;
  const reverseQuestion = contextNumber({ difficulty: 'variation', prompt: `以开始时的水位为0，规定下降为正、上升为负。随后水位${rising ? '上升' : '下降'}${water.text}米，变化量应记为多少？`, mathHtml: '' }, rising ? negate(water.value) : water.value, '米', `题目明确规定下降为正；这次${rising ? '上升，与正方向相反' : '下降，与正方向相同'}。`);
  attachStep(rng, reverseQuestion, '关键步骤：遇到改变正方向的约定时怎样判断？', [
    { label: '按本题规定的正方向判断，不能默认上升为正', correct: true }, { label: '任何题都固定把上升记为正数' }, { label: '水位变化只能记正数，不能记负数' },
  ]);
  const growth = int(rng, 1, 25);
  const first = rng() < 0.5
    ? contextNumber({ difficulty: 'basic', prompt: `以0℃为基准，规定零上温度为正、零下温度为负。零${below ? '下' : '上'}${temperature}℃应记为多少？`, mathHtml: '' }, rational(BigInt(below ? -temperature : temperature)), '℃', `温度在0℃${below ? '以下' : '以上'}，应取${below ? '负' : '正'}号。`)
    : contextNumber({ difficulty: 'basic', prompt: `以与上年相比无变化为0%，增长为正、减少为负。今年销售量比上年减少${growth}%，用带符号的百分数表示增长率，百分号前应填什么数？`, mathHtml: '' }, rational(BigInt(-growth)), '%', `增长率以无变化为0%，减少${growth}%应表示为负增长。`);
  return [
    first,
    elevationQuestion,
    contextNumber({ difficulty: 'basic', prompt: `以本次收支变化0元为基准，收入为正、支出为负。本次${movement}${movement === '没有收入也没有支出' ? '' : `${money}元`}，变化量应记为多少？`, mathHtml: '' }, rational(BigInt(moneyValue)), '元', movement === '没有收入也没有支出' ? '本次没有收支变化，所以记0。' : `${movement}与规定的${movement === '收入' ? '正方向相同' : '正方向相反'}。`),
    deviationQuestion, reverseQuestion,
  ];
}

function rationalClassification(rng) {
  const disguisedInteger = represented(pick(rng, ['2.0', '6/3', '0/5', '100%', '-4.0', '-8/2']));
  const nonInteger = represented(pick(rng, ['0.5', '-1.25', '+2.4', '-0.75', '25%']));
  const bySign = represented(pick(rng, ['-0.0', '6/3', '-100%', '0/5', '+1/4']));
  const numerator = int(rng, 1, 95);
  const decimalText = (numerator / 100).toFixed(2);
  const decimalChoice = chooseAnswer(rng, '选择与有限小数相等的分数', [
    { label: `${numerator}/100`, html: fractionHtml(numerator, 100), correct: true },
    { label: `${numerator}/10`, html: fractionHtml(numerator, 10) },
    { label: `100/${numerator}`, html: fractionHtml(100, numerator) },
    { label: `−${numerator}/100`, html: fractionHtml(-numerator, 100) },
  ]);
  const decimalQuestion = {
    difficulty: 'variation', prompt: '下面的有限小数可以写成哪个与它相等的分数？', mathHtml: decimalText, input: decimalChoice.input,
    hint: '两位小数表示若干个百分之一，可写成分母为100的分数，再按数值核对。',
    solution: [`${decimalText}表示${numerator}个百分之一。`, `所以${decimalText}＝${numerator}/100，说明这个有限小数是有理数。`], answerDisplay: `${numerator}/100`, expected: { value: decimalChoice.value },
  };
  attachStep(rng, decimalQuestion, '关键步骤：为什么有限小数属于有理数？', [
    { label: '它可以写成分母不为0的整数之比', correct: true }, { label: '只要有小数点，就不能写成分数' }, { label: '分数形式只能表示非整数，不能表示整数' },
  ]);
  const repeat = pick(rng, ['3', '6', '27', '45']);
  const recurringText = `0.${repeat.repeat(3)}…（${repeat}循环）`;
  const recurringChoice = chooseAnswer(rng, '只判断是否属于有理数', [
    { label: '属于有理数，因为无限循环小数可以写成分数', correct: true },
    { label: '不属于有理数，因为小数位没有结束' },
    { label: '不属于有理数，因为不是整数写法' },
  ]);
  const recurring = {
    difficulty: 'variation', prompt: '下面是无限循环小数。只判断它是否属于有理数，不要求把它化为具体分数。', mathHtml: recurringText, input: recurringChoice.input,
    hint: '有理数不只包括整数或有限小数；本节指出无限循环小数也可以化为分数。',
    solution: ['这是无限循环小数，可以写成分数形式。', '因此属于有理数；本项目不要求计算它对应的具体分数。'], answerDisplay: '属于有理数', expected: { value: recurringChoice.value },
  };
  attachStep(rng, recurring, '关键步骤：本题需要做什么？', [
    { label: '依据循环小数可写成分数来判断归属', correct: true }, { label: '必须先学会循环小数化分数的完整算法' }, { label: '只看小数位有无限多位就排除' },
  ]);
  return [categoryQuestion(rng, disguisedInteger, 'integer', 'basic'), categoryQuestion(rng, nonInteger, 'integer', 'basic'), categoryQuestion(rng, bySign, 'sign', 'basic'), decimalQuestion, recurring];
}

function distancePair(rng, left, right, target, difficulty, withStep = false) {
  const relation = compare(magnitude(left.value), magnitude(right.value));
  const correct = relation === 'eq' ? 2 : relation === (target === 'near' ? 'lt' : 'gt') ? 0 : 1;
  const word = target === 'near' ? '更近' : '更远';
  const entries = [{ label: `左边的数离原点${word}` }, { label: `右边的数离原点${word}` }, { label: '两个数到原点的距离相等' }].map((entry, index) => ({ ...entry, correct: index === correct }));
  const chosen = chooseAnswer(rng, '比较到原点的距离', entries);
  const q = {
    difficulty, prompt: `下面两个数，哪一个离原点${word}？若一样远，选择距离相等。`, mathHtml: `${left.html}　与　${right.html}`, input: chosen.input,
    hint: '比较的是到0的距离，先求绝对值，不是直接比较两个原数的大小。',
    solution: [`两个数的绝对值分别为${readable(magnitude(left.value))}与${readable(magnitude(right.value))}。`, entries[correct].label + '。'], answerDisplay: entries[correct].label, expected: { value: chosen.value },
  };
  if (withStep) attachStep(rng, q, '关键步骤：怎样比较离原点的远近？', [
    { label: '比较绝对值，距离与原数正负无关', correct: true }, { label: '直接比较原数，数越大距离一定越远' }, { label: '负数到原点的距离都比正数小' },
  ]);
  return q;
}
function distancesToZero(rng) {
  const n = int(rng, 2, 8), extra = int(rng, 1, 4);
  const pair = shuffle(rng, [represented(`-${n}`), represented(String(n + extra))]);
  const equalNumerator = pick(rng, [1, 3, 5, 7]);
  const equalPair = [represented(`-${equalNumerator}/2`), represented(String(equalNumerator / 2))];
  const positions = [-int(rng, 3, 5), -1, 2], letters = shuffle(rng, ['A', 'B', 'C']);
  const far = rng() < 0.5;
  const pointIndex = far ? 0 : 1;
  const pointChoice = chooseAnswer(rng, '选择到原点距离符合要求的点', letters.map((letter, index) => ({ label: `点${letter}`, correct: index === pointIndex })));
  const graph = {
    difficulty: 'basic', prompt: `数轴上每小格代表1。A、B、C中哪个点离原点最${far ? '远' : '近'}？`, mathHtml: '',
    diagram: numberline(-6, 4, { 0: '0', 1: '1' }, positions.map((position, index) => ({ position, label: letters[index] }))), input: pointChoice.input,
    hint: '分别比较三个点到0的距离；左右方向不决定谁更近。',
    solution: [positions.map((position, index) => `点${letters[index]}距原点${Math.abs(position)}小格`).join('；') + '。', `因此点${letters[pointIndex]}最${far ? '远' : '近'}。`], answerDisplay: `点${letters[pointIndex]}`, expected: { value: pointChoice.value },
  };
  const denominator = pick(rng, [7, 9]), numerator = int(rng, 1, 5);
  const fractionPair = shuffle(rng, [represented(`-${numerator}/${denominator}`), represented(`${numerator + 1}/${denominator}`)]);
  const distance = represented(`${pick(rng, [1, 3, 5, 7])}/2`);
  const distanceNeg = readable(negate(distance.value)), distancePos = readable(distance.value);
  const tiedChoice = chooseAnswer(rng, '选择完整的最远结果', [
    { label: `${distanceNeg}和${distancePos}`, correct: true }, { label: distanceNeg }, { label: distancePos }, { label: '0' },
  ]);
  const tied = {
    difficulty: 'variation', prompt: '下面三个数中，哪些离原点最远？请选择完整答案，不能漏掉并列结果。', mathHtml: `${numberHtml(negate(distance.value))}，0，${distance.html}`, input: tiedChoice.input,
    hint: '先比较三个绝对值。同样达到最大距离的数，都要保留。',
    solution: [`两侧的数到原点距离都为${distancePos}，0到原点距离为0。`, `因此最远的数有两个：${distanceNeg}和${distancePos}。`], answerDisplay: `${distanceNeg}和${distancePos}`, expected: { value: tiedChoice.value },
  };
  attachStep(rng, tied, '关键步骤：有并列最远者时怎样回答？', [
    { label: '比较所有绝对值，保留全部并列最大者', correct: true }, { label: '只保留正数一侧' }, { label: '只要找到一个最远数就停止' },
  ]);
  return [distancePair(rng, pair[0], pair[1], 'near', 'basic'), distancePair(rng, equalPair[0], equalPair[1], 'far', 'basic'), graph, distancePair(rng, fractionPair[0], fractionPair[1], 'far', 'variation', true), tied];
}

function orderedQuestion(rng, sources, descending, difficulty) {
  const uniqueValues = new Set(sources.map(source => encode(source.value)));
  if (uniqueValues.size !== sources.length) throw new Error('排序题必须使用数值两两不同的数。');
  const sorted = [...sources].sort((a, b) => (compare(a.value, b.value) === 'lt' ? -1 : 1) * (descending ? -1 : 1));
  const swapFirst = [...sorted]; [swapFirst[0], swapFirst[1]] = [swapFirst[1], swapFirst[0]];
  const swapLast = [...sorted]; const last = swapLast.length - 1; [swapLast[last - 1], swapLast[last]] = [swapLast[last], swapLast[last - 1]];
  const symbol = descending ? '＞' : '＜';
  const orders = [sorted, [...sorted].reverse(), swapFirst, swapLast];
  const chosen = chooseAnswer(rng, '选择完整正确的排序', orders.map((order, index) => ({ label: order.map(source => source.text).join(symbol), html: order.map(source => source.html).join(symbol), correct: index === 0 })));
  const q = {
    difficulty, prompt: `将下面各数按从${descending ? '大到小' : '小到大'}的顺序排列，选择完整正确的排序。`, mathHtml: shuffle(rng, sources).map(source => source.html).join('；'), input: chosen.input,
    hint: '先化简各数，再比较正数、0、负数；两个负数中绝对值大的反而小。最后检查每一对相邻数。',
    solution: ['各数实际表示：' + sources.map(source => `${source.text}＝${readable(source.value)}`).join('；') + '。', '正确顺序为' + sorted.map(source => source.text).join(symbol) + '。'], answerDisplay: sorted.map(source => source.text).join(symbol), expected: { value: chosen.value },
  };
  if (difficulty === 'variation') attachStep(rng, q, '关键步骤：带绝对值或相反数时先做什么？', [
    { label: '先化简各数，再按要求比较和排序', correct: true }, { label: '只看外面有没有负号，不化简' }, { label: '直接按绝对值从小到大，忽略正负和排序要求' },
  ]);
  return q;
}
function orderingNumbers(rng) {
  const a = int(rng, 2, 7), b = a + int(rng, 1, 3), c = int(rng, 1, 7);
  const da = int(rng, 1, 7), db = da + 2, dc = int(rng, 8, 27);
  const denominator = pick(rng, [5, 7]), numerator = int(rng, 1, 3);
  const absValue = int(rng, 2, 8), oppositeValue = int(rng, 2, 8);
  const absSource = { text: `|−${absValue}|`, html: `|−${absValue}|`, value: rational(BigInt(absValue)) };
  const negativeOpposite = { text: `−(+${oppositeValue})`, html: `−(＋${oppositeValue})`, value: rational(BigInt(-oppositeValue)) };
  const outerNegative = { text: `−|−${absValue}|`, html: `−|−${absValue}|`, value: rational(BigInt(-absValue)) };
  const doubleNegative = { text: `−(−${oppositeValue})`, html: `−(−${oppositeValue})`, value: rational(BigInt(oppositeValue)) };
  return [
    orderedQuestion(rng, [`-${a}`, `-${b}`, '0', String(c)].map(represented), false, 'basic'),
    orderedQuestion(rng, [String(-da / 10), '0', String(dc / 10), String(-db / 10)].map(represented), true, 'basic'),
    orderedQuestion(rng, [`-${numerator}/${denominator}`, `-${numerator + 1}/${denominator}`, '0', `${int(rng, 1, 4)}/${denominator}`].map(represented), false, 'basic'),
    orderedQuestion(rng, [absSource, negativeOpposite, represented('0'), represented('1/3')], false, 'variation'),
    orderedQuestion(rng, [outerNegative, doubleNegative, represented('0'), represented('2/3')], true, 'variation'),
  ];
}

function distanceCandidateQuestion(distance, negative, difficulty) {
  const result = negative ? negate(distance) : distance;
  return numericQuestion({
    difficulty, prompt: `数a到原点的距离是${readable(distance)}，并且a是${negative ? '负' : '正'}数，求a。`, mathHtml: `|a|＝${numberHtml(distance)}，a${negative ? '＜' : '＞'}0`, result,
    hint: '先找出原点两侧同样远的两个候选，再按题目给出的正负条件筛选。',
    solution: [`距离为${readable(distance)}的候选有${readable(negate(distance))}与${readable(distance)}。`, `题目要求${negative ? '负' : '正'}数，所以保留${readable(result)}。`], answerDisplay: `a＝${readable(result)}`,
  });
}
function inverseAbsoluteValues(rng) {
  const d = rational(BigInt(int(rng, 1, 15))), negative = rng() < 0.5;
  const allDistance = rational(BigInt(pick(rng, [1, 3, 5, 7])), 2n);
  const pos = readable(allDistance), neg = readable(negate(allDistance));
  const allChoice = chooseAnswer(rng, '选择全部可能的数', [
    { label: `${neg}或${pos}`, correct: true }, { label: `只有${pos}` }, { label: `只有${neg}` }, { label: '只有0' },
  ]);
  const all = { difficulty: 'basic', prompt: `数a到原点的距离是${pos}，没有其他符号条件。a可能是哪些数？请选择完整答案。`, mathHtml: `|a|＝${numberHtml(allDistance)}`, input: allChoice.input,
    hint: '距离大于0时，原点左右两侧各有一个候选，没有符号条件就不能只留一侧。', solution: [`原点左侧有${neg}，右侧有${pos}，到原点距离都为${pos}。`, `所以两个候选都要保留：${neg}或${pos}。`], answerDisplay: `${neg}或${pos}`, expected: { value: allChoice.value } };
  const fractionDistance = rational(BigInt(pick(rng, [1, 3, 5])), BigInt(pick(rng, [4, 6, 8]))), keepNegative = rng() < 0.5;
  const filtered = distanceCandidateQuestion(fractionDistance, keepNegative, 'variation');
  attachStep(rng, filtered, '关键步骤：怎样避免漏解或留错符号？', [
    { label: '先找正负两个候选，再按给定符号筛选', correct: true }, { label: '绝对值为正，所以原数一定是正数' }, { label: '无论题目条件如何，都只保留负数' },
  ]);
  const forbidden = pick(rng, ['正数', '负数']);
  const impossibleChoice = chooseAnswer(rng, '选择全部符合条件的数', [
    { label: '没有符合条件的数', correct: true }, { label: '只有0' }, { label: '只有1' }, { label: '只有−1' },
  ]);
  const impossible = { difficulty: 'variation', prompt: `数a到原点的距离是0，并且要求a是${forbidden}。哪些数符合全部条件？`, mathHtml: `|a|＝0，a是${forbidden}`, input: impossibleChoice.input,
    hint: '先考虑距离为0时原数只能是什么，再检查它是否满足正数或负数条件。', solution: ['到原点距离为0时，只能是0。', `0不是${forbidden}，因此没有符合全部条件的数。`], answerDisplay: '没有符合条件的数', expected: { value: impossibleChoice.value } };
  attachStep(rng, impossible, '关键步骤：距离0与符号条件怎样一起检查？', [
    { label: '距离0只留下0，但0不满足正数或负数条件', correct: true }, { label: '0同时属于正数和负数，所以保留0' }, { label: '把0左右两侧的任意数都算作距离0' },
  ]);
  return [distanceCandidateQuestion(d, negative, 'basic'), numericQuestion({ difficulty: 'basic', prompt: '数a到原点的距离是0，没有其他条件，求a。', mathHtml: '|a|＝0', result: rational(0n), hint: '原点本身表示0，它到原点的距离是0。', solution: ['到原点距离为0，表示这个点就是原点。', '因此只有a＝0，没有两个不同的正负候选。'], answerDisplay: 'a＝0' }), all, filtered, impossible];
}

const sumRationals = values => values.reduce(add, rational(0n));
const subtract = (a, b) => add(a, negate(b));
function finiteDecimalText(value) {
  let rest = abs(value.n) % value.d, tail = '';
  const whole = abs(value.n) / value.d;
  // Explicit decimal lessons use exact long division, even after reducing /10.
  while (rest && tail.length < 20) { rest *= 10n; tail += String(rest / value.d); rest %= value.d; }
  if (rest) return readable(value);
  return `${value.n < 0n ? '−' : ''}${whole}${tail ? `.${tail}` : ''}`;
}
const numberText = (value, decimal = false) => decimal ? finiteDecimalText(value) : readable(value);
const operandHtml = (value, decimal = false) => `(${decimal ? finiteDecimalText(value) : numberHtml(value)})`;
const operandText = (value, decimal = false) => `(${numberText(value, decimal)})`;
const sumHtml = (values, decimal = false) => values.map(value => operandHtml(value, decimal)).join('＋');
const sumText = (values, decimal = false) => values.map(value => operandText(value, decimal)).join('＋');
const additionLaws = {
  same: '同号相加，符号不变，绝对值相加',
  opposite: '异号且绝对值不同，大的减小的，取绝对值较大加数的符号',
  cancel: '互为相反数的两个数相加得0',
  zero: '一个数与0相加，仍得这个数',
};
function additionQuestion(rng, a, b, difficulty, withStep = false, decimal = false) {
  const result = add(a, b);
  const law = a.n === 0n || b.n === 0n ? 'zero' : (a.n > 0n) === (b.n > 0n) ? 'same' : result.n === 0n ? 'cancel' : 'opposite';
  const q = numericQuestion({
    difficulty, prompt: '计算两个有理数的和。', mathHtml: sumHtml([a, b], decimal), result,
    hint: '先看加数的符号，再比较绝对值；相反数与0的情况单独检查。',
    solution: [additionLaws[law] + '。', `${sumText([a, b], decimal)}＝${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal),
  });
  if (withStep) attachStep(rng, q, '关键步骤：这两个加数应使用哪条规则？', Object.entries(additionLaws).map(([key, label]) => ({ label, correct: key === law })));
  return q;
}
function rationalAddition(rng) {
  const a = int(rng, 2, 13), b = int(rng, 1, 9), negative = rng() < 0.5;
  const small = int(rng, 1, 7), large = small + int(rng, 1, 6);
  const differenceScale = rng() < 0.5 ? 1n : 10n;
  const denominator = pick(rng, [3, 5, 7]), numerator = int(rng, 1, denominator - 1);
  const decimal = rational(BigInt(pick(rng, [3, 7, 13, 17, 23])), 10n);
  return [
    additionQuestion(rng, rational(BigInt(negative ? -a : a)), rational(BigInt(negative ? -b : b)), 'basic'),
    additionQuestion(rng, rational(BigInt(-large), differenceScale), rational(BigInt(small), differenceScale), 'basic', false, differenceScale === 10n),
    additionQuestion(rng, rational(0n), rational(BigInt(pick(rng, [-9, -4, 3, 7]))), 'basic'),
    additionQuestion(rng, rational(BigInt(-numerator), BigInt(denominator)), rational(BigInt(numerator + 1), BigInt(denominator)), 'variation', true),
    additionQuestion(rng, negate(decimal), decimal, 'variation', true, true),
  ];
}
function sumChangeQuestion(a, b, difficulty, symbolic = false) {
  const relation = b.n > 0n ? 'gt' : b.n < 0n ? 'lt' : 'eq';
  const base = symbolic ? 'a' : operandHtml(a);
  return {
    difficulty, prompt: symbolic ? 'a表示任意有理数。不必求出和，比较下面两式。' : '不必计算具体的和，比较左边的和与右边的原数。',
    mathHtml: `${base}＋${operandHtml(b)}<span class="math-gap">　?　</span>${base}`,
    input: { type: 'choice', label: '和与原数的大小关系', options: relationOptions() },
    hint: '判断所加数是正数、负数还是0；这个规律不取决于原数的正负。',
    solution: [`所加数${readable(b)}${b.n > 0n ? '是正数，向右移动' : b.n < 0n ? '是负数，向左移动' : '是0，位置不变'}。`, `因此和${relation === 'gt' ? '大于' : relation === 'lt' ? '小于' : '等于'}原数。`],
    answerDisplay: relationText[relation], expected: { value: relation },
  };
}
function sumChanges(rng) {
  const increment = rational(BigInt(pick(rng, [-1, 1]) * int(rng, 1, 7)), BigInt(pick(rng, [3, 4, 5])));
  const symbolic = sumChangeQuestion(null, increment, 'variation', true);
  attachStep(rng, symbolic, '关键步骤：比较和与原数，主要看什么？', [
    { label: '看所加数的正负：正增、负减、0不变', correct: true }, { label: '只看原数a是正数还是负数' }, { label: '任何加法都会把数变大' },
  ]);
  const relation = pick(rng, ['gt', 'lt', 'eq']);
  const category = { gt: '正数', lt: '负数', eq: '0' }[relation];
  const chosen = chooseAnswer(rng, '判断所加数b的符号', ['正数', '负数', '0'].map(label => ({ label, correct: label === category })));
  const reverse = {
    difficulty: 'variation', prompt: 'a、b都是有理数。根据已给的和与原数的关系，判断b的符号。',
    mathHtml: `a＋b${relationText[relation]}a`, input: chosen.input,
    hint: '把和变大、变小或不变，分别对应加正数、负数或0。',
    solution: [`已知和${relation === 'gt' ? '比原数大' : relation === 'lt' ? '比原数小' : '与原数相等'}。`, `所以所加的b是${category}。`], answerDisplay: `b是${category}`, expected: { value: chosen.value },
  };
  attachStep(rng, reverse, '关键步骤：怎样由变化反推所加数？', [
    { label: '加正数变大，加负数变小，加0不变', correct: true }, { label: '只要写了加号，b就一定是正数' }, { label: '原数a未知，所以永远不能判断' },
  ]);
  return [sumChangeQuestion(rational(BigInt(-int(rng, 2, 15))), rational(BigInt(int(rng, 1, 7))), 'basic'), sumChangeQuestion(rational(BigInt(int(rng, 1, 13))), rational(BigInt(-int(rng, 1, 9))), 'basic'), sumChangeQuestion(rational(BigInt(pick(rng, [-8, -3, 0, 4, 9]))), rational(0n), 'basic'), symbolic, reverse];
}
const groupedText = (groups, decimal = false) => groups.map(group => `[${group.length ? sumText(group, decimal) : '0'}]`).join('＋');
function groupingQuestion(rng, values, groups, instruction, difficulty, decimal = false) {
  const correctGroups = groups.map(indices => indices.map(index => values[index]));
  const flipped = correctGroups.map(group => [...group]); flipped[0][0] = negate(flipped[0][0]);
  const missing = correctGroups.map(group => [...group]); missing.at(-1).pop();
  const repeated = correctGroups.map(group => [...group]); repeated[0].push(values[0]);
  const groupOptions = [correctGroups, flipped, missing, repeated].map((candidate, i) => ({ label: groupedText(candidate, decimal), correct: i === 0 }));
  const result = sumRationals(values);
  const q = numericQuestion({
    difficulty, prompt: `${instruction}先选择保留每个带符号加数的分组，再计算和。`, mathHtml: sumHtml(values, decimal), result,
    hint: '交换和分组时，符号必须随加数一起移动。每个原加数用一次，不改号、不漏数、不重复。',
    solution: ['用加法交换律与结合律，连同符号重排并分组。', `可写成${groupedText(correctGroups, decimal)}，和为${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal),
  });
  return attachStep(rng, q, '关键步骤：选择正确的分组表达式', groupOptions);
}
function additionGrouping(rng) {
  const a = rational(BigInt(int(rng, 2, 12))), b = rational(BigInt(-int(rng, 1, 8)));
  const positives = [rational(BigInt(int(rng, 2, 9))), rational(BigInt(-int(rng, 2, 8))), rational(BigInt(int(rng, 2, 7))), rational(BigInt(-int(rng, 1, 6)))];
  const d = pick(rng, [3, 4, 5]), n = int(rng, 1, d - 1);
  const da = rational(BigInt(pick(rng, [3, 7, 13, 17])), 10n), db = rational(BigInt(pick(rng, [21, 23, 27])), 10n);
  return [
    groupingQuestion(rng, [a, b, negate(a)], [[0, 2], [1]], '优先把互为相反数的两个数放一组。', 'basic'),
    groupingQuestion(rng, positives, [[0, 2], [1, 3]], '先把正数与负数分别放一组。', 'basic'),
    groupingQuestion(rng, [rational(BigInt(n), BigInt(d)), rational(-1n, 7n), rational(BigInt(d - n), BigInt(d))], [[0, 2], [1]], '先把能凑成1的同分母加数放一组。', 'basic'),
    groupingQuestion(rng, [da, db, negate(da), negate(db)], [[0, 2], [1, 3]], '优先把两对相反数分别放一组。', 'variation', true),
    groupingQuestion(rng, [rational(BigInt(n), BigInt(d)), rational(-2n, 3n), rational(BigInt(d - n), BigInt(d)), rational(-1n, 3n)], [[0, 2], [1, 3]], '把同分母加数放一组，尽量凑整。', 'variation'),
  ];
}
function standardTotalQuestion(rng, standard, deviations, target, difficulty, decimal = false) {
  const delta = sumRationals(deviations);
  const base = rational(standard.n * BigInt(deviations.length), standard.d);
  const total = add(base, delta);
  const asksTotal = target === 'total';
  const q = numericQuestion({
    difficulty, prompt: `共${deviations.length}袋，每袋标准质量为${readable(standard)}千克。超过标准的偏差记正，不足记负。求这批的${asksTotal ? '实际总质量' : '带符号偏差和（超过或不足的总量）'}。`,
    mathHtml: `各袋偏差（千克）：${deviations.map(value => operandHtml(value, decimal)).join('，')}`, result: asksTotal ? total : delta, label: asksTotal ? '实际总质量' : '带符号偏差和',
    hint: asksTotal ? '先算偏差和，再加回每袋标准质量×袋数；偏差为0不代表总质量为0。' : '题目只问总计超过或不足多少，先把带符号偏差相加，不要把标准总质量混入。',
    solution: [`偏差和为${sumText(deviations, decimal)}＝${numberText(delta, decimal)}千克。`, asksTotal ? `实际总质量＝${readable(standard)}×${deviations.length}＋(${numberText(delta, decimal)})＝${numberText(total, decimal)}千克。` : `所求只是偏差和${numberText(delta, decimal)}千克；实际总质量另为${numberText(total, decimal)}千克，不能混淆。`], answerDisplay: `${numberText(asksTotal ? total : delta, decimal)}千克`,
  });
  q.input.unit = '千克';
  if (difficulty === 'variation') attachStep(rng, q, '关键步骤：本题所求应怎样列式？', asksTotal ? [
    { label: '标准质量×袋数＋偏差和', correct: true }, { label: '只求偏差和，就当作实际总质量' }, { label: '只加一袋标准质量，再加偏差和' },
  ] : [
    { label: '只把各袋带符号偏差相加', correct: true }, { label: '标准质量×袋数＋偏差和' }, { label: '把所有负偏差改成正数后相加' },
  ]);
  return q;
}
function standardTotals(rng) {
  const a = int(rng, 1, 3), b = int(rng, 1, 4);
  return [
    standardTotalQuestion(rng, rational(10n), [rational(BigInt(a)), rational(BigInt(-b)), rational(1n)], 'total', 'basic'),
    standardTotalQuestion(rng, rational(BigInt(pick(rng, [20, 25, 50]))), [rational(BigInt(a), 10n), rational(-5n, 10n), rational(BigInt(b), 10n), rational(-1n, 10n)], 'total', 'basic', true),
    standardTotalQuestion(rng, rational(10n), [rational(BigInt(a)), rational(BigInt(-a)), rational(BigInt(b)), rational(BigInt(-b))], 'deviation', 'basic'),
    standardTotalQuestion(rng, rational(BigInt(pick(rng, [5, 10, 20]))), [rational(1n, 2n), rational(-1n, 4n), rational(1n, 4n)], 'total', 'variation'),
    standardTotalQuestion(rng, rational(5n), [rational(0n), rational(-1n, 2n), rational(-1n, 4n), rational(1n, 4n)], 'deviation', 'variation'),
  ];
}
function subtractionQuestion(rng, a, b, difficulty, withStep = false, decimal = false) {
  const result = subtract(a, b);
  const q = numericQuestion({
    difficulty, prompt: '计算下面的差。先看清减法运算符号与减数本身的符号。', mathHtml: `${operandHtml(a, decimal)}−${operandHtml(b, decimal)}`, result,
    hint: '被减数不变，减法转为加法，整个减数变为它的相反数；不是把两个数都改号。',
    solution: [`减数是${numberText(b, decimal)}，它的相反数是${numberText(negate(b), decimal)}。`, `原式＝${sumText([a, negate(b)], decimal)}＝${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal),
  });
  if (withStep) attachStep(rng, q, '关键步骤：哪一个加法式正确表示原差？', [
    { label: sumText([a, negate(b)], decimal), correct: true }, { label: sumText([a, b], decimal) }, { label: sumText([negate(a), negate(b)], decimal) }, { label: sumText([negate(a), b], decimal) },
  ]);
  return q;
}
function rationalSubtraction(rng) {
  const a = int(rng, 1, 10), b = int(rng, 1, 8);
  return [
    subtractionQuestion(rng, rational(BigInt(-a)), rational(BigInt(-b)), 'basic'),
    subtractionQuestion(rng, rational(BigInt(a)), rational(BigInt(a + b)), 'basic'),
    subtractionQuestion(rng, rational(0n), rational(BigInt(pick(rng, [-1, 1]) * b)), 'basic'),
    subtractionQuestion(rng, rational(BigInt(pick(rng, [13, 17, 23, 27])), 10n), rational(BigInt(-pick(rng, [3, 7, 11])), 10n), 'variation', true, true),
    subtractionQuestion(rng, rational(BigInt(-int(rng, 1, 5)), 7n), rational(BigInt(int(rng, 1, 5)), 7n), 'variation', true),
  ];
}
function mixedQuestion(rng, values, operations, difficulty, decimal = false) {
  const signed = values.map((value, index) => index && operations[index - 1] === '−' ? negate(value) : value);
  const result = sumRationals(signed);
  const expression = values.map((value, index) => (index ? operations[index - 1] : '') + operandHtml(value, decimal)).join('');
  const correct = sumText(signed, decimal);
  const candidates = [sumText(values, decimal)];
  for (let index = 0; index < signed.length; index++) if (signed[index].n !== 0n) {
    const flipped = [...signed]; flipped[index] = negate(flipped[index]); candidates.push(sumText(flipped, decimal));
  }
  candidates.push(sumText(signed.map(negate), decimal));
  const wrong = [...new Set(candidates)].filter(label => label !== correct).slice(0, 3);
  if (wrong.length !== 3) throw new Error('混合运算题的转换选项不完整。');
  const q = numericQuestion({
    difficulty, prompt: '保持原来次序，把每个减法转成加相反数，选择完整带符号的和，再计算。', mathHtml: expression, result,
    hint: '先逐个处理运算减号，整个减数取相反数。转换后的符号与数绑定，不可只移动数值。',
    solution: [`按原顺序统一成和：${correct}。`, `再保留各加数符号分组，计算得${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal),
  });
  return attachStep(rng, q, '关键步骤：选择逐项转换后的完整和式', [{ label: correct, correct: true }, ...wrong.map(label => ({ label }))]);
}
function mixedAdditionSubtraction(rng) {
  const a = int(rng, 2, 9), b = int(rng, 1, 7), c = int(rng, 1, 6);
  return [
    mixedQuestion(rng, [rational(BigInt(-a)), rational(BigInt(b)), rational(BigInt(-c))], ['−', '＋'], 'basic'),
    mixedQuestion(rng, [rational(BigInt(a)), rational(BigInt(-b)), rational(BigInt(a + b))], ['−', '−'], 'basic'),
    mixedQuestion(rng, [rational(0n), rational(BigInt(-a)), rational(BigInt(b))], ['−', '＋'], 'basic'),
    mixedQuestion(rng, [rational(-13n, 10n), rational(BigInt(b), 10n), rational(-7n, 10n), rational(BigInt(c), 10n)], ['＋', '−', '＋'], 'variation', true),
    mixedQuestion(rng, [rational(BigInt(a), 7n), rational(-1n, 3n), rational(BigInt(b), 7n), rational(-2n, 3n)], ['−', '＋', '−'], 'variation'),
  ];
}
function twoPointQuestion(rng, numeratorA, numeratorB, denominator, difficulty, mode = null) {
  const a = rational(BigInt(numeratorA), BigInt(denominator)), b = rational(BigInt(numeratorB), BigInt(denominator));
  const distance = magnitude(subtract(a, b));
  const points = numeratorA === numeratorB ? [{ position: numeratorA, label: 'A、B' }] : [{ position: numeratorA, label: 'A' }, { position: numeratorB, label: 'B' }];
  const diagram = numberline(Math.min(-1, numeratorA, numeratorB) - 1, Math.max(1, numeratorA, numeratorB) + 1, { 0: '0', 1: readable(rational(1n, BigInt(denominator))) }, points);
  const q = numericQuestion({
    difficulty, prompt: `A表示${readable(a)}，B表示${readable(b)}${numeratorA === numeratorB ? '，两点重合' : ''}。${mode === 'swap' ? '交换两个端点的角色后距离也应相同。先检验候选式，再求这两点距离。' : mode === 'candidate' ? '先根据图求距离，再选择能解释本例的候选表达式。' : '求A、B之间的距离。'}`,
    mathHtml: `a＝${numberHtml(a)}，b＝${numberHtml(b)}`, diagram, result: distance, label: '两点之间的距离',
    hint: '距离必须非负，交换端点距离不变，重合时距离为0。先算具体例子，检查候选表达式是否符合这些条件。',
    solution: [`本例中两数相减为${readable(subtract(a, b))}，对应的非负距离为${readable(distance)}。`, mode ? `交换顺序时，差为${readable(subtract(b, a))}，取绝对值仍为${readable(distance)}。这用新例支持候选式，并不把有限试例当作普遍证明。` : `两点${distance.n === 0n ? '重合，因此距离是0' : `之间相隔${readable(distance)}个单位长度`}。`], answerDisplay: readable(distance),
  });
  if (mode) attachStep(rng, q, mode === 'swap' ? '关键步骤：哪个候选式在交换端点前后都能给出距离？' : '关键步骤：用本例距离检验哪个候选式可用？', [
    { label: '|a−b|', correct: true }, { label: 'a−b' }, { label: mode === 'swap' ? 'b−a' : '|a|−|b|' }, { label: 'a＋b' },
  ]);
  return q;
}
function twoPointDistances(rng) {
  const left = int(rng, 1, 3), right = left + int(rng, 2, 4);
  const shared = pick(rng, [-3, 0, 2]);
  return [
    twoPointQuestion(rng, left, right, 1, 'basic'),
    twoPointQuestion(rng, -int(rng, 2, 4), -int(rng, 6, 9), 1, 'basic'),
    twoPointQuestion(rng, shared, shared, 1, 'basic'),
    twoPointQuestion(rng, -pick(rng, [1, 3, 5, 7]), pick(rng, [1, 3, 5, 7]), 2, 'variation', 'candidate'),
    twoPointQuestion(rng, pick(rng, [1, 2, 4, 5, 7]), -pick(rng, [1, 2, 4, 5, 7]), 3, 'variation', 'swap'),
  ];
}

const multiplyRationals = (a, b) => rational(a.n * b.n, a.d * b.d);
const productRationals = values => values.reduce(multiplyRationals, rational(1n));
function reciprocalOf(value) {
  if (value.n === 0n) return null;
  return rational(value.d, value.n);
}
const productHtml = (values, decimal = false) => values.map(value => operandHtml(value, decimal)).join('×');
const productText = (values, decimal = false) => values.map(value => operandText(value, decimal)).join('×');
const groupedProductText = (groups, decimal = false) => groups.map(group => `[${group.length ? productText(group, decimal) : '1'}]`).join('×');
function multiplicationQuestion(rng, a, b, difficulty, decimal = false, withStep = false) {
  const result = multiplyRationals(a, b), zero = a.n === 0n || b.n === 0n;
  const sign = zero ? 'zero' : (a.n > 0n) === (b.n > 0n) ? 'same' : 'different';
  const rules = { zero: '有乘数为0，积为0', same: '两个非零乘数同号，积为正，绝对值相乘', different: '两个非零乘数异号，积为负，绝对值相乘' };
  const q = numericQuestion({ difficulty, prompt: '计算两个有理数的积。', mathHtml: productHtml([a, b], decimal), result,
    hint: '先检查0，再确定积的正负，最后把绝对值相乘。',
    solution: [rules[sign] + '。', `${productText([a, b], decimal)}＝${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal) });
  if (withStep) attachStep(rng, q, '关键步骤：先选本题适用的符号规则', Object.entries(rules).map(([key, label]) => ({ label, correct: key === sign })));
  return q;
}
function rationalMultiplication(rng) {
  const a = int(rng, 2, 9), b = int(rng, 2, 8), sameSign = pick(rng, [-1, 1]);
  const d = pick(rng, [3, 5, 7]), n = int(rng, 1, d - 1), sign = pick(rng, [-1, 1]);
  const per = rational(BigInt(-int(rng, 2, 8))), count = rational(BigInt(int(rng, 2, 7))), weather = rng() < 0.5;
  const change = multiplyRationals(per, count), unit = weather ? '℃' : '元';
  const context = numericQuestion({ difficulty: 'variation',
    prompt: weather ? `气温上升记正、下降记负。每登高1千米，气温变化为${readable(per)}℃，登高${readable(count)}千米。求带符号的气温总变化量。` : `销售额增加记正、减少记负。每件商品降价${readable(magnitude(per))}元，售出${readable(count)}件。与按原价售出同样数量相比，求带符号的销售额变化量。`,
    mathHtml: `每份变化：${operandHtml(per)}；份数：${operandHtml(count)}`, result: change, label: '带符号的总变化量',
    hint: '题目求总变化，不是最后的温度或销售额；每份减少记负，再乘正的份数。',
    solution: [`每份变化为${readable(per)}${unit}，共有${readable(count)}份。`, `${productText([per, count])}＝${readable(change)}${unit}，表示${weather ? '气温下降' : '销售额减少'}${readable(magnitude(change))}${unit}。`], answerDisplay: `${readable(change)}${unit}` });
  context.input.unit = unit;
  attachStep(rng, context, '关键步骤：哪一个式子表示带符号的总变化？', [
    { label: productText([per, count]), correct: true }, { label: sumText([per, count]) },
    { label: productText([magnitude(per), count]) }, { label: `${operandText(per)}÷${operandText(count)}` },
  ]);
  return [
    multiplicationQuestion(rng, rational(BigInt(sameSign * a)), rational(BigInt(sameSign * b)), 'basic'),
    multiplicationQuestion(rng, rational(BigInt(-pick(rng, [13, 17, 23, 27])), 10n), rational(BigInt(pick(rng, [3, 7, 11])), 10n), 'basic', true),
    multiplicationQuestion(rng, rational(0n), rational(BigInt(-n), BigInt(d)), 'basic'),
    multiplicationQuestion(rng, rational(BigInt(-n), BigInt(d)), rational(BigInt(sign * int(rng, 1, 6)), 7n), 'variation', false, true), context,
  ];
}
function reciprocalQuestion(value, difficulty, decimal = false) {
  const result = reciprocalOf(value);
  return numericQuestion({ difficulty, prompt: '求下面这个非零数的倒数。', mathHtml: decimal ? finiteDecimalText(value) : numberHtml(value), result, label: '倒数',
    hint: '倒数要使乘积为1。保持符号，交换非零分数的分子与分母；不是取相反数。',
    solution: [`原数为${numberText(value, decimal)}，要找与它相乘得1的数。`, `${operandText(value, decimal)}×${operandText(result)}＝1，所以倒数为${readable(result)}。`], answerDisplay: readable(result) });
}
function reciprocals(rng) {
  const n = int(rng, 2, 5), first = rational(BigInt(-n), BigInt(n + 1)), relationCase = int(rng, 0, 3);
  const left = relationCase === 3 ? rational(0n) : first;
  const right = relationCase === 0 ? reciprocalOf(first) : relationCase === 1 ? negate(first) : relationCase === 2 ? negate(reciprocalOf(first)) : rational(BigInt(n));
  const yes = equal(multiplyRationals(left, right), rational(1n));
  const relation = chooseAnswer(rng, '是否互为倒数', [{ label: '互为倒数', correct: yes }, { label: '不互为倒数', correct: !yes }]);
  const judge = { difficulty: 'basic', prompt: '判断给定的两个数是否互为倒数。', mathHtml: `${numberHtml(left)}　与　${numberHtml(right)}`, input: relation.input,
    hint: '直接检查乘积是否为1，和为0只能说明相反数关系。',
    solution: [`两个数的乘积为${readable(multiplyRationals(left, right))}。`, `乘积${yes ? '等于' : '不等于'}1，所以${yes ? '' : '不'}互为倒数。`], answerDisplay: yes ? '互为倒数' : '不互为倒数', expected: { value: relation.value } };
  const given = pick(rng, [rational(-1n, 4n), rational(2n, 5n), rational(-3n, 2n)]), decimal = rng() < 0.5;
  const reverse = reciprocalQuestion(given, 'variation', decimal);
  reverse.prompt = '已知数a的倒数是下面这个非零数，求a。'; reverse.input.label = '原数a';
  reverse.solution = [`若a与已知数互为倒数，a乘已知数也等于1。`, `再求已知数${numberText(given, decimal)}的倒数，得到a＝${readable(reciprocalOf(given))}。`];
  attachStep(rng, reverse, '关键步骤：由倒数怎样求原数？', [
    { label: '再求一次倒数，使原数与已知数的乘积为1', correct: true }, { label: '只改正负号，取相反数' }, { label: '倒数就是原数，所以直接照抄' },
  ]);
  const zeroChoice = chooseAnswer(rng, '0的倒数', [{ label: '0没有倒数', correct: true }, { label: '0' }, { label: '1' }, { label: '−1' }]);
  const zero = { difficulty: 'variation', prompt: '0的倒数是什么？', mathHtml: '0', input: zeroChoice.input,
    hint: '假如存在倒数，它与0的乘积必须为1；检查0与任意数相乘的结果。',
    solution: ['0与任何有理数相乘都得0，不能得到1。', '因此0没有倒数，不能用0或1填作它的倒数。'], answerDisplay: '0没有倒数', expected: { value: zeroChoice.value } };
  attachStep(rng, zero, '关键步骤：为什么0没有倒数？', [
    { label: '0乘任何数都为0，不可能乘成1', correct: true }, { label: '0的相反数是0，所以倒数也是0' }, { label: '任意两个数的乘积都能是1' },
  ]);
  return [reciprocalQuestion(rational(BigInt(pick(rng, [-1, 1]))), 'basic'), reciprocalQuestion(rational(BigInt(pick(rng, [-1, 1]) * int(rng, 2, 9))), 'basic'), judge, reverse, zero];
}
function multiplicationGroupingQuestion(rng, values, groups, instruction, difficulty, decimal = false) {
  const correctGroups = groups.map(indices => indices.map(index => values[index]));
  const flipped = correctGroups.map(group => [...group]); flipped[0][0] = negate(flipped[0][0]);
  const missing = correctGroups.map(group => [...group]); missing.at(-1).pop();
  const repeated = correctGroups.map(group => [...group]); repeated[0].push(values[0]);
  const result = productRationals(values);
  const q = numericQuestion({ difficulty, prompt: `${instruction}先选择运用乘法交换律与结合律的完整分组步骤，再计算积。`, mathHtml: productHtml(values, decimal), result,
    hint: '每个原乘数连同符号保留一次。换位与改变分组可以，改号、漏乘和重复乘不可以。',
    solution: ['用乘法交换律换位，再用结合律组成方便计算的小组。', `${groupedProductText(correctGroups, decimal)}＝${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal) });
  return attachStep(rng, q, '关键步骤：选择保留全部带符号乘数的分组', [correctGroups, flipped, missing, repeated].map((candidate, i) => ({ label: `交换律与结合律：${groupedProductText(candidate, decimal)}`, correct: i === 0 })));
}
function multiplicationGrouping(rng) {
  const a = int(rng, 2, 8), b = int(rng, 2, 9), d = pick(rng, [3, 5, 7]), n = int(rng, 1, d - 1);
  return [
    multiplicationGroupingQuestion(rng, [rational(2n), rational(BigInt(a)), rational(1n, 2n), rational(BigInt(-b))], [[0, 2], [1, 3]], '先把2与0.5放一组。', 'basic', true),
    multiplicationGroupingQuestion(rng, [rational(BigInt(-a)), rational(BigInt(b)), rational(-1n, BigInt(a)), rational(3n)], [[0, 2], [1, 3]], '先把互为倒数的两个负数放一组。', 'basic'),
    multiplicationGroupingQuestion(rng, [rational(-25n), rational(BigInt(a)), rational(-4n)], [[0, 2], [1]], '先把能乘成100的两个数放一组。', 'basic'),
    multiplicationGroupingQuestion(rng, [rational(BigInt(n), BigInt(d)), rational(-3n), rational(BigInt(d), BigInt(n)), rational(-2n, 3n)], [[0, 2], [1, 3]], '把互为倒数的两个正分数放一组，再把能约分的两个负数放一组。', 'variation'),
    multiplicationGroupingQuestion(rng, [rational(-5n, 4n), rational(BigInt(a)), rational(8n), rational(-1n, 2n)], [[0, 2], [1, 3]], '先把−1.25与8放一组。', 'variation', true),
  ];
}
function productSignQuestion(rng, values, difficulty, changeIndex = null, decimal = false) {
  const actual = values.map((value, index) => index === changeIndex ? negate(value) : value);
  const zero = actual.some(value => value.n === 0n), negatives = actual.filter(value => value.n < 0n).length;
  const category = zero ? '0' : negatives % 2 ? '负数' : '正数';
  const choice = chooseAnswer(rng, '只判断新积的符号', ['正数', '负数', '0'].map(label => ({ label, correct: label === category })));
  const q = { difficulty, prompt: changeIndex === null ? '不计算积的绝对值，只判断这个积为正数、负数还是0。' : `把下式第${changeIndex + 1}个乘数换成它的相反数，其他乘数不变。不计算绝对值，只判断改变后的积。`,
    mathHtml: productHtml(values, decimal), input: choice.input,
    hint: '先看改变后是否仍含0；没有0时，才数负乘数的个数并判断奇偶。',
    solution: [changeIndex === null ? '先检查所有乘数是否含0。' : `改变后的带符号乘数为${productText(actual, decimal)}。`, zero ? '仍有乘数为0，所以积为0，负乘数的个数不再决定正负。' : `没有乘数为0，负乘数有${negatives}个，是${negatives % 2 ? '奇' : '偶'}数个，所以积为${category}。`], answerDisplay: category, expected: { value: choice.value } };
  if (difficulty === 'variation') attachStep(rng, q, '关键步骤：本题应按哪一种顺序判定？', [
    { label: zero ? '先发现乘数0，直接判积为0' : `先排除0，再数出${negatives}个负乘数，按${negatives % 2 ? '奇' : '偶'}数判断`, correct: true },
    { label: zero ? '不看0，只要有负乘数就判负' : `先排除0，再数出${negatives}个负乘数，按${negatives % 2 ? '偶' : '奇'}数判断` },
    { label: '只看第一个乘数的符号，不检查其余乘数' },
  ]);
  return q;
}
function productSigns(rng) {
  const a = rational(BigInt(int(rng, 2, 11))), b = rational(BigInt(int(rng, 2, 9))), c = rational(BigInt(int(rng, 2, 7)));
  const modified = [negate(a), b, negate(c), rng() < 0.35 ? rational(0n) : rational(BigInt(pick(rng, [-1, 1]) * int(rng, 2, 8)))];
  return [
    productSignQuestion(rng, [a, b, rational(2n, 7n), c], 'basic'),
    productSignQuestion(rng, [negate(a), b, negate(c), rational(-3n, 5n)], 'basic'),
    productSignQuestion(rng, [negate(a), rational(0n), negate(b), negate(c)], 'basic'),
    productSignQuestion(rng, [negate(a), rational(-3n, 10n), b, rational(7n, 10n)], 'variation', null, true),
    productSignQuestion(rng, modified, 'variation', 0),
  ];
}
const distributedHtml = (common, terms, decimal = false) => terms.map(term => productHtml([common, term], decimal)).join('＋');
const distributedText = (common, terms, decimal = false) => terms.map(term => productText([common, term], decimal)).join('＋');
const factoredHtml = (common, terms, decimal = false) => `${operandHtml(common, decimal)}×[${sumHtml(terms, decimal)}]`;
const factoredText = (common, terms, decimal = false) => `${operandText(common, decimal)}×[${sumText(terms, decimal)}]`;
function distributionQuestion(rng, common, terms, reverse, difficulty, decimal = false) {
  const result = multiplyRationals(common, sumRationals(terms));
  const flipped = [...terms]; flipped[flipped.length - 1] = negate(flipped.at(-1));
  const correct = reverse ? factoredText(common, terms, decimal) : distributedText(common, terms, decimal);
  const wrong = reverse ? [factoredText(negate(common), terms, decimal), factoredText(common, terms.slice(0, -1), decimal), factoredText(common, flipped, decimal)]
    : [distributedText(common, terms.slice(0, -1), decimal), distributedText(common, flipped, decimal), `${productText([common, terms[0]], decimal)}＋${sumText(terms.slice(1), decimal)}`];
  const q = numericQuestion({ difficulty, prompt: `先选择${reverse ? '逆用分配律提取共同乘数' : '使用分配律逐项展开'}的完整步骤，再简算。每一项及其符号都应保留。`,
    mathHtml: reverse ? distributedHtml(common, terms, decimal) : factoredHtml(common, terms, decimal), result,
    hint: reverse ? '找到每项都有的共同乘数，把剩余各项连同正负号放进括号；不是任意改号。' : '括号中有几项，共同乘数就要分别乘几项。每项都保留，不漏乘、不改号。',
    solution: [reverse ? '逆用分配律，把各项共同的乘数保留在括号外一次。' : '把共同乘数分别与括号中的每一个带符号项相乘。', `${correct}＝${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal) });
  return attachStep(rng, q, '关键步骤：选择本题要求的完整分配律步骤', [{ label: correct, correct: true }, ...wrong.map(label => ({ label }))]);
}
function distribution(rng) {
  const a = int(rng, 2, 7), b = a + int(rng, 1, 4), common = rational(BigInt(-int(rng, 2, 8)));
  return [
    distributionQuestion(rng, common, [rational(BigInt(a)), rational(BigInt(-b))], false, 'basic'),
    distributionQuestion(rng, rational(BigInt(-int(rng, 2, 7))), [rational(BigInt(a)), rational(BigInt(-b))], true, 'basic'),
    distributionQuestion(rng, rational(BigInt(pick(rng, [12, 24, 36]))), [rational(1n, 4n), rational(1n, 6n), rational(-1n, 2n)], false, 'basic'),
    distributionQuestion(rng, rational(BigInt(-int(rng, 1, 4)), 5n), [rational(-2n, 3n), rational(17n, 3n)], true, 'variation'),
    distributionQuestion(rng, rational(-1n, 2n), [rational(6n, 5n), rational(-2n, 5n), rational(13n, 5n)], false, 'variation', true),
  ];
}
function divisionQuestion(rng, a, b, difficulty, decimal = false, withStep = false) {
  const inverse = reciprocalOf(b);
  if (!inverse) throw new Error('除法题的除数不能为0。');
  const result = multiplyRationals(a, inverse);
  const q = numericQuestion({ difficulty, prompt: withStep ? '先选择转为乘除数倒数的完整步骤，再求商。' : '计算有理数的商，先检查除数不为0。', mathHtml: `${operandHtml(a, decimal)}÷${operandHtml(b, decimal)}`, result,
    hint: '被除数不变，把除法改为乘法，只对非零除数取倒数；不能把倒数误作相反数。',
    solution: [`除数${numberText(b, decimal)}不为0，它的倒数是${readable(inverse)}。`, `${productText([a, inverse])}＝${numberText(result, decimal)}。`], answerDisplay: numberText(result, decimal) });
  if (withStep) attachStep(rng, q, '关键步骤：选择乘除数倒数的正确转换', [
    { label: productText([a, inverse]), correct: true }, { label: productText([a, negate(b)]) }, { label: productText([a, b]) }, { label: productText([reciprocalOf(a), b]) },
  ]);
  return q;
}
function rationalDivision(rng) {
  const a = int(rng, 2, 9), b = int(rng, 2, 7);
  const invalidChoice = chooseAnswer(rng, '选择除数为0的式子', [
    { label: `(${a})÷(0)`, correct: true }, { label: `(0)÷(−${b})` }, { label: `(−${a})÷(${b})` }, { label: `(${b})÷(−${a})` },
  ]);
  const boundary = { difficulty: 'variation', prompt: '下面哪一个除法没有意义？先检查除数的位置。', mathHtml: '除数必须不为0', input: invalidChoice.input,
    hint: '不能除以0；0作被除数、除数非0时，商是0。',
    solution: [`(${a})÷0的除数为0，不能进行这个除法。`, `0÷(−${b})的除数不为0，是合法运算，商为0。`], answerDisplay: `${a}÷0没有意义`, expected: { value: invalidChoice.value } };
  attachStep(rng, boundary, '关键步骤：0在哪个位置不允许？', [
    { label: '除数不能为0；0可以作被除数', correct: true }, { label: '只要出现0，任何除法都没有意义' }, { label: '除数为0时，商也规定为0' },
  ]);
  return [
    divisionQuestion(rng, rational(BigInt(-a * b)), rational(BigInt(b)), 'basic'),
    divisionQuestion(rng, rational(-12n, 25n), rational(-3n, 5n), 'basic', false, true),
    divisionQuestion(rng, rational(0n), rational(BigInt(pick(rng, [-1, 1]) * b)), 'basic'),
    divisionQuestion(rng, rational(BigInt(-pick(rng, [13, 26, 39])), 10n), rational(13n, 100n), 'variation', true, true), boundary,
  ];
}
function ratioCandidate(label, n, d, integerOnly = false) {
  const html = d === 1n && integerOnly ? display(n) : fractionHtml(n, display(d));
  return { label, html };
}
function normalizedRatioQuestion(rng, rawN, rawD, difficulty, decimal = false) {
  const result = rational(rawN, rawD);
  const label = readable(result);
  const options = [{ ...ratioCandidate(label, result.n, result.d, result.d === 1n), correct: true }];
  // The alternatives can be numerically equivalent. This task deliberately
  // grades the requested canonical representation through complete choices.
  if (result.n === 0n) options.push(ratioCandidate('0/5', 0n, 5n), ratioCandidate('0/−3', 0n, -3n), ratioCandidate('0/0', 0n, 0n));
  else if (result.d === 1n) options.push(ratioCandidate(`${result.n}/1`, result.n, 1n), ratioCandidate(`${result.n * 2n}/2`, result.n * 2n, 2n), ratioCandidate(`${-result.n}/−1`, -result.n, -1n));
  else options.push(ratioCandidate(`${result.n * 2n}/${result.d * 2n}`, result.n * 2n, result.d * 2n), ratioCandidate(`${-result.n}/−${result.d}`, -result.n, -result.d), ratioCandidate(readable(negate(result)), -result.n, result.d));
  const chosen = chooseAnswer(rng, '选择等值且符合本题规范的完整写法', options);
  const source = decimal ? finiteDecimalText(result) : fractionHtml(rawN, display(rawD));
  const q = { difficulty, prompt: '按本项目规范选择原数的写法：分子分母为互质整数、分母为正；能化成整数时直接写整数，0写0。既要等值，也要符合形式。', mathHtml: source, input: chosen.input,
    hint: '先判整体符号，再约分并统一为正分母。与原数等值的写法，也可能没有约分或不符合整数写法要求。',
    solution: [decimal ? '把有限小数按位数写成两个整数之比，再约分。' : '按分子分母的符号确定整体正负，同时约去公因数。', `原值为${readable(result)}；本题规范写法为${label}${result.d === 1n ? '，整数直接写整数' : '，分母正且分子分母互质'}。`], answerDisplay: label, expected: { value: chosen.value } };
  if (difficulty === 'variation') attachStep(rng, q, '关键步骤：还需要检查哪些规范条件？', [
    { label: '既保持原值，又约分、使分母为正；整数与0直接写出', correct: true }, { label: '数值相等就行，分母正负与是否约分都不用检查' }, { label: '分子分母可同时变成0，仍算同一个有理数' },
  ]);
  return q;
}
function normalizedRatios(rng) {
  const factor = BigInt(int(rng, 2, 6)), n = BigInt(pick(rng, [3, 5, 7])), d = 2n;
  const decimal = pick(rng, [rational(-3n, 4n), rational(6n, 5n), rational(-7n, 10n), rational(1n, 4n)]);
  const integer = BigInt(pick(rng, [-7, -3, 2, 6]));
  return [
    normalizedRatioQuestion(rng, -factor * n, -factor * d, 'basic'),
    normalizedRatioQuestion(rng, factor * 5n, -factor * 7n, 'basic'),
    normalizedRatioQuestion(rng, decimal.n, decimal.d, 'basic', true),
    normalizedRatioQuestion(rng, 0n, -BigInt(int(rng, 2, 9)), 'variation'),
    normalizedRatioQuestion(rng, integer * factor, factor, 'variation'),
  ];
}

export function generateQuestions(moduleId, seed = 'default') {
  if (!modules.some(m => m.id === moduleId)) throw new RangeError('没有找到这个学习项目。');
  const seedValue = String(seed);
  const rng = random(`${moduleId}:${seedValue}`);
  const generator = {
    'N-NEG-COMP': negatives, 'A-LIKE-COMBINE': likeTerms, 'G-BISECTOR-CALC': angles,
    'C1-04': axisStructure, 'C1-05': pointsAndNumbers, 'C1-06': opposites,
    'C1-07': signSimplification, 'C1-08': absoluteValues,
    'C1-01': signsAndZero, 'C1-02': contextualSigns, 'C1-03': rationalClassification,
    'C1-09': distancesToZero, 'C1-10': orderingNumbers, 'C1-11': inverseAbsoluteValues,
    'C2-01': rationalAddition, 'C2-02': sumChanges, 'C2-03': additionGrouping,
    'C2-04': standardTotals, 'C2-05': rationalSubtraction,
    'C2-06': mixedAdditionSubtraction, 'C2-07': twoPointDistances,
    'C2-08': rationalMultiplication, 'C2-09': reciprocals, 'C2-10': multiplicationGrouping,
    'C2-11': productSigns, 'C2-12': distribution, 'C2-13': rationalDivision, 'C2-14': normalizedRatios,
  }[moduleId];
  return generator(rng).map((q, i) => ({ id: `${moduleId}-${hash(seedValue).toString(36)}-${i + 1}`, moduleId, ...q }));
}

export function gradeAnswer(question, answer) {
  const invalid = message => ({ valid: false, correct: false, message });
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || typeof answer.value !== 'string' || !answer.value.trim()) return invalid('请先填写答案，再正式提交。');
  let correct;
  if (question?.input?.type === 'number') {
    const actual = parseNumber(answer.value);
    if (!actual) return invalid('请填写整数、小数或简单分数；分数的分母不能为0。');
    const expected = parseNumber(question.expected.value);
    if (!expected) throw new Error('题目答案配置不合法。');
    correct = equal(actual, expected);
  } else if (question?.input?.type === 'choice') {
    if (!question.input.options.some(o => o.value === answer.value)) return invalid('请从给出的选项中选择一个答案。');
    correct = answer.value === question.expected.value;
  } else return invalid('这道题暂时无法判定，请重新载入。');
  if (question.step) {
    if (typeof answer.step !== 'string' || !question.step.options.some(o => o.value === answer.step)) return invalid('请同时选择关键步骤，再提交。');
    correct = correct && answer.step === question.expected.step;
  }
  if (!correct && question.moduleId === 'C2-14' && answer.value !== question.expected.value) {
    const selected = parseNumber(question.input.options.find(o => o.value === answer.value).label);
    const required = parseNumber(question.input.options.find(o => o.value === question.expected.value).label);
    if (selected && required && equal(selected, required)) return { valid: true, correct: false, message: '这个写法与原数等值，但不符合本题规范，请检查约分、分母符号和整数写法。' };
  }
  return { valid: true, correct, message: correct ? '答对了！' : question.step ? '还差一点，请检查答案和关键步骤。' : '再想一想，可以先检查所用规则。' };
}

export function publicQuestion(question) {
  // A whitelist keeps future internal fields private too. Copies prevent a
  // renderer from mutating the answer-bearing persisted question accidentally.
  const output = {};
  for (const key of ['id', 'moduleId', 'difficulty', 'prompt', 'mathHtml']) if (question[key] !== undefined) output[key] = question[key];
  const input = {};
  for (const key of ['type', 'label', 'unit', 'suffixHtml', 'placeholder']) if (question.input[key] !== undefined) input[key] = question.input[key];
  if (question.input.options) input.options = question.input.options.map(o => {
    const value = { value: o.value, label: o.label };
    if (o.html !== undefined) value.html = o.html;
    return value;
  });
  output.input = input;
  if (question.step) output.step = { label: question.step.label, options: question.step.options.map(o => ({ value: o.value, label: o.label })) };
  if (question.diagram) {
    const diagram = question.diagram;
    const fields = diagram.type === 'numberline' ? ['type', 'min', 'max', 'arrow', 'originVisible']
      : diagram.type === 'axis-check' ? ['type', 'variant', 'unit'] : ['type', 'angle', 'rotation', 'known'];
    output.diagram = Object.fromEntries(fields.filter(key => diagram[key] !== undefined).map(key => [key, diagram[key]]));
    if (diagram.type === 'numberline') {
      output.diagram.ticks = diagram.ticks.map(tick => ({ position: tick.position, ...(tick.label === undefined ? {} : { label: tick.label }) }));
      output.diagram.points = diagram.points.map(point => ({ position: point.position, label: point.label }));
    }
  }
  return output;
}
