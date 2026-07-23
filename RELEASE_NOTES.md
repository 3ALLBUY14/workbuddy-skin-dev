# WorkBuddy 皮肤开发 Skill v1.0.0

给 [WorkBuddy](https://www.codebuddy.cn) 桌面客户端做皮肤的一套可复用方法 —— 通过 **Chrome DevTools Protocol (CDP)** 把 CSS 注入渲染进程，**不修改安装目录、不碰 `app.asar`**，重启即失但启动器每次自动重注，WorkBuddy 更新免疫。

## ✨ 包含什么

- 🎨 **通用注入器** `inject.mjs` —— `inject` / `remove` / `inspect` 三模式，与具体皮肤解耦
- 🚀 **跨平台启动器** `launch.mjs` —— 自动探测 WorkBuddy 与 Node，拉起带调试端口的实例并注入（Windows / macOS / Linux）
- 🧱 **一键脚手架** `scaffold.mjs` —— 从模板生成一个自包含的新皮肤项目
- 📦 **绿色分享** —— 生成的皮肤文件夹双击即用，删除即卸载
- 🌿 **内置「东方森系」参考皮肤** —— 已验证可用，开箱即套（含竹林背景 + 玉色辉光）
- 🤖 **CI 自动打包** —— 每次 push / release 自动产出 `workbuddy-skin-dev.zip`

## 📸 预览

![东方森系皮肤真实截图](docs/preview.png)

## 🚀 快速开始

```bash
# 套用内置森系皮肤（自动启动并注入）
node scripts/launch.mjs

# 还原官方皮肤
node scripts/inject.mjs remove
```

做自己的皮肤：

```bash
node scripts/scaffold.mjs my-theme ./skins
cd ./skins/my-theme
node inject.mjs inspect      # 抓真实类名
# 编辑 my-theme.css 调色
node inject.mjs inject       # 预览
```

## 📦 安装为 WorkBuddy Skill

把本仓库放到（文件夹名即技能名 `workbuddy-skin-dev`）：

- 用户级：`~/.workbuddy/skills/workbuddy-skin-dev/`
- 项目级：`<你的仓库>/.workbuddy/skills/workbuddy-skin-dev/`

## ⚠️ 已知限制

- 注入是内存态，重启 WorkBuddy 需重新套用（启动器已自动处理）
- CSS Modules 哈希类名会随 WorkBuddy 版本变化，新版本请用 `inject.mjs inspect` 复查
- 内置森系皮肤背景图版权归原作者，仅作示例用途

## 📄 许可

MIT
