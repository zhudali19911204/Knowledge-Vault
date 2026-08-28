@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-KnowledgeBase.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Review the error above.
  pause
  exit /b 1
)
echo.
echo Installation completed successfully.
echo Next: run Initialize-KnowledgeBase.cmd and choose your Vault folder.
pause
