param(
    [switch]$SyncDb
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DoHost = "bite-do"
$ServerRoot = "/root/mio-gestionale"
$ServerBackend = "$ServerRoot/backend"
$ServerFrontend = "$ServerRoot/frontend"
$RemoteDbDumpPath = "/tmp/bite_erp_local_sync.sql"
$LocalDbDumpPath = Join-Path $env:TEMP "bite_erp_local_sync.sql"
$RemoteBackupDir = "/root/manual_db_backups"
$LocalIndexPath = Join-Path $RepoRoot "frontend\dist\index.html"
$LocalTableCountsSql = @'
SELECT table_name || '=' || (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
'@

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Invoke-Native {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$CaptureOutput
    )

    $output = & $FilePath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($output | Out-String).Trim()
    }

    if ($CaptureOutput) {
        return ($output | Out-String).Trim()
    }

    if ($output) {
        $output
    }
}

function Invoke-RepoCommand {
    param([string]$Command)
    Push-Location $RepoRoot
    try {
        $output = Invoke-Expression $Command 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw ($output | Out-String).Trim()
        }
        return ($output | Out-String).Trim()
    }
    finally {
        Pop-Location
    }
}

function Get-RemoteTableCounts {
    $counts = $LocalTableCountsSql | ssh $DoHost 'docker exec -i bite_erp_db psql -U bite -d bite_erp -At'
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile leggere i conteggi tabellari remoti."
    }
    return @($counts)
}

function Get-LocalTableCounts {
    $counts = $LocalTableCountsSql | docker exec -i bite_erp_db psql -U bite -d bite_erp -At
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile leggere i conteggi tabellari locali."
    }
    return @($counts)
}

function Assert-NoDifference {
    param(
        [string[]]$Reference,
        [string[]]$Difference,
        [string]$Label
    )

    $diff = Compare-Object $Reference $Difference
    if ($diff) {
        $preview = ($diff | Select-Object -First 20 | Out-String).Trim()
        throw "$Label non allineato.`n$preview"
    }
}

if (-not $SyncDb) {
    $choice = Read-Host "Sincronizzare anche il DB locale sul server? Digita SI per confermare, altrimenti premi Invio"
    if ($choice -eq "SI") {
        $SyncDb = $true
    }
}

Write-Step "Verifica stato locale iniziale"
$initialStatus = Invoke-RepoCommand "git status --short --branch"
$initialStatus

Write-Step "Commit e push delle modifiche applicative"
Invoke-RepoCommand "git add -A"
Invoke-RepoCommand "git restore --staged backend/backend_logs.txt backend/full_logs.txt backend/logs_audit.log backend/restart_logs.txt 2>`$null"
$staged = Invoke-RepoCommand "git diff --cached --name-only"
if ($staged) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    Invoke-RepoCommand "git commit -m `"deploy: allineamento $timestamp`""
}
Invoke-RepoCommand "git push origin main" | Out-Null

Write-Step "Allineamento repository sul server"
Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git fetch origin && git checkout main && git reset --hard origin/main")

Write-Step "Build frontend in produzione"
Invoke-Native "ssh" @($DoHost, "cd $ServerFrontend && npm ci --legacy-peer-deps && npm run build")

Write-Step "Rebuild backend in produzione"
Invoke-Native "ssh" @($DoHost, "cd $ServerBackend && docker compose up --build -d backend")

if ($SyncDb) {
    Write-Step "Backup database produzione"
    $backupName = "before_local_sync_{0}.sql.gz" -f (Get-Date -Format "yyyyMMdd_HHmmss")
    Invoke-Native "ssh" @($DoHost, "mkdir -p $RemoteBackupDir && docker exec bite_erp_db pg_dump -U bite --no-owner --no-privileges bite_erp | gzip -c > $RemoteBackupDir/$backupName")

    Write-Step "Dump database locale"
    & docker exec bite_erp_db pg_dump -U bite --no-owner --no-privileges bite_erp | Out-File -Encoding ascii $LocalDbDumpPath
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile creare il dump locale del database."
    }

    Write-Step "Upload dump locale sul server"
    Invoke-Native "scp" @($LocalDbDumpPath, "$DoHost`:$RemoteDbDumpPath")

    Write-Step "Restore database locale sul server"
    $restoreScript = @'
set -euo pipefail
docker exec -i bite_erp_db psql -U bite -d bite_erp -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cat /tmp/bite_erp_local_sync.sql | docker exec -i bite_erp_db psql -U bite -d bite_erp
rm -f /tmp/bite_erp_local_sync.sql
cd /root/mio-gestionale/backend
docker compose restart backend
'@
    $restoreScript | ssh $DoHost 'bash -s'
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile ripristinare il database sul server."
    }
}

Write-Step "Verifica commit locale e remoto"
$localHead = Invoke-RepoCommand "git rev-parse HEAD"
$remoteHead = Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git rev-parse HEAD") -CaptureOutput
if ($localHead -ne $remoteHead) {
    throw "HEAD locale e remoto non coincidono. Locale: $localHead Remoto: $remoteHead"
}

Write-Step "Verifica stato git locale e remoto"
$localStatus = Invoke-RepoCommand "git status --short --branch"
$remoteStatus = Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git status --short --branch") -CaptureOutput
if ($localStatus.Trim() -ne "## main...origin/main") {
    throw "Repository locale non pulito: $localStatus"
}
if ($remoteStatus.Trim() -ne "## main...origin/main") {
    throw "Repository remoto non pulito: $remoteStatus"
}

Write-Step "Verifica health locale e remota"
$localHealth = Invoke-Native "powershell" @("-NoProfile", "-Command", "Invoke-WebRequest -UseBasicParsing http://localhost:8000/health | Select-Object -ExpandProperty Content") -CaptureOutput
$remoteHealth = Invoke-Native "ssh" @($DoHost, "cd $ServerBackend && docker compose ps") -CaptureOutput
if ($localHealth.Trim() -ne '{"status":"ok"}') {
    throw "Health locale non valida: $localHealth"
}
if ($remoteHealth -notmatch "bite_erp_backend") {
    throw "Backend remoto non risulta attivo."
}

Write-Step "Verifica asset frontend live"
$localHtml = Get-Content $LocalIndexPath -Raw
$remoteHtml = Invoke-Native "curl.exe" @("-ksS", "https://178.128.198.11/") -CaptureOutput
if ($localHtml.Trim() -ne $remoteHtml.Trim()) {
    throw "L'index.html remoto non coincide con quello locale."
}

$assetMatch = [regex]::Match($localHtml, 'src="(?<path>/assets/[^"]+\.js)"')
if (-not $assetMatch.Success) {
    throw "Impossibile individuare il bundle JS principale nel frontend locale."
}
$assetPath = $assetMatch.Groups["path"].Value
$localAssetPath = Join-Path $RepoRoot ("frontend\dist" + $assetPath.Replace("/", "\"))
$remoteAssetTemp = Join-Path $env:TEMP "bite_erp_remote_asset.js"
Invoke-Native "curl.exe" @("-ksS", "https://178.128.198.11$assetPath", "-o", $remoteAssetTemp)
$localAssetHash = (Get-FileHash $localAssetPath -Algorithm SHA256).Hash
$remoteAssetHash = (Get-FileHash $remoteAssetTemp -Algorithm SHA256).Hash
if ($localAssetHash -ne $remoteAssetHash) {
    throw "Il bundle JS remoto non coincide con quello locale."
}

Write-Step "Verifica API online"
$apiResponse = Invoke-Native "curl.exe" @("-ksS", "https://178.128.198.11/api/v1/auth/me") -CaptureOutput
if ($apiResponse.Trim() -ne '{"detail":"Not authenticated"}') {
    throw "Risposta API online inattesa: $apiResponse"
}

if ($SyncDb) {
    Write-Step "Verifica allineamento dati DB"
    $localCounts = Get-LocalTableCounts
    $remoteCounts = Get-RemoteTableCounts
    Assert-NoDifference -Reference $localCounts -Difference $remoteCounts -Label "Conteggi tabellari DB"

    Start-Sleep -Seconds 5

    $localCountsRecheck = Get-LocalTableCounts
    $remoteCountsRecheck = Get-RemoteTableCounts
    Assert-NoDifference -Reference $localCountsRecheck -Difference $remoteCountsRecheck -Label "Conteggi tabellari DB al re-check"
}

Write-Step "Pulizia file temporanei"
Remove-Item $LocalDbDumpPath -ErrorAction SilentlyContinue
Remove-Item $remoteAssetTemp -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Allineamento completato con successo."
Write-Host "Commit locale/remoto: $localHead"
Write-Host "Bundle live verificato: $assetPath"
if ($SyncDb) {
    Write-Host "Database locale e produzione allineati."
}
