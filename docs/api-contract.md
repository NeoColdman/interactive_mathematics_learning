# 学习项目与记录实现约定

开发协作约定，产品规则以已确认需求为准。

## 数学内容模块 domain/content.mjs

导出 `modules`（已上线目标元数据）、`generateQuestions(moduleId, seed)`（稳定生成5题，3 basic+2 variation）、`gradeAnswer(question, answer)`（返回 `{valid,correct,message}`）、`publicQuestion(question)`（去除expected/hint/solution等答案数据）。

module: `{id,title,chapter,chapterTitle,section,pages,goal,lead,prerequisites:[string],prerequisiteIds?:[string],rule,example:{question,answer,steps:[string]},learningSteps:[{title,prompt,instruction}]}`。第一阶段固定ID：N-NEG-COMP、A-LIKE-COMBINE、G-BISECTOR-CALC；0.2.0新增C1-04、C1-05、C1-06、C1-07、C1-08。已存在ID不重命名。

0.3.0新增C1-01、C1-02、C1-03、C1-09、C1-10、C1-11，当时共14模块；第一章为C1-01—C1-11加N-NEG-COMP共12核心项目。排序和多解集合使用完整单选答案，不新增表达式或集合输入解析。

0.4.0新增C2-01—C2-07，当时共21模块、第二章7/25个核心项目。加法分组、减法转换和混合式使用完整选项或关键步骤搭配数值输入，不新增表达式求值接口。

0.5.0新增C2-08—C2-14，共28模块，第二章上线14/25个核心项目。乘法分组、分配律、倒数转换用完整步骤选项；规范分数形式用完整单选项，以区分等值与符合形式要求。0无倒数、除数0等边界用明确的选项，不向数值解析器增加特殊字符串。旧ID及schema-1格式不变。

question: `{id,moduleId,difficulty:'basic'|'variation',prompt,mathHtml,input:{type:'choice'|'number',label?,unit?,suffixHtml?,placeholder?,options?:[{value,label,html?}]},step?:{label,options:[{value,label}]},diagram?:{type:'angle',angle,rotation,known:'whole'|'half'|'other-half'},hint:string,solution:[string],answerDisplay:string,expected:{value,step?}}`。answer统一为 `{value:string,step?:string}`。mathHtml、suffixHtml和选项html为内部作者生成的可信数学排版，动态用户输入必须转义。number允许整数、小数、简单分数，使用精确有理数比较。valid=false仅为空或不可解析输入；数学上错误的可判定回答valid=true。

数轴题另支持以下diagram，仍使用同一题目与作答结构：

- `{type:'numberline',min,max,ticks:[{position,label?}],points:[{position,label}],arrow?:boolean,originVisible?:boolean}`。position为抽象几何坐标，数值由刻度label表达；没有label的刻度不显示数值。点的label用于A/B等名称，不自动写出待求数值。
- `{type:'axis-check',variant:'valid'|'no-origin'|'no-direction'|'uneven-units',unit:number}`。图形体现规范数轴画法的结构条件，题目用choice或number判定学习目标。

题目、expected、提示和解析以快照保存；新增模块不重新生成旧轮次，也不改变旧错题的首次成绩。schemaVersion保持1，新模块复用现有持久化流程。

## HTTP

- GET /api/bootstrap → `{modules,chapters:[{number,title,count}],profiles,connection:{localUrl,lanUrls,qrUrl},version}`
- POST /api/profiles `{name}` → profile
- GET /api/profiles/:profileId → `{profile,progress:{[moduleId]:{mode,step,updatedAt}},rounds:[publicRound],mistakes:[publicMistake]}`
- POST /api/profiles/:id/progress `{moduleId,mode:'learn'|'practice',step:number}` → `{progress}`
- POST /api/profiles/:id/rounds `{moduleId}` → publicRound
- GET /api/profiles/:id/rounds/:rid → publicRound
- POST /api/profiles/:id/rounds/:rid/questions/:qid/submit `{answer,requestId}` → `{valid,correct,message,round}`
- POST 同路径 /hint → `{hint,round}`
- POST 同路径 /solution → `{solution,answerDisplay,round}`
- POST /api/profiles/:id/mistakes/:mid/review `{answer,requestId}` → `{valid,correct,message,mistake}`
- GET /api/qr.svg?url=... → 本服务地址的真实二维码SVG。

publicRound: `{id,moduleId,createdAt,questions:[publicQuestion+{state}],summary:{completed,total:5,independentCorrect,passed,finished}}`。

state: `{attemptCount,firstAnswer:null|answer,firstCorrect,independentCorrect,usedHint,viewedSolution,completed,latestCorrect,completion:null|'independent'|'retry'|'hint'|'solution',lastAnswer,feedback,hint?:string,solution?:[string],answerDisplay?:string}`。

首次答错产生错题。提示/解析可在提交前查看，计分以首次提交前辅助状态为准；提交正确后查看解析不回改首次成绩。解析查看可将该题标为已看解析完成，独立计分仍为0。全部5题完成且独立正确≥4才passed。无效输入不消耗首次作答。原错题复习不创建新题轮次，不改原成绩。

publicMistake: `{id,roundId,questionId,moduleId,createdAt,question:publicQuestion,firstAnswer,usedHint,viewedSolution,corrected,reviewAttempts:[{answer,correct,at}],hint,solution,answerDisplay}`。错题复习可以查看原解析；只记录复习结果。

错误JSON `{error:中文说明}`，前端每次操作等待保存响应并显示失败，服务端集中JSON原子持久化。选择档案ID可在浏览器暂存，学习记录以电脑为准。
