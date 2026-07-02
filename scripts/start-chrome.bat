@echo off
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set USER_DATA_DIR=C:\AIObservatory\ChromeProfile

if not exist "C:\AIObservatory" mkdir "C:\AIObservatory"
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

%CHROME% --remote-debugging-port=9222 --user-data-dir="%USER_DATA_DIR%"
