@echo off
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py
if not defined PY where python >nul 2>nul && set PY=python
if not defined PY (
  echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ marcando "Add Python to PATH".
  pause
  exit /b 1
)
echo.
echo  Servidor local: http://localhost:8000
echo  Deja esta ventana ABIERTA mientras usas la app. Ctrl+C para detenerlo.
echo.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"
%PY% servidor.py
echo.
echo El servidor se detuvo. Si ves un error arriba, copialo.
pause
