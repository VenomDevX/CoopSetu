@echo off
echo ==========================================
echo Starting CoopSetu Development Environment
echo ==========================================

echo [1/4] Checking if Docker is running...
docker info >nul 2>&1
if %ERRORLEVEL% equ 0 goto dockerReady

echo Docker is not running. Attempting to start Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo Waiting for Docker to start (this may take a minute)...
:waitForDocker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 goto waitForDocker
echo Docker has started successfully!

:dockerReady
echo Docker is already running or just started.

echo [2/4] Checking for lingering processes on port 3000 (Frontend)...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :3000') DO (
    if "%%T" neq "0" (
        echo Killing process %%T on port 3000...
        taskkill /F /PID %%T >nul 2>&1
    )
)

echo [3/4] Starting Supabase Backend...
call supabase start

echo [4/4] Starting Next.js Frontend...
start cmd /k "npm run dev"

echo Waiting for Next.js to compile (approx 5-10 seconds)...
timeout /t 8 /nobreak >nul

echo Opening browser to http://localhost:3000...
start http://localhost:3000

echo Done! The frontend server is running in the new terminal window.
pause
