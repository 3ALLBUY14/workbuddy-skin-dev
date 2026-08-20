// 生成 CRLF 换行的 WorkBuddy-森系.bat
// 关键修复: 端口等待用顶层 :wait_loop 标签循环(不在括号内 goto), 避免 cmd 括号块解析错乱导致 goto :end 找不到标签而闪退
import fs from 'fs';

const lines = [
  '@echo off',
  'chcp 65001 >nul',
  'setlocal EnableDelayedExpansion',
  '',
  'echo ==================================================',
  'echo  forest-theme: restart WorkBuddy with debug port 9222',
  'echo  + auto-inject forest theme (no manual "inject" needed)',
  'echo ==================================================',
  'echo.',
  'echo  WARNING: this will CLOSE the current WorkBuddy window.',
  'echo  The chat disconnects, then auto-restores when reopened.',
  'echo  To cancel, close this window now.',
  'echo.',
  'echo  Continuing in 3 seconds... (Ctrl+C to cancel)',
  'ping -n 4 127.0.0.1 >nul',
  '',
  'REM ---- node: 直接写死 WorkBuddy 自带 node 绝对路径, 不赌系统 PATH ----',
  'set "NODE_EXE=%USERPROFILE%\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe"',
  'if not exist "%NODE_EXE%" (',
  '  echo [ERROR] bundled node missing: %NODE_EXE%',
  '  echo         Your WorkBuddy install may differ; fix NODE_EXE in this bat.',
  '  goto :end',
  ')',
  '',
  'tasklist | find /i "WorkBuddy.exe" >nul 2>&1',
  'if not errorlevel 1 (',
  '  echo Closing existing WorkBuddy instance...',
  '  taskkill /f /im WorkBuddy.exe >nul 2>&1',
  '  ping -n 3 127.0.0.1 >nul',
  ')',
  '',
  'echo Starting WorkBuddy with --remote-debugging-port=9222 ...',
  'start "" "D:\\Soft\\WorkBuddy\\WorkBuddy.exe" --remote-debugging-port=9222',
  '',
  'REM ---- wait for debug port (top-level loop, no goto inside parens) ----',
  'echo.',
  'echo Waiting for debug port 9222 ...',
  'set "READY=0"',
  'set "N=0"',
  ':wait_loop',
  'set /a N+=1',
  '(echo > \\.\\ip\\127.0.0.1\\9222) >nul 2>&1',
  'if not errorlevel 1 (',
  '  set "READY=1"',
  '  goto :port_ok',
  ')',
  'if %N% lss 40 (',
  '  ping -n 2 127.0.0.1 >nul',
  '  goto :wait_loop',
  ')',
  ':port_ok',
  'if "%READY%"=="0" (',
  '  echo [WARN] debug port did not open in 40s, skip auto-inject.',
  '  echo        Start WorkBuddy with --remote-debugging-port=9222, then run:',
  '  echo        "%NODE_EXE%" forest-inject.mjs inject',
  '  goto :end',
  ')',
  '',
  'echo Debug port is up. Injecting forest theme ...',
  'cd /d "D:\\编程\\开发软件皮肤"',
  'echo [%date% %time%] inject start > "%USERPROFILE%\\Desktop\\forest-inject-log.txt"',
  '"%NODE_EXE%" forest-inject.mjs inject >> "%USERPROFILE%\\Desktop\\forest-inject-log.txt" 2>&1',
  'cls',
  'echo ==================================================',
  'echo   WorkBuddy started + forest theme INJECTED (auto)',
  'echo   Port 9222 debug is live.',
  'echo   (detail in Desktop\\forest-inject-log.txt)',
  'echo ==================================================',
  'echo.',
  'ping -n 4 127.0.0.1 >nul',
  ':end',
  'pause',
];

const crlf = lines.join('\r\n') + '\r\n';
// 用 UTF-8 无 BOM 写 (配合 bat 首行后的 chcp 65001, cmd 按 UTF-8 解析中文路径, 不乱码)
fs.writeFileSync('WorkBuddy-森系.bat', crlf, 'utf8');

const b = fs.readFileSync('WorkBuddy-森系.bat');
const txt = b.toString('utf8');
console.log('written bytes:', b.length);
console.log('CRLF lines:', (txt.match(/\r\n/g) || []).length, '| bare-LF lines:', (txt.match(/[^\r]\n/g) || []).length);
console.log('BOM:', b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF);
console.log('first line:', JSON.stringify(txt.split('\r\n')[0]));
