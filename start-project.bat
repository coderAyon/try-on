@echo off
setlocal
cd /d "%~dp0"
title Sunglass Try-On - Development Server

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo Node.js and npm were not found. Install Node.js, then run this file again.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\concurrently.cmd" (
    echo Installing project dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo Dependency installation failed.
        pause
        exit /b 1
    )
)

echo Starting the API and website...
echo Your browser will open automatically when the website is ready.
echo Keep this window open. Press Ctrl+C to stop the project.
echo.
set "SUNGLASS_OPEN_BROWSER=1"
call npm.cmd run dev
set "projectExitCode=%errorlevel%"
if not "%projectExitCode%"=="0" (
    echo.
    echo Project stopped with an error. Check the messages above.
    pause
)
exit /b %projectExitCode%
