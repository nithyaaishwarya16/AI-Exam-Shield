@echo off
echo Fixing MongoDB lock issue...
echo.

REM Stop only MongoDB on port 27018 (keeps your other project on 27017 running)
echo Stopping MongoDB on port 27018...
powershell -Command "$c=Get-NetTCPConnection -LocalPort 27018 -State Listen -ErrorAction SilentlyContinue; if($c){Stop-Process -Id $c.OwningProcess -Force; Write-Host 'Stopped'} else {Write-Host 'None running'}"
timeout /t 2 /nobreak >nul

REM Remove stale lock file
echo Removing lock file...
if exist "C:\data\db_anticheating\mongod.lock" (
    del "C:\data\db_anticheating\mongod.lock"
    echo Lock file removed.
) else (
    echo No lock file found.
)

echo.
echo Done! Now run start-mongodb-27018.bat again.
pause
