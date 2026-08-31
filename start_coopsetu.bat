@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo       Starting CoopSetu Local Environment
echo ==============================================
echo.

:: 1. Check if Docker is running
echo [1/5] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% equ 0 goto dockerReady

echo Docker is not running. Attempting to start Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo Waiting for Docker to initialize (this may take a minute)...
:WaitForDocker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Still waiting for Docker...
    goto WaitForDocker
)
echo Docker is now running.
echo.

:dockerReady
echo Docker is already running.
echo.

:: 2. Check and kill process on port 3000
echo [2/5] Checking for processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    if "%%a" neq "0" (
        echo Found process %%a using port 3000. Killing it...
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo.

:: 3. Start Supabase (Backend)
echo [3/5] Starting Supabase backend...
call npx supabase start
if %errorlevel% neq 0 (
    echo Warning: Supabase might have failed to start or is already running.
)
echo.

:: 4. Start Next.js Frontend
echo [4/5] Starting Next.js frontend...
start "CoopSetu Frontend" cmd /k "npm run dev"
echo Frontend is starting in a new window.
echo.

:: 5. Wait a moment and open browser
echo [5/5] Waiting for frontend to initialize...
timeout /t 8 /nobreak >nul
echo Opening browser...
start http://localhost:3000

echo.
echo ==============================================
echo       CoopSetu is up and running!
echo ==============================================
pause
