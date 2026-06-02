@echo off
title PS Cafe Presentation Stopper
echo =================================
echo   Stopping Presentation Server
echo =================================
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3400 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Server on port 3400 has been stopped.
echo.
pause