@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 goto bad_directory
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1" -Mode desktop
set "IPBOT_EXIT=%ERRORLEVEL%"
echo.
if not "%IPBOT_EXIT%"=="0" echo Startup failed. Read the error above and the logs folder.
if "%IPBOT_EXIT%"=="0" echo The application has stopped.
if not "%IPBOT_NO_PAUSE%"=="1" pause
exit /b %IPBOT_EXIT%
:bad_directory
echo Cannot access the project directory. Extract the ZIP to a writable folder first.
if not "%IPBOT_NO_PAUSE%"=="1" pause
exit /b 1
