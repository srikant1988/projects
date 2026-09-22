# Run from a fresh PowerShell terminal: .\run-backend.ps1
# Starts Postgres (if needed) and the FastAPI backend with auto-reload.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root\backend"

$pg = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pg -and $pg.Status -ne "Running") {
    Write-Host "Starting Postgres service..."
    Start-Service postgresql-x64-16
    Start-Sleep -Seconds 2
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "No venv found at backend\.venv -- create one first:"
    Write-Host "  python -m venv .venv"
    Write-Host "  .venv\Scripts\Activate.ps1"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

& ".venv\Scripts\python.exe" -m uvicorn app.main:app --reload
