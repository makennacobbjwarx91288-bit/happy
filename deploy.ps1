# One-click pack and upload to server. Run from project root.
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1 -ServerIP 47.251.245.241 -User root
param(
    [Parameter(Mandatory=$true)][string]$ServerIP,
    [string]$User = "root",
    [string]$RemotePath = "/root"
)
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }
$staging = Join-Path $env:TEMP "beard-deploy-$(Get-Random)"
New-Item -ItemType Directory -Path $staging -Force | Out-Null
function Copy-Project($src, $dst) {
    $children = Get-ChildItem -Path $src -Force
    foreach ($c in $children) {
        $name = $c.Name
        if ($c.PSIsContainer) {
            if ($name -in "node_modules", ".git", "dist") { continue }
            $destPath = Join-Path $dst $name
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
            Copy-Project $c.FullName $destPath
        } else {
            if ($name -eq ".env" -or $name -like "*.sqlite" -or $name -like "*.log") { continue }
            $destPath = Join-Path $dst $name
            Copy-Item $c.FullName $destPath -Force
        }
    }
}
Write-Host "Packing project (excluding node_modules, .git, etc.)..."
Copy-Project $projectRoot $staging
# Ensure .env.example is present for install.sh to use as reference
if (Test-Path (Join-Path $projectRoot ".env.example")) {
    Copy-Item (Join-Path $projectRoot ".env.example") (Join-Path $staging ".env.example") -Force
}
Write-Host "Uploading to ${User}@${ServerIP}:${RemotePath} ..."
& scp -r -o StrictHostKeyChecking=no "$staging\*" "${User}@${ServerIP}:${RemotePath}/"
Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
Write-Host "Done. On server run: cd $RemotePath && bash install.sh"
