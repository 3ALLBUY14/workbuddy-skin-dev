# 踩坑清单 (Pitfalls)

把皮肤工具做稳,以下这些坑都趟过一遍。复用本技能即可规避大部分。

## 1. `.bat` 的中文路径乱码
症状: `.bat` 里写死中文路径(如 `D:\编程\开发软件皮肤`),运行时路径变成乱码,注入脚本找不到。
根因: cmd 默认按系统编码(GBK)解析,而脚本路径是 UTF-8。
解法:
- `.bat` 首行 `chcp 65001 >nul` 让 cmd 按 UTF-8 解析;
- 写 `.bat` 文件本身用 **UTF-8 无 BOM**(`fs.writeFileSync(p, s, 'utf8')`),绝不用 latin1;
- 换行用 **CRLF**(`\r\n`),纯 LF 在 cmd 下会闪退。

## 2. `.bat` 括号内 goto 破坏块解析
症状: 在 `if (...) { ... goto :end ... }` 里用 `goto`,cmd 会"找不到标签"直接闪退。
根因: cmd 的括号块解析对 `goto` 极脆弱。
解法: 端口等待用**顶层 `:wait_loop` 标签 + 循环**,所有 `goto` 都在括号外。
见 `scripts/launch.mjs` 的 Windows `.bat` 生成逻辑(本技能已采用顶层循环)。

## 3. 调试端口"已 bind 但 HTTP 未开"
症状: bat 用 TCP 连端口探测"端口已开",立刻 fetch 却 `fetch failed`。
根因: WorkBuddy 的 CDP HTTP 服务比 TCP bind 晚几秒就绪。
解法: 注入器对 `getTargets()` 做重试(最多 40 次,每次 1s,见 `inject.mjs` `main()`)。
启动器也等 `/json/version` 真正 200 才注入。

## 4. Node 路径不能赌系统 PATH
症状: 用户机器没装 node,或 PATH 里是别的版本,`node` 找不到。
解法: 优先用 WorkBuddy 自带的 node ——
`%USERPROFILE%\.workbuddy\binaries\node\versions\*\node.exe`;找不到再 `where node` 兜底。
`launch.mjs` 自身由 node 运行,直接用 `process.execPath` 作为 node。

## 5. 类名带哈希,版本一更新就失效
症状: 皮肤某块突然没样式。
根因: WorkBuddy 的 CSS Modules 类名带内容哈希(`_14nyt_190`),随构建变化。
解法: `node inject.mjs inspect` 抓当前真实类名,更新 CSS 选择器。
注入器内置的"已知类名"(空气泡清理、发送按钮标记)是通用结构选择器,较稳。

## 6. 流式生成的"空气泡"
症状: 异常时残留多条 1px 高的细横线。
根因: WorkBuddy 流式回复先 push 空消息壳,异常时壳没填内容也没清。
解法: 注入器周期性扫描"内部全空 且 高度 ≤2px"的消息气泡 `display:none`,一旦有内容自动解除。

## 7. 内联 background 压过皮肤
症状: 气泡/输入栏背景被应用运行时写入的内联 `background` 盖掉,半透明不生效。
解法: 注入器在每次注入时 `removeProperty('background'/'background-color'/'background-image')`
清掉已知类名上的内联背景,让 `<style>` 里的规则接管。

## 8. 发送按钮不能靠颜色识别
症状: 按"teal 图标"标记发送按钮,空输入(图标变灰)时标记丢失、圆角框回弹。
解法: 用**结构**识别 —— 输入框最右侧"纯图标无文字"的 button;或欢迎页独立 slot 的 button;
兜底: teal 图标 + 小尺寸 + 无文字。注入器只添加 marker class,绝不移除,各状态都保持。

## 9. 不要为了"更优雅"改 app.asar
风险: 改 `resources/app.asar` 重打包,WorkBuddy 更新会被覆盖,且误操作可能崩。
结论: 端口注入方案零侵入、更新免疫。除非用户明确接受风险,否则坚持端口方案。
