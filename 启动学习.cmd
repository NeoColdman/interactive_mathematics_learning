@echo off
setlocal
chcp 65001 >nul
title 交互学数学
pushd "%~dp0"
if errorlevel 1 goto location_error
set "PROJECT_DIR=%CD%"
set "NODE_BIN="

call :try_node "%PROJECT_DIR%\runtime\node.exe"
if defined NODE_BIN goto ready
call :try_node "%PROJECT_DIR%\runtime\bin\node.exe"
if defined NODE_BIN goto ready
for /f "delims=" %%N in ('where node.exe 2^>nul') do call :try_node "%%N"
if defined NODE_BIN goto ready

echo 首次准备：请先从 https://nodejs.org/ 安装 Node.js 24（或22），再双击本文件。
echo 也可以由熟悉电脑的人把匹配此电脑的 Node 放到项目 runtime\node.exe。
echo 本程序不会自动安装软件或修改系统配置。
pause
popd
exit /b 1

:ready
echo 正在启动交互学数学……
echo 请保留这个窗口。停止学习时可按 Ctrl+C；平板访问期间电脑须保持开机。
start "" /b "%NODE_BIN%" "%PROJECT_DIR%\scripts\open-browser.mjs"
"%NODE_BIN%" "%PROJECT_DIR%\server.mjs"
set "RUN_STATUS=%ERRORLEVEL%"
if not "%RUN_STATUS%"=="0" (
  echo 启动或运行未完成，请查看上方说明。
  pause
)
popd
exit /b %RUN_STATUS%

:try_node
if defined NODE_BIN exit /b 0
if not exist "%~1" exit /b 0
"%~1" -e "const major=Number(process.versions.node.split('.')[0]);process.exit(major===22||major===24?0:1)" >nul 2>nul
if errorlevel 1 exit /b 0
set "NODE_BIN=%~1"
exit /b 0

:location_error
echo 无法打开项目所在文件夹。请先把完整项目解压到本地文件夹后再启动。
pause
exit /b 1
