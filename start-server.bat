@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   黑洞吞吞 網頁版 - 本機伺服器
echo ============================================
echo 電腦瀏覽器開： http://localhost:8765
echo 手機（同一個 Wi-Fi）開下面任一個網址：
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { '    http://' + $_.IPAddress + ':8765' }"
echo.
echo 關掉這個視窗就會停止伺服器。
echo ============================================
python -m http.server 8765 --bind 0.0.0.0
