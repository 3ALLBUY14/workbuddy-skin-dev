@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ==================================================
echo  forest-theme: restart WorkBuddy with debug port 9222
echo  + auto-inject forest theme (no manual "inject" needed)
echo ==================================================
echo.
echo  WARNING: this will CLOSE the current WorkBuddy window.
echo  The chat disconnects, then auto-restores when reopened.
echo  To cancel, close this window now.
echo.
echo  Continuing in 3 seconds... (Ctrl+C to cancel)
timeout /t 3 >nul

tasklist | find /i "WorkBuddy.exe" >nul 2>&1
if %errorlevel%==0 (
  echo Closing existing WorkBuddy instance...
  taskkill /f /im WorkBuddy.exe >nul 2>&1
  timeout /t 2 >nul
)

echo Starting WorkBuddy with --remote-debugging-port=9222 ...
start "" "D:\Soft\WorkBuddy\WorkBuddy.exe" --remote-debugging-port=9222

REM ---- 等待调试端口就绪, 然后自动注入皮肤 ----
echo.
echo Waiting for debug port 9222 ...
set "READY=0"
for /l %%i in (1,1,40) do (
  (echo > \\.\ip\127.0.0.1\9222) >nul 2>&1 && (
    set "READY=1"
    goto :port_ok
  )
  timeout /t 1 >nul
)
:port_ok
if "%READY%"=="0" (
  echo [WARN] debug port did not open in 40s, skip auto-inject.
  echo        Start WorkBuddy yourself with --remote-debugging-port=9222, then run:
  echo        node forest-inject.mjs inject
  goto :end
)

echo Debug port is up. Injecting forest theme ...
node "%~dp0forest-inject.mjs" inject
if %errorlevel%==0 (
  cls
  echo ==================================================
  echo   WorkBuddy started + forest theme INJECTED (auto)
  echo   Port 9222 debug is live.
  echo ==================================================
  echo.
  timeout /t 3 >nul
) else (
  echo.
  echo [WARN] auto-inject failed (see errors above).
  echo Run manually: node forest-inject.mjs inject
)
:end
pause
