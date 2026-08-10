@echo off
setlocal
title Rajaei Printer Bridge

set "APPDIR=%LOCALAPPDATA%\RajaeiPrinterBridge"
set "BRIDGE=%APPDIR%\bridge.mjs"
set "BRIDGE_URL=https://almasri.store/print-bridge/bridge.mjs"

if not exist "%APPDIR%" mkdir "%APPDIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required one time only to run the wireless printer bridge.
  echo A download page will open now. Install Node.js LTS, then run this file again.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

echo Downloading latest Rajaei printer bridge...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%BRIDGE_URL%' -OutFile '%BRIDGE%'"
if errorlevel 1 (
  echo.
  echo Could not download the printer bridge. Check internet connection and try again.
  pause
  exit /b 1
)

echo.
echo ==================================================
echo Rajaei Printer Bridge is starting...
echo If printing from the same computer use: http://127.0.0.1:9723
echo If printing from a phone, use the network URL shown below, usually http://192.168.x.x:9723
echo Keep this black window open while printing.
echo ==================================================
echo.

node "%BRIDGE%" 9723
pause
