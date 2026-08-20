@echo off & chcp 65001 >nul & setlocal EnableDelayedExpansion
REM 备用入口：若 .vbs 被系统策略拦截，可用此 .bat（会闪一下黑框，属正常）
set "NODE="
for /d %%d in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do (
  if exist "%%d\node.exe" set "NODE=%%d\node.exe"
)
if "!NODE!"=="" (
  for /f "delims=" %%n in ('where node 2^>nul') do ( if "!NODE!"=="" set "NODE=%%n" )
)
if "!NODE!"=="" ( echo [ERROR] 找不到 Node.js，请用「森系启动.vbs」 & pause & goto :eof )
cd /d "%~dp0"
start "" "!NODE!" "forest-launch.mjs"
goto :eof
:eof
