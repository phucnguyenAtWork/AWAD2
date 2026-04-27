# Swap .env across both workspaces between Windows-local and Mac-remote profiles.
#
# Usage:
#   pwsh scripts/switch-profile.ps1 windows
#   pwsh scripts/switch-profile.ps1 mac
#
# Current .env is backed up to .env.windows.bak before the Mac profile overwrites it,
# so switching back to 'windows' restores the exact Windows-local values.

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("windows", "mac")]
  [string]$Mode
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Awad2Dir  = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$FinaDir   = (Resolve-Path (Join-Path $Awad2Dir "..\Financial-AI-Model")).Path

function Swap-Profile {
  param([string]$Dir)

  $profile = Join-Path $Dir ".env.llm-local-agent-feature"
  $active  = Join-Path $Dir ".env"
  $backup  = Join-Path $Dir ".env.windows.bak"

  if (-not (Test-Path $profile)) {
    Write-Host "[skip] $profile not found"
    return
  }

  if ($Mode -eq "mac") {
    if (Test-Path $active) {
      Copy-Item $active $backup -Force
    }
    Copy-Item $profile $active -Force
    Write-Host "[ok] $Dir  ->  mac profile active"
  }
  else {
    if (Test-Path $backup) {
      Copy-Item $backup $active -Force
      Write-Host "[ok] $Dir  ->  windows profile restored from .env.windows.bak"
    }
    else {
      Write-Host "[warn] $Dir has no .env.windows.bak — leaving .env untouched"
    }
  }
}

Swap-Profile -Dir $Awad2Dir
Swap-Profile -Dir $FinaDir

Write-Host ""
Write-Host "Switched to '$Mode' profile."
Write-Host "  AWAD2  : $Awad2Dir\.env"
Write-Host "  FINA   : $FinaDir\.env"
