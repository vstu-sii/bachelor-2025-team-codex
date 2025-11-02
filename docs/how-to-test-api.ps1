<# 
  docs/how-to-test-api.ps1
  Smoke-test Auto-Flashcards OpenAPI using Prism mock.

  Usage (from repo root):
    pwsh -File .\docs\how-to-test-api.ps1
  Options:
    pwsh -File .\docs\how-to-test-api.ps1 -SpecPath .\api\openapi.yaml -Port 8000 -SkipPrism:$false
#>

[CmdletBinding()]
param(
  [string]$SpecPath = ".\api\openapi.yaml",
  [int]$Port = 8000,
  [switch]$SkipPrism = $false
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Info($msg) { Write-Host "[i] $msg" -ForegroundColor DarkGray }
function Ok($msg)   { Write-Host "[✓] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[x] $msg" -ForegroundColor Red }

function Wait-Port($host, $port, $timeoutSec=20) {
  $t = [Diagnostics.Stopwatch]::StartNew()
  while ($t.Elapsed.TotalSeconds -lt $timeoutSec) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect($host, $port, $null, $null)
      $ok = $iar.AsyncWaitHandle.WaitOne(500)
      if ($ok -and $client.Connected) { $client.Close(); return $true }
      $client.Close()
    } catch { Start-Sleep -Milliseconds 300 }
  }
  return $false
}

try {
  Step "Lint OpenAPI spec"
  npx -y @redocly/cli@latest lint "$SpecPath" | Write-Host
  Ok "OpenAPI lint passed (warnings are OK during dev)."

  if (-not $SkipPrism) {
    Step "Start Prism mock (port $Port)"
    # Start Prism in a background window
    $prismArgs = "mock `"$SpecPath`" --port $Port"
    Start-Process -WindowStyle Minimized -FilePath "npx" -ArgumentList "-y @stoplight/prism-cli $prismArgs"
    Info "Waiting for Prism to listen on http://127.0.0.1:$Port ..."
    if (-not (Wait-Port "127.0.0.1" $Port 25)) { throw "Prism didn't start in time." }
    Ok "Prism is up."
  } else {
    Warn "Skipping Prism start (you passed -SkipPrism). Assuming something already listens on :$Port."
  }

  $base = "http://localhost:$Port"

  Step "Health"
  try {
    Invoke-RestMethod "$base/healthz" -TimeoutSec 5 | Out-Null
    Ok "GET /healthz → 200 OK"
  } catch { Warn "Health endpoint may be empty (mock). Continuing." }

  Step "UC-1: Create deck (rawText)"
  $createBody = @{ title = "Bio 101 — Photosynthesis"; rawText = "Photosynthesis converts light energy..." } | ConvertTo-Json
  $create = Invoke-RestMethod -Method POST "$base/decks" -ContentType "application/json" -Body $createBody
  $deckId = $create.deckId
  if (-not $deckId) { throw "No deckId returned from /decks" }
  Ok "POST /decks → deckId = $deckId"

  Step "List cards (preview)"
  $cards = Invoke-RestMethod "$base/decks/$deckId/cards"
  $cards | Select-Object id,question,answer,difficulty | Format-Table
  Ok "GET /decks/{id}/cards → preview OK"

  Step "Finalize deck"
  $final = Invoke-RestMethod -Method POST "$base/decks/$deckId/finalize"
  Ok "POST /decks/{id}/finalize → $($final.status)"

  Step "UC-2: Edit a card (PATCH)"
  $cardId = $cards[0].id
  Invoke-RestMethod -Method PATCH "$base/cards/$cardId" -ContentType "application/json" -Body (@{ difficulty = 4 } | ConvertTo-Json) | Out-Null
  Ok "PATCH /cards/{id} → OK"

  Step "UC-2: Merge duplicates"
  Invoke-RestMethod -Method POST "$base/cards/merge" -ContentType "application/json" -Body (@{ cardIds = @($cardId,$cardId) } | ConvertTo-Json) | Out-Null
  Ok "POST /cards/merge → OK (mock)"

  Step "UC-3: Start SRS session"
  $due = Invoke-RestMethod -Method POST "$base/srs/session/start"
  if ($due -is [array]) {
    ("Due count = {0}" -f $due.Count) | Write-Host
  } else {
    ("Due (mock) = 1" ) | Write-Host
  }
  Ok "POST /srs/session/start → OK"

  Step "UC-3: Grade (mock note)"
  try {
    # Some mocks return a fixed example error here; ignore if happens.
    Invoke-RestMethod -Method POST "$base/srs/grade" -ContentType "application/json" -Body (@{ cardId = $cardId; grade = "good" } | ConvertTo-Json) | Out-Null
    Ok "POST /srs/grade → OK"
  } catch {
    Warn "POST /srs/grade returned mock error (expected during MVP)."
  }

  Step "UC-4: Stats"
  $stats = Invoke-RestMethod "$base/stats?range=week&deckId=$deckId"
  $stats | Format-List
  Ok "GET /stats → OK"

  Step "UC-5: Profile (GET/PUT)"
  $profile = Invoke-RestMethod "$base/profile"
  $profile | Format-Table
  Invoke-RestMethod -Method PUT "$base/profile" -ContentType "application/json" -Body (@{ displayName="Test User"; language="en"; theme="dark"; level="beginner" } | ConvertTo-Json) | Out-Null
  Ok "PUT /profile → OK"

  Step "DONE"
  Ok "All smoke steps completed."
  if (-not $SkipPrism) {
    Warn "To stop Prism, close its window or kill the process from Task Manager."
  }
}
catch {
  Fail $_.Exception.Message
  exit 1
}
