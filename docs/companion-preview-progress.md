# 静态人物预览进度

更新日期：2026-10-25。当前路线：直接使用用户指定的 `3D/hatsune_miku_v6.glb`。状态：用户已回复“形象确认”，静态形象验收通过；七类[动作样板](companion-motion-sample.md)已完成，等待用户与孩子试用。

## 路线变更

用户反馈程序化灰模效果不理想，明确要求直接使用现成 GLB。当前页面展示的是该外部模型本身，而不是新的程序化重建。原灰模的评审历史、修正上限和停止状态保留为历史记录，不重置、不降低原检查标准。

## 查看方式与表现

启动项目后访问 `/companion-preview.html`。本次独立预览服务为 [本机人物预览](http://127.0.0.1:3211/companion-preview.html)，使用临时学习数据，不接触正式学习记录。

页面包含原始 PNG 参考、GLB 大尺寸人物、正面/左右/背面视角、拖动旋转、缩放、浅深背景，以及约 220px 的角落尺寸预览。静态页面仅在视角、尺寸或背景改变时重绘。

模型保持源文件的展臂姿态、几何、UV 和材质分配，只通过父级变换调整展示比例与位置。模型本身的服装与脸部样式以 GLB 为准，PNG 继续作为参考。

## 文件与离线资源

| 项目 | 实际检查结果 |
| --- | --- |
| 源文件 | `3D/hatsune_miku_v6.glb`，26,672,976 字节（约 25.4 MiB） |
| 运行文件 | `public/companion/hatsune_miku_v6.glb`，与源文件 SHA-256 一致 |
| 加载入口 | `public/companion/load-miku-glb.js`，使用本地 Three.js r170 与 GLTFLoader |
| 模型结构 | 69 个节点、31 个网格、31 个材质、248,223 个三角形 |
| 贴图 | 13 张内嵌 PNG；预览版提取至本地 `textures/`，最长边限制为 2048，总计约 9.28 MiB |
| 来源标注 | 保留文件内声明的作者 not_here01-39、源页面与 CC BY 4.0；详情见 `public/companion/ATTRIBUTION.md` |
| 显示资源使用 | 主视图与角落预览复用一个 WebGL 上下文与一组贴图；角落预览通过二维画布展示 |
| 本地资源策略 | 贴图从同源本地路径加载，服务器原有资源限制未放宽；贴图不完整时显示立绘降级，不把白模误报为就绪 |
| 离线打包 | 文件收集检查确认包含 GLB、13 张预览贴图、加载器及来源标注 |

原文件及其内嵌原始贴图均未覆盖。预览贴图从 4096 缩小至最多 2048，是显示资源适配，不代表替换模型造型或制作新的材质内容。

## 浏览器验证

实际浏览器已确认模型、13 张贴图与脸部颜色能够显示；已保存正面、±35°、90°、135°、180°、270°及头部近景。最新记录位于 `.img2threejs/imported-glb/final-preview/`。

检查覆盖视角按钮、背景切换、键盘旋转、重置，以及桌面、820×1180 平板尺寸与 375×812 手机尺寸布局。检查报告记录页面错误、应用警告、外网请求及实际模型数量。平板与手机尺寸是 Chromium 模拟布局验证，不代表已在真实 iPad Safari 或手机设备上完成性能验收。

## 动画能力边界

原始文件没有 skin、骨骼绑定、动画片段或面部 morph target。静态文件可显示本身不代表已能表演动作，文件中的 `model_arm_5` 等名称也不能作为原文件已有骨架的证据。现已另建包含真实骨架、蒙皮与动作的派生文件，详见动作样板文档。

用户已确认静态形象，骨骼、蒙皮、面部表现和动作在单独的派生 GLB 中制作；本页静态预览及源文件继续保留原姿态。动作样板仍按[需求基线](learning-companion.md)分阶段确认。模型三角形和贴图数量较高，实际 iPad 流畅度需要设备试用验证。

## 可追溯证据

- `.img2threejs/imported-glb/asset-inspection.json`：原文件摘要、嵌入来源和结构数量。
- `.img2threejs/imported-glb/probe.json`：img2threejs 的 GLB 元数据检查结果。
- `.img2threejs/imported-glb/texture-preparation.json`：每张贴图的原始尺寸、预览尺寸与哈希。
- `.img2threejs/imported-glb/route.json`：直接使用外部模型的授权来源和当前阶段。
- `.img2threejs/imported-glb/final-preview/browser-report.json`：最新实际浏览器结果。
- `.img2threejs/archived-blockout-progress.md`：被替代的灰模进度全文；原 `.img2threejs/state.json` 保持停止状态。
