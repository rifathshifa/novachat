@echo off
REM NovaChat - Start both backend and frontend development servers
REM Usage: start.bat

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

title NovaChat

echo ===== NovaChat =====
echo.

REM Backend
cd /d "%BACKEND_DIR%"
echo [Backend] Starting on http://localhost:5000 ...
start "NovaChat-Backend" cmd /c "cd /d "%BACKEND_DIR%" && call venv\Scripts\activate.bat && python wsgi.py"

REM Frontend
cd /d "%FRONTEND_DIR%"
echo [Frontend] Starting on http://localhost:5173 ...
start "NovaChat-Frontend" cmd /c "cd /d "%FRONTEND_DIR%" && npm run dev"

cd /d "%ROOT_DIR%"
echo.
echo Close the server windows to stop.
echo.
pause
