# Creates an isolated Python environment and installs committed dependency locks.
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$apiDir = Join-Path $projectRoot "apps/api"
$webDir = Join-Path $projectRoot "apps/web"
$python = Join-Path $apiDir ".venv/Scripts/python.exe"
$uv = Join-Path $apiDir ".venv/Scripts/uv.exe"
if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm -ErrorAction SilentlyContinue)) { throw "Install Node.js 22 or newer first." }
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw "Node.js 22 or newer is required." }
Set-Location $apiDir
if (!(Test-Path $python)) {
    if (!(Get-Command py -ErrorAction SilentlyContinue)) { throw "Install Python 3.12 with the Windows Python launcher first." }
    py -3.12 -m venv .venv
    if ($LASTEXITCODE) { throw "Could not create the Python 3.12 virtual environment." }
}
if (!(Test-Path $uv)) {
    & $python -m ensurepip --upgrade
    if ($LASTEXITCODE) { throw "Unable to prepare pip in the virtual environment." }
    & $python -m pip install uv
    if ($LASTEXITCODE) { throw "Unable to install uv inside the virtual environment." }
}
if (!(Test-Path ".env")) { Copy-Item (Join-Path $projectRoot ".env.example") ".env" }
Write-Host "Installing locked backend dependencies..."
& $uv sync --frozen
if ($LASTEXITCODE) { throw "Backend dependency installation failed." }
& $python -m alembic upgrade head
if ($LASTEXITCODE) { throw "Database migration failed." }
Set-Location $webDir
Write-Host "Installing locked frontend dependencies..."
npm ci
if ($LASTEXITCODE) { throw "Frontend dependency installation failed." }
$backend = Start-Process -FilePath $python -ArgumentList "-m", "uvicorn", "crimestack.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $apiDir -PassThru
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($backend.HasExited) { throw "Backend stopped. Check its console; port 8000 may already be in use." }
        try { $status = Invoke-RestMethod "http://127.0.0.1:8000/ready" -TimeoutSec 2; $ready = ($status.status -eq "ready") } catch { }
        if ($ready) { break }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw "Backend readiness failed. Check its console output." }
    Write-Host "Backend is ready. Open http://127.0.0.1:5173 after Vite starts."
    Write-Host "Keep this window open. Press Ctrl+C to stop."
    npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
    if ($LASTEXITCODE) { throw "Frontend failed to start; check whether port 5173 is occupied." }
} finally {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
}
