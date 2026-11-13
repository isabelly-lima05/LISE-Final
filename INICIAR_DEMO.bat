@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe py -3.12 -m venv .venv
if not exist .venv\Scripts\python.exe (
 echo Instale Python 3.12 e execute novamente.
 pause
 exit /b 1
)
.venv\Scripts\python.exe -m pip install -r backend_service\requirements.txt
if errorlevel 1 (
 pause
 exit /b 1
)
.venv\Scripts\python.exe run_demo.py
pause
