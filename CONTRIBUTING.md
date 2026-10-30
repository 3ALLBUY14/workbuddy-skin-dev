# 参与开发

## 环境

- Node.js 22+（WorkBuddy 自带，位于 `%USERPROFILE%\.workbuddy\binaries\node`）
- 已安装 WorkBuddy 桌面客户端

## 常用命令

```bash
node scripts/launch.mjs                 # 启动带调试端口的 WorkBuddy 并注入
node scripts/inject.mjs inspect         # 检查当前界面的类名/结构
node scripts/inject.mjs inject          # 注入皮肤
node scripts/inject.mjs remove          # 还原官方皮肤
node scripts/scaffold.mjs my-theme ./skins   # 新建一套皮肤
node scripts/shot.mjs                   # 截图，产物写到 artifacts/
```

## 提交前

- 跑 `node scripts/inject.mjs inspect`，确认类名仍然有效。
- 改脚本后至少完整走一遍「启动 → 注入 → 还原」。
- 不提交 `artifacts/`、截图、日志和个人环境配置。
- 路径一律使用占位符（如 `D:\Path\To\...`），不要写死本机目录。

## PR 约定

- 一个 PR 只做一件事。
- 说明 WorkBuddy 版本、复现步骤、修复前后行为。
- 新增能力同步更新 `README.md`、`docs/` 与 `references/`。
- 不修改 `app.asar`，只用 CDP 注入 CSS。
- 贡献默认采用本仓库的 MIT 许可。
