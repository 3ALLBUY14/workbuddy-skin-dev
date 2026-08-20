@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ---- node: 直接写死 WorkBuddy 自带 node 绝对路径, 不赌系统 PATH ----
set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe"
if not exist "%NODE_EXE%" (
  echo [ERROR] bundled node missing: %NODE_EXE%
  echo         Your WorkBuddy install may differ; fix NODE_EXE in this bat.
  goto :end
)

tasklist | find /i "WorkBuddy.exe" >nul 2>&1
if not errorlevel 1 (
  taskkill /f /im WorkBuddy.exe >nul 2>&1
  ping -n 3 127.0.0.1 >nul
)

start "" "D:\Soft\WorkBuddy\WorkBuddy.exe" --remote-debugging-port=9222

REM ---- wait for debug port (top-level loop, no goto inside parens) ----
set "READY=0"
set "N=0"
:wait_loop
set /a N+=1
(echo > \.\ip\127.0.0.1\9222) >nul 2>&1
if not errorlevel 1 (
  set "READY=1"
  goto :port_ok
)
if %N% lss 40 (
  ping -n 2 127.0.0.1 >nul
  goto :wait_loop
)
:port_ok
if "%READY%"=="0" (
  echo [WARN] debug port did not open in 40s, skip auto-inject.
  echo        Start WorkBuddy with --remote-debugging-port=9222, then run:
  echo        "%NODE_EXE%" forest-inject.mjs inject
  goto :end
)

cd /d "D:\编程\开发软件皮肤"
echo [%date% %time%] inject start > "%USERPROFILE%\Desktop\forest-inject-log.txt"
"%NODE_EXE%" forest-inject.mjs inject >> "%USERPROFILE%\Desktop\forest-inject-log.txt" 2>&1
:end
