@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-KnowledgeBase.ps1"
if errorlevel 1 (
  echo.
  echo Knowledge Vault Harness validation failed. Review the error above.
  pause
  exit /b 1
)
echo.
echo Knowledge Vault Harness validation passed.
pause
