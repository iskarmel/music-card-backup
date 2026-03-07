@echo off
cd /d "%~dp0"

echo Start Music Card Server on Port 3005...
start cmd /k "npm start"

echo Waiting for server to start...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:3005

exit
