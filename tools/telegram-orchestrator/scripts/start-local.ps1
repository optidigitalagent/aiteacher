Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$toolRoot = Split-Path -Parent $PSScriptRoot
Set-Location $toolRoot

function Set-SecretEnvFromPrompt {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Prompt
  )

  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    [Environment]::SetEnvironmentVariable($Name, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr), "Process")
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Invoke-TelegramMethod {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [hashtable]$Body = @{}
  )

  $uri = "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/$Method"
  try {
    return Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 8)
  } catch {
    throw "Telegram API call '$Method' failed. Check that the token belongs to the new bot and try again."
  }
}

Set-SecretEnvFromPrompt -Name "TELEGRAM_BOT_TOKEN" -Prompt "Paste NEW Telegram bot token from BotFather"

$env:INTERNAL_TELEGRAM_API_KEY = [guid]::NewGuid().ToString("N")
$env:ORCHESTRATOR_BOT_NAME = "Codex Intake Bot"
$env:ORCHESTRATOR_PLATFORM_LINK_ENABLED = "0"
$env:ORCHESTRATOR_DATA_DIR = ".\data-local"
if (-not $env:PORT) {
  $env:PORT = "4010"
}

Write-Host "Checking the new bot token..."
$me = Invoke-TelegramMethod -Method "getMe"
Write-Host "Bot: @$($me.result.username)"

Write-Host "Clearing webhook for polling mode..."
Invoke-TelegramMethod -Method "deleteWebhook" -Body @{ drop_pending_updates = $true } | Out-Null

Write-Host "Now open Telegram, send /start to @$($me.result.username), then return here."
Read-Host "Press Enter after sending /start"

$updates = Invoke-TelegramMethod -Method "getUpdates" -Body @{ timeout = 3 }
$chatIds = @(
  $updates.result |
    Where-Object { $_.message -and $_.message.chat -and $_.message.chat.id } |
    ForEach-Object { [string]$_.message.chat.id } |
    Select-Object -Unique
)

if ($chatIds.Count -eq 0) {
  throw "No chat id found. Send /start to the new bot once more, wait two seconds, and rerun npm run start:local."
}

if ($chatIds.Count -eq 1) {
  $env:ORCHESTRATOR_ALLOWED_CHAT_IDS = $chatIds[0]
  Write-Host "Allowed chat id detected."
} else {
  Write-Host "Detected chat ids:"
  for ($i = 0; $i -lt $chatIds.Count; $i++) {
    Write-Host "[$i] $($chatIds[$i])"
  }
  $index = [int](Read-Host "Select chat id index")
  $env:ORCHESTRATOR_ALLOWED_CHAT_IDS = $chatIds[$index]
}

Write-Host "Starting standalone local bot on port $env:PORT..."
npm start
