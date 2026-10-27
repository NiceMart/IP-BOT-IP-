@echo off
echo ========================================
echo 数字人合成卡死诊断工具
echo ========================================
echo.

echo [1] 检查GPU显存占用...
nvidia-smi --query-gpu=index,memory.used,memory.total --format=csv,noheader
echo.

echo [2] 检查Chromium/Chrome进程数量...
tasklist | findstr /I "chromium chrome" | find /C "exe"
echo 个Chromium相关进程
echo.

echo [3] 检查Python进程数量...
tasklist | findstr /I "python" | find /C "exe"
echo 个Python进程
echo.

echo [4] 检查占用GPU的进程...
nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader
echo.

echo [5] 检查内存占用Top 5进程...
powershell "Get-Process | Sort-Object WS -Descending | Select-Object -First 5 | Format-Table Name, @{Label='Memory(MB)';Expression={[int]($_.WS / 1MB)}} -AutoSize"
echo.

echo ========================================
echo 诊断完成！
echo.
echo 如果发现问题：
echo - GPU显存^>90%% → 运行 cleanup_gpu.py --force
echo - Chromium进程^>5个 → 运行 taskkill /F /IM chromium.exe
echo - Python进程^>3个 → 检查是否有残留进程
echo ========================================
pause
