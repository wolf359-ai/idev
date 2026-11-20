@echo off
rem Double-click to update idev and start it.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 start.py
) else (
  python start.py
)
if errorlevel 9009 echo Python 3 is not installed. Get it from https://www.python.org/downloads/
echo.
pause
