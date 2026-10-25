# Three.js 离线运行资源

版本：0.170.0（r170）。用于学习陪伴精灵的静态人物预览；资源随项目提供，运行时不访问 CDN。

## 文件与来源

| 文件 | 上游包内路径 | 本地调整 |
| --- | --- | --- |
| `three.module.js` | `three@0.170.0/build/three.module.js` | 无 |
| `OrbitControls.js` | `three@0.170.0/examples/jsm/controls/OrbitControls.js` | 将裸模块 `three` 的导入改为同目录 `./three.module.js` |
| `GLTFLoader.js` | `three@0.170.0/examples/jsm/loaders/GLTFLoader.js` | 将 `three` 与 `BufferGeometryUtils` 的导入改为同目录本地路径 |
| `BufferGeometryUtils.js` | `three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js` | 将裸模块 `three` 的导入改为同目录 `./three.module.js` |
| `LICENSE` | `three@0.170.0/LICENSE` | 无，保留 MIT 许可证 |

来源：制作时已安装的 `three@0.170.0` npm 包，位于本机 `/Users/zhenyu/dev/physics/inclined-plane-lab/node_modules/three`。上游为 [Three.js](https://github.com/mrdoob/three)，许可证见同目录 `LICENSE`。此本机路径仅用于来源追溯，运行不依赖原安装目录。

该版本的 `three.module.js` 为独立 ES 模块，无需 `three.core.js`。`OrbitControls.js` 仅导入本地 `three.module.js`。

GLTFLoader 用于直接显示用户提供的 GLB；模型加载器在应用侧把贴图索引映射到本地预览 PNG，无需开放 blob URL、外网或额外解码服务。
