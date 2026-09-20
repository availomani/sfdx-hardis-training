# Removes the Helios app and its data from one training org.
param([string]$Org)
Set-Location (Join-Path $PSScriptRoot "..")
if ($Org) { node scripts/training.mjs teardown --org $Org } else { node scripts/training.mjs teardown }
