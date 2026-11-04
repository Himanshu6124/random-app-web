# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File stop-frontend.ps1 [-Port 5173]
#
# Stops the frontend dev server (kills whatever is listening on the port).
param([int]$Port = 5173)

$killed = $false
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop
        $killed = $true
    } catch {}
}

if ($killed) {
    Write-Host "Frontend stopped (port $Port freed)."
} else {
    Write-Host "Nothing was listening on port $Port."
}
