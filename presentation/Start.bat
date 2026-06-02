@echo off
title PS Cafe Presentation Server
echo =================================
echo   PS Cafe — Presentation Server
echo =================================
echo.
echo Starting server on http://localhost:3400
echo Close this window to stop the server.
echo.
start http://localhost:3400
python -m http.server 3400 --directory "%~dp0"
pause