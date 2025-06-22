@echo off
echo ========================================
echo Remote MySQL SSH Tunnel Setup
echo ========================================
echo.

echo This script will help you configure SSH tunneling to connect to a remote MySQL server.
echo.

set /p SSH_HOST="Enter remote Ubuntu server IP address: "
set /p SSH_USER="Enter SSH username: "
set /p SSH_PASS="Enter SSH password: "
set /p MYSQL_USER="Enter MySQL username: "
set /p MYSQL_PASS="Enter MySQL password: "
set /p MYSQL_DB="Enter MySQL database name: "
set /p LOCAL_PORT="Enter local tunnel port (default 3307): "

if "%LOCAL_PORT%"=="" set LOCAL_PORT=3307

echo.
echo Creating configuration file...

(
echo {
echo     "database": {
echo         "technology": "mysql",
echo         "server": "localhost",
echo         "port": %LOCAL_PORT%,
echo         "ssl": false,
echo         "schema": "%MYSQL_DB%",
echo         "username": "%MYSQL_USER%",
echo         "password": "%MYSQL_PASS%",
echo         "loadmethod": "insert",
echo         "ssh_tunnel": {
echo             "enabled": true,
echo             "host": "%SSH_HOST%",
echo             "port": 22,
echo             "username": "%SSH_USER%",
echo             "password": "%SSH_PASS%",
echo             "localPort": %LOCAL_PORT%,
echo             "remoteHost": "localhost",
echo             "remotePort": 3306
echo         }
echo     },
echo     "tally": {
echo         "definition": "tally-export-config.yaml",
echo         "server": "localhost",
echo         "port": 9000,
echo         "fromdate": "2024-04-01",
echo         "todate": "2025-03-31",
echo         "sync": "full",
echo         "frequency": 0,
echo         "company": ""
echo     }
echo }
) > config-remote-mysql.json

echo Configuration saved to config-remote-mysql.json
echo.

echo Testing SSH tunnel connection...
echo.

node test-ssh-tunnel.mjs

echo.
echo Setup complete! 
echo To use this configuration, copy config-remote-mysql.json to config.json
echo or run the application with: node src/index.mjs
echo.
pause 