# Run from a fresh PowerShell terminal: .\run-frontend.ps1
# Starts the Vite dev server.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "No node_modules found -- installing dependencies..."
    npm install
}

npm run dev
