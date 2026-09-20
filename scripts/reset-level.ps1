# Puts the repository back to the start state of a level.
param([string]$Level)
Set-Location (Join-Path $PSScriptRoot "..")
if ($Level) { node scripts/training.mjs reset --level $Level } else { node scripts/training.mjs reset }
