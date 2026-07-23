// gen-share.mjs — 为皮肤文件夹生成「分享入口」(双击即用, 跨平台)
// 在皮肤文件夹内运行: node gen-share.mjs
// 依据当前操作系统生成对应入口:
//   win32  -> 启动.bat (找 node) + 启动.vbs (静默隐藏运行 bat)
//   darwin -> launch.command (chmod +x, 双击运行)
//   linux  -> launch.sh     (chmod +x, 双击运行)
// .mjs 注入脚本本身是跨平台的, 其他系统用户可直接 `node launch.mjs`。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM = process.platform;

function genWindows() {
  const bat = [
    '@echo off',
    'chcp 65001 >nul',
    'setlocal EnableDelayedExpansion',
    '',
    'set "NODE="',
    'for /d %%d in ("%USERPROFILE%\\.workbuddy\\binaries\\node\\versions\\*") do (',
    '  if exist "%%d\\node.exe" set "NODE=%%d\\node.exe"',
    ')',
    'if "!NODE!"=="" (',
    '  for /f "delims=" %%n in (\'where node 2^>nul\') do ( if "!NODE!"=="" set "NODE=%%n" )',
    ')',
    'if "!NODE!"=="" ( echo [ERROR] Node.js not found. & pause & goto :eof )',
    'cd /d "%~dp0"',
    'start "" "!NODE!" "launch.mjs"',
    'goto :eof',
  ].join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(__dirname, '启动.bat'), bat, 'utf8'); // UTF-8 无 BOM

  const vbs = [
    'Set objShell = CreateObject("WScript.Shell")',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'batPath = fso.GetParentFolderName(WScript.ScriptFullName) & "\\启动.bat"',
    'objShell.Run """" & batPath & """", 0, False',
  ].join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(__dirname, '启动.vbs'), vbs, 'utf8');
  console.log('已生成: 启动.bat + 启动.vbs (双击 .vbs 静默启动)');
}

function genUnix(file) {
  const sh = [
    '#!/bin/bash',
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'cd "$DIR"',
    'exec node "$DIR/launch.mjs"',
    '',
  ].join('\n') + '\n';
  const p = path.join(__dirname, file);
  fs.writeFileSync(p, sh, 'utf8');
  try { fs.chmodSync(p, 0o755); } catch {}
  console.log('已生成:' + file + ' (chmod +x, 双击运行; 或在文件夹内 `node launch.mjs`)');
}

if (PLATFORM === 'win32') genWindows();
else if (PLATFORM === 'darwin') genUnix('launch.command');
else genUnix('launch.sh');
