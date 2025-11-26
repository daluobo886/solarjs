# solarjs

本仓库提供一个无需构建、直接通过浏览器打开的 three.js 太阳系演示。打开根目录下的 `index.html` 即可运行，适合部署到 GitHub Pages（`https://<用户名>.github.io/solarjs/`）。

主要特性：
- 太阳、8 大行星、代表性卫星、土星光环、小行星带与星空背景。
- 全部使用本地 `three.module.js`，无外部依赖、无需联网下载资源。
- 自定义 OrbitControls 交互：拖拽旋转、滚轮缩放、右键/CTRL 平移，支持行星列表一键飞行视角。

可调参数（位于 `main.js` 顶部附近）：
- `timeScale`：动画时间倍率，调节整体速度。
- `orbitSpeedScale`、`rotationSpeedScale`：控制公转和自转速度。
- `planetDefinitions`：行星大小、轨道半径、颜色、倾角等基础信息。

