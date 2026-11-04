# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File start-frontend.ps1 [-Port 5173]
#
# - Kills anything already listening on the port
# - CLEARS the logs from the previous run
# - Validates the required VITE_* variables in .env (names only - values live in .env, never here)
# - Starts vite exposed on the LAN (--host) and waits until the port answers
# - Prints the localhost AND local-network URLs to open the app
#
# Logs: logs\frontend.out.log / logs\frontend.err.log (relative to this folder)
param([int]$Port = 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root "logs"
$outLog = Join-Path $logDir "frontend.out.log"
$errLog = Join-Path $logDir "frontend.err.log"

# --- 1. Stop anything already on the port -------------------------------
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {}
}

# --- 2. Clear previous logs ---------------------------------------------
New-Item -ItemType Directory -Force $logDir | Out-Null
Remove-Item "$logDir\frontend*.log" -Force -ErrorAction SilentlyContinue

# --- 3. Resolve node/npm: PATH first, then $env:NODE_HOME, then a documented fallback ---
if ($env:NODE_HOME) { $env:PATH = "$env:NODE_HOME;$env:PATH" }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    # Portable fallback used on this machine. Override with $env:NODE_HOME, never edit here.
    $fallback = "C:\Users\g2.abhishek\AppData\Local\Temp\claude\d--Learn-BAckend\bef94a98-be8f-4451-a9fb-1fd99ee5cc72\scratchpad\nodejs\node-v22.23.4-win-x64"
    if (Test-Path (Join-Path $fallback "npm.cmd")) {
        $env:PATH = "$fallback;$env:PATH"
        Write-Host "[start] node not on PATH - using portable install at $fallback" -ForegroundColor DarkGray
    } else {
        Write-Host "[start] ERROR: node/npm not found. Install Node.js or set NODE_HOME." -ForegroundColor Red
        exit 1
    }
}
$env:NODE_OPTIONS = "--use-system-ca"

# --- 4. Validate required env variables (names only; values are read by vite from .env) ---
$required = @(
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_APP_ID"
)
$envFile = Join-Path $root ".env"
$missing = @()
$present = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.+)$') { $present[$Matches[1]] = $Matches[2].Trim() }
    }
} else {
    Write-Host "[start] WARNING: no .env file found (template: .env.example)" -ForegroundColor Yellow
}
foreach ($name in $required) {
    if (-not $present[$name]) { $missing += $name }
}
if ($missing.Count -gt 0) {
    Write-Host "[start] Media upload + Google sign-in will be DISABLED. Missing in .env:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "         $_=<not set>" -ForegroundColor Yellow }
} else {
    Write-Host "[start] .env looks complete (Firebase configured)." -ForegroundColor DarkGray
}

# --- 5. Start vite (hidden), --host so the LAN IP works too --------------
Start-Process -FilePath "npm.cmd" -WorkingDirectory $root -WindowStyle Hidden `
    -ArgumentList @("run", "dev", "--", "--port", "$Port", "--strictPort", "--host") `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog

# --- 6. Wait for the port, then print the URLs ---------------------------
$up = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $up = $true; break }
    Start-Sleep -Seconds 1
}

if ($up) {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host " Frontend is running" -ForegroundColor Green
    Write-Host "   localhost : http://localhost:$Port"
    # Every real IPv4 address (skip loopback + APIPA) that other devices can reach.
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { Write-Host ("   network   : http://{0}:{1}" -f $_.IPAddress, $Port) -ForegroundColor Cyan }
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host " logs: $outLog"
} else {
    Write-Host "[start] Frontend did NOT come up within 60s. Last log lines:" -ForegroundColor Red
    Get-Content $outLog -Tail 40 -ErrorAction SilentlyContinue
    Get-Content $errLog -Tail 20 -ErrorAction SilentlyContinue
    exit 1
}
