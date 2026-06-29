@echo off
echo Starting MongoDB on port 27018...
mkdir C:\data\db_anticheating 2>nul

REM Try common MongoDB installation paths
if exist "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" (
    "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --port 27018 --dbpath "C:\data\db_anticheating"
) else if exist "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" (
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --port 27018 --dbpath "C:\data\db_anticheating"
) else if exist "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" (
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --port 27018 --dbpath "C:\data\db_anticheating"
) else if exist "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" (
    "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" --port 27018 --dbpath "C:\data\db_anticheating"
) else (
    echo MongoDB not found! Please update the path in this script.
    echo Common locations: C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe
    pause
)
