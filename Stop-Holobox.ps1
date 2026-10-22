# Stop-Holobox.ps1
# Sluit Phosaner en de lokale servers. Geen pause: het venster sluit als dit script klaar is.
$ErrorActionPreference = "SilentlyContinue"
$ports = @(4173, 5173, 4174, 5174)
$appNames = @("Editor", "Phosaner")

function Write-Step($text) {
    Write-Host $text -ForegroundColor Cyan
}

function Stop-ProcessSafe([int]$processId, [string]$reason) {
    if ($processId -le 4) { return }
    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $proc) { return }
    if ($proc.Id -eq $PID) { return }
    Write-Host ("  Stop PID {0} ({1}) - {2}" -f $processId, $proc.ProcessName, $reason)
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

function Stop-PortListeners([int]$port, [string]$reason) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host ("  Poort {0}: vrij" -f $port)
        return
    }
    $conns |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-ProcessSafe -processId $_ -reason $reason }
}

Write-Host ""
Write-Host "Phosaner afsluiten..." -ForegroundColor Green
Write-Host ""
Write-Step "1. Programma's op de poorten stoppen"
foreach ($port in $ports) {
    Stop-PortListeners -port $port -reason ("luistert op poort {0}" -f $port)
}
Write-Step "2. Editor en studentapp stoppen"
foreach ($name in $appNames) {
    Get-Process -Name $name -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-ProcessSafe -processId $_.Id -reason $name }
}
Start-Sleep -Seconds 1
Write-Step "3. Controle"
$left = @()
foreach ($port in $ports) {
    $still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        $left += $port
        $still |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { Stop-ProcessSafe -processId $_ -reason ("tweede poging poort {0}" -f $port) }
    }
}
if ($left.Count -gt 0) {
    Start-Sleep -Seconds 1
}
$stillPorts = @()
foreach ($port in $ports) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        $stillPorts += $port
    }
}
Write-Host ""
if ($stillPorts.Count -eq 0) {
    Write-Host "Klaar. Poorten 4173, 5173, 4174 en 5174 zijn vrij." -ForegroundColor Green
} else {
    Write-Host "Niet alles kon worden gestopt:" -ForegroundColor Red
    foreach ($port in $stillPorts) { Write-Host ("  Poort {0} is nog bezet" -f $port) }
}
exit 0
