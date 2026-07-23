# WorkBuddy 皮肤开发工作流

本技能把"给 WorkBuddy 客户端换肤"的整套方法沉淀成可复用的工具。核心思路:
**不修改 WorkBuddy 安装目录、不碰 app.asar**,而是通过 Chrome DevTools Protocol (CDP)
把一段 CSS 注入渲染进程。重启即失,但启动器每次自动重注,故更新 WorkBuddy 不受影响。

## 四步循环

### 1. Inspect —— 抓真实 DOM / CSS 变量
WorkBuddy 以 `--remote-debugging-port=9222` 启动后,用注入器的只读模式看真实结构:

```
node inject.mjs inspect
```

输出: `:root` 上的 CSS 变量、`body` 的 class、以及含 sidebar/panel/chat/message/input
等关键词的类名清单。把这些类名记下来,皮肤就靠它们定位元素。

> 类名大多带哈希后缀(如 `_assistantMessage_14nyt_190`),会随 WorkBuddy 版本变化。
> 每次大版本更新后重跑 inspect,按需更新选择器即可。

### 2. Author —— 写皮肤 CSS
新建一个 `<name>.css`,用第 1 步拿到的类名覆盖样式。约定:
- 全屏根容器设 `background: transparent`,把氛围交给一个固定的背景层。
- 面板/气泡用半透明色,做出"玻璃感"。
- 强调色统一走一个 CSS 变量(如 `--accent`),改色只动一处。
- 发送/强调按钮不用颜色识别(空输入时常变灰),由注入器自动加一个 marker class
  (默认 `__forest_send`,可在 `skin.config.json` 的 `marker` 改),皮肤只管给它上样式。

### 3. Inject —— 注入预览
已开调试端口时直接注入,实时看效果:

```
node inject.mjs inject          # 读 skin.config.json
node inject.mjs remove          # 还原官方皮肤
```

不满意就改 CSS,再 inject 一次(幂等,可反复覆盖)。

### 4. Share —— 打包分享
用脚手架一键生成自包含的分享文件夹(别人双击即用):

```
node scaffold.mjs <皮肤名> [目录]   # 生成 inject/launch/config/css + 启动入口
```

分享出去的文件夹纯绿色:对方解压后双击 `启动.vbs`(Windows)或 `launch.command`(macOS),
脚本自动找 WorkBuddy 与 node,拉起带调试端口的实例并注入。删除文件夹即卸载。

## 关键文件职责

| 文件 | 职责 |
|------|------|
| `scripts/inject.mjs` | CDP 注入器。inject / remove / inspect 三模式,与具体皮肤解耦 |
| `scripts/launch.mjs` | 跨平台启动器。探测 WB+node,拉起带端口实例,等端口就绪后注入 |
| `scripts/gen-share.mjs` | 为皮肤文件夹生成双击即用入口(按当前系统) |
| `scripts/scaffold.mjs` | 从 `assets/template.css` 生成一个新皮肤项目 |
| `assets/template.css` | 极简起步皮肤(占位符 `__SKIN_ID__` / `__SKIN_MARKER__`) |
| `assets/forest-theme-skin.css` | 已验证的"东方森系"参考皮肤(含背景图) |
| `skin.config.json` | 当前皮肤配置: css / id / marker / glow / port |

## 在技能里直接套用内置森系皮肤
技能自带 `skin.config.json` 指向森系皮肤。在本技能目录下:

```
node launch.mjs        # 自动启动 WorkBuddy 并注入森系皮肤
# 或 Windows 双击 启动.vbs (若已 gen-share 生成)
```
