# Seeds one training org. The Training menu in VS Code runs the same thing:
#   Welcome page > Training > Set up one of my training orgs
param([string]$Org)
Set-Location (Join-Path $PSScriptRoot "..")
if ($Org) { node scripts/training.mjs seed --org $Org } else { node scripts/training.mjs seed }
