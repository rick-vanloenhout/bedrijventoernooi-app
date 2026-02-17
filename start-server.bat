@echo off
echo ========================================
echo   Tournament Server Starting...
echo ========================================
echo.
echo Finding your IP address...
echo.
ipconfig | findstr /i "IPv4"
echo.
echo ========================================
echo   Server will start on port 8000
echo ========================================
echo.
echo Share this URL with players:
echo   http://YOUR_IP_ADDRESS:8000/frontend/index.html
echo.
echo (Replace YOUR_IP_ADDRESS with the IP shown above)
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

pause
