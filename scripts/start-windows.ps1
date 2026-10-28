param([ValidateSet('desktop', 'server', 'install')][string]$Mode = 'desktop')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$launcherLog = Join-Path $logDirectory ('launcher-' + $Mode + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.log')
function Write-LauncherLog([string]$Message) {
    Write-Host $Message
    Add-Content -LiteralPath $launcherLog -Value $Message -Encoding UTF8
}
try {
    $candidates = @()
    if ($env:IPBOT_NODE) { $candidates += $env:IPBOT_NODE }
    $candidates += @(Get-Command node.exe -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
    foreach ($directory in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($directory) {
            $candidates += Join-Path $directory 'nodejs\node.exe'
            $candidates += Join-Path $directory 'Programs\nodejs\node.exe'
        }
    }
    foreach ($key in @('HKCU:\Software\Node.js', 'HKLM:\Software\Node.js')) {
        $installation = (Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue).InstallPath
        if ($installation) { $candidates += Join-Path $installation 'node.exe' }
    }
    if ($env:NVM_SYMLINK) { $candidates += Join-Path $env:NVM_SYMLINK 'node.exe' }
    $candidates += Join-Path $projectRoot 'runtime\node\node.exe'
    # Reuse an already installed Node 22 supplied by WorkBuddy when Explorer's PATH lacks it.
    if ($env:USERPROFILE) {
        $managed = Join-Path $env:USERPROFILE '.workbuddy\binaries\node\versions'
        if (Test-Path -LiteralPath $managed) {
            $candidates += @(Get-ChildItem -LiteralPath $managed -Directory -Filter '22*' | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'node.exe' })
        }
    }
    $nodeBinary = $null
    foreach ($candidate in @($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        if (!(Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        $version = & $candidate --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $version -match '^v22\.') { $nodeBinary = $candidate; break }
    }
    if (!$nodeBinary) {
        throw 'Node.js 22.x was not found. Install Node.js 22 from https://nodejs.org/en/download, then reopen the launcher. Existing installations can set IPBOT_NODE to node.exe.'
    }
    Write-LauncherLog ('Using Node.js: ' + $nodeBinary)
    Write-LauncherLog ('Project: ' + $projectRoot)
    $env:Path = (Split-Path -Parent $nodeBinary) + ';' + $env:Path
    Set-Location -LiteralPath $projectRoot
    & $nodeBinary (Join-Path $PSScriptRoot 'launch.cjs') $Mode
    $resultCode = $LASTEXITCODE
    if ($resultCode -ne 0) { Write-LauncherLog ('Startup failed. Exit code: ' + $resultCode + '. See logs/startup-*.log for details.') }
    exit $resultCode
} catch {
    Write-LauncherLog ('ERROR: ' + $_.Exception.Message)
    Write-LauncherLog ('Diagnostic log: ' + $launcherLog)
    exit 1
}
