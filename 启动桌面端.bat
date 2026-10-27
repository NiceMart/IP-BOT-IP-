@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto bad_directory
where node.exe >nul 2>&1
if errorlevel 1 goto missing_node
node "%~dp0scripts\launch.cjs" desktop
set "IPBOT_EXIT=%ERRORLEVEL%"
echo.
echo The launcher has stopped. Diagnostic logs are in the logs folder.
if not "%IPBOT_NO_PAUSE%"=="1" pause
exit /b %IPBOT_EXIT%
:missing_node
echo Node.js was not found on PATH.
echo Install Node.js 22 LTS from https://nodejs.org/ and reopen this file.
if not "%IPBOT_NO_PAUSE%"=="1" pause
exit /b 1
:bad_directory
echo Cannot access the project directory. Extract the ZIP to a writable folder first.
if not "%IPBOT_NO_PAUSE%"=="1" pause
exit /b 1
