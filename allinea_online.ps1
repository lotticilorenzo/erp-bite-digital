param(
    [switch]$SyncDb,
    [switch]$NoDbPrompt
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendRoot = Join-Path $RepoRoot "frontend"
$DoHost = "bite-do"
$ServerRoot = "/root/mio-gestionale"
$ServerBackend = "$ServerRoot/backend"
$ServerFrontend = "$ServerRoot/frontend"
$LocalComposeFile = Join-Path $RepoRoot "backend\docker-compose.yml"
$DockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$RemoteComposeFile = "docker-compose.prod.yml"
$RemoteDbDumpPath = "/tmp/bite_erp_local_sync.sql"
$LocalDbDumpPath = Join-Path $env:TEMP "bite_erp_local_sync.sql"
$RemoteBackupDir = "/root/manual_db_backups"
$LocalIndexPath = Join-Path $RepoRoot "frontend\dist\index.html"
$ProductionBaseUrl = "https://erp.bitedigitalstudio.com"
$LocalHealthUrl = "http://localhost:8000/health"
$RemoteHealthUrl = "http://localhost:8000/health"
$ExpectedHealthPayload = '{"status":"ok"}'
$RemoteGitNoisePaths = @("frontend/package-lock.json")
$LocalTableCountsSql = @'
SELECT table_name || '=' || (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'schema_migrations'
ORDER BY table_name;
'@

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Quote-ProcessArgument {
    param([AllowEmptyString()][string]$Argument)

    if ($null -eq $Argument) {
        return '""'
    }

    if ($Argument -notmatch '[\s"]') {
        return $Argument
    }

    $escaped = $Argument -replace '(\\*)"', '$1$1\"'
    $escaped = $escaped -replace '(\\+)$', '$1$1'
    return '"' + $escaped + '"'
}

function Invoke-Native {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$CaptureOutput
    )

    $stdoutPath = Join-Path $env:TEMP ("codex_stdout_" + [guid]::NewGuid().ToString("N") + ".log")
    $stderrPath = Join-Path $env:TEMP ("codex_stderr_" + [guid]::NewGuid().ToString("N") + ".log")
    $argumentString = (($Arguments | ForEach-Object { Quote-ProcessArgument $_ }) -join " ")

    try {
        $process = Start-Process `
            -FilePath $FilePath `
            -ArgumentList $argumentString `
            -NoNewWindow `
            -PassThru `
            -Wait `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $stdout = if (Test-Path $stdoutPath) { Get-Content $stdoutPath -Raw } else { "" }
        $stderr = if (Test-Path $stderrPath) { Get-Content $stderrPath -Raw } else { "" }
        $stdoutText = if ($null -eq $stdout) { "" } else { [string]$stdout }
        $stderrText = if ($null -eq $stderr) { "" } else { [string]$stderr }
        $combined = [string]::Concat($stdoutText, $stderrText)
        if ($null -eq $combined) {
            $combined = ""
        }
        else {
            $combined = $combined.Trim()
        }

        if ($process.ExitCode -ne 0) {
            throw $combined
        }

        if ($CaptureOutput) {
            return $combined
        }

        if ($stdout) {
            Write-Output ($stdout.TrimEnd())
        }
        if ($stderr) {
            Write-Output ($stderr.TrimEnd())
        }
    }
    finally {
        Remove-Item $stdoutPath -ErrorAction SilentlyContinue
        Remove-Item $stderrPath -ErrorAction SilentlyContinue
    }
}

function Invoke-InDirectory {
    param(
        [string]$Directory,
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$CaptureOutput
    )

    Push-Location $Directory
    try {
        if ($CaptureOutput) {
            return Invoke-Native $FilePath $Arguments -CaptureOutput
        }

        Invoke-Native $FilePath $Arguments
    }
    finally {
        Pop-Location
    }
}

function Invoke-RepoGit {
    param(
        [string[]]$Arguments,
        [switch]$CaptureOutput
    )

    if ($CaptureOutput) {
        return Invoke-InDirectory -Directory $RepoRoot -FilePath "git" -Arguments $Arguments -CaptureOutput
    }

    Invoke-InDirectory -Directory $RepoRoot -FilePath "git" -Arguments $Arguments
}

function Get-LocalPythonExecutable {
    $venvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        return $venvPython
    }
    return "python"
}

function Test-DockerReady {
    try {
        & docker info *> $null
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

function Ensure-DockerReady {
    if (Test-DockerReady) {
        return
    }

    if (-not (Test-Path $DockerDesktopExe)) {
        throw "Docker Desktop non trovato. Installa o avvia Docker Desktop prima del deploy."
    }

    Write-Step "Avvio Docker Desktop locale"
    Start-Process -FilePath $DockerDesktopExe -WindowStyle Hidden

    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 5
        if (Test-DockerReady) {
            return
        }
    } while ((Get-Date) -lt $deadline)

    throw "Docker Desktop non e' pronto dopo 3 minuti."
}

function Wait-ForHealth {
    param(
        [string]$Url,
        [string]$ExpectedContent,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $content = (Invoke-WebRequest -UseBasicParsing $Url).Content
            if ($content.Trim() -eq $ExpectedContent) {
                return $content.Trim()
            }
        }
        catch {
        }

        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)

    throw "Endpoint $Url non ha restituito '$ExpectedContent' entro $TimeoutSeconds secondi."
}

function Wait-ForRemoteHealth {
    param([int]$TimeoutSeconds = 120)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $content = Invoke-Native "ssh" @($DoHost, "curl -fsS $RemoteHealthUrl") -CaptureOutput
            if ($content.Trim() -eq $ExpectedHealthPayload) {
                return $content.Trim()
            }
        }
        catch {
        }

        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)

    throw "Health remota non valida entro $TimeoutSeconds secondi."
}

function Restore-RemoteGitNoise {
    $paths = $RemoteGitNoisePaths -join " "
    Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git restore -- $paths 2>/dev/null || true") | Out-Null
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

if (-not $SyncDb -and -not $NoDbPrompt) {
    $choice = Read-Host "Sincronizzare anche il DB locale sul server? Digita SI per confermare, altrimenti premi Invio"
    if ($choice -eq "SI") {
        $SyncDb = $true
    }
}

Write-Step "Preparazione ambiente locale"
Ensure-DockerReady

Write-Step "Test backend locale"
$pythonExecutable = Get-LocalPythonExecutable
Invoke-InDirectory -Directory $RepoRoot -FilePath $pythonExecutable -Arguments @("-m", "pytest", "backend/tests", "-q")

Write-Step "Build frontend locale"
Invoke-InDirectory -Directory $FrontendRoot -FilePath "cmd.exe" -Arguments @("/d", "/c", "npm ci --legacy-peer-deps")
Invoke-InDirectory -Directory $FrontendRoot -FilePath "cmd.exe" -Arguments @("/d", "/c", "npm run build 2>&1")

Write-Step "Avvio/allineamento stack locale"
Invoke-Native "docker" @("compose", "-f", $LocalComposeFile, "up", "-d", "--build")
Wait-ForHealth -Url $LocalHealthUrl -ExpectedContent $ExpectedHealthPayload | Out-Null

Write-Step "Verifica stato locale iniziale"
$initialStatus = Invoke-RepoGit -Arguments @("status", "--short", "--branch") -CaptureOutput
$initialStatus

Write-Step "Commit e push delle modifiche applicative"
Invoke-RepoGit -Arguments @("add", "-A")
Invoke-InDirectory -Directory $RepoRoot -FilePath "cmd.exe" -Arguments @("/d", "/c", "git restore --staged backend/backend_logs.txt backend/full_logs.txt backend/logs_audit.log backend/restart_logs.txt 2>nul")
$staged = Invoke-RepoGit -Arguments @("diff", "--cached", "--name-only") -CaptureOutput
if ($staged) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    Invoke-RepoGit -Arguments @("commit", "-m", "deploy: allineamento $timestamp")
}
Invoke-RepoGit -Arguments @("push", "origin", "main") | Out-Null

Write-Step "Pulizia drift git sul server"
Restore-RemoteGitNoise

Write-Step "Allineamento repository sul server"
Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git checkout main && git pull --ff-only origin main")

Write-Step "Build frontend in produzione"
Invoke-Native "ssh" @($DoHost, "cd $ServerFrontend && npm ci --legacy-peer-deps && npm run build")
Restore-RemoteGitNoise

Write-Step "Rebuild backend in produzione"
Invoke-Native "ssh" @($DoHost, "cd $ServerBackend && docker compose -f $RemoteComposeFile up --build -d db backend nginx db_backup")

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
docker compose -f docker-compose.prod.yml restart backend
'@
    ($restoreScript -replace "`r", "") | ssh $DoHost 'bash -s'
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile ripristinare il database sul server."
    }
}

Write-Step "Verifica commit locale e remoto"
$localHead = Invoke-RepoGit -Arguments @("rev-parse", "HEAD") -CaptureOutput
$remoteHead = Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git rev-parse HEAD") -CaptureOutput
if ($localHead -ne $remoteHead) {
    throw "HEAD locale e remoto non coincidono. Locale: $localHead Remoto: $remoteHead"
}

Write-Step "Verifica stato git locale e remoto"
$localStatus = Invoke-RepoGit -Arguments @("status", "--short", "--branch") -CaptureOutput
$remoteStatus = Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git status --short --branch") -CaptureOutput
if ($localStatus.Trim() -ne "## main...origin/main") {
    throw "Repository locale non pulito: $localStatus"
}
if ($remoteStatus.Trim() -ne "## main...origin/main") {
    throw "Repository remoto non pulito: $remoteStatus"
}

Write-Step "Verifica health locale e remota"
$localHealth = Wait-ForHealth -Url $LocalHealthUrl -ExpectedContent $ExpectedHealthPayload
$remoteHealth = Wait-ForRemoteHealth
$remoteCompose = Invoke-Native "ssh" @($DoHost, "cd $ServerBackend && docker compose -f $RemoteComposeFile ps") -CaptureOutput
$remoteSockets = Invoke-Native "ssh" @($DoHost, "ss -ltn") -CaptureOutput
if ($localHealth.Trim() -ne $ExpectedHealthPayload) {
    throw "Health locale non valida: $localHealth"
}
if ($remoteHealth.Trim() -ne $ExpectedHealthPayload) {
    throw "Health remota non valida: $remoteHealth"
}
if ($remoteCompose -notmatch "bite_erp_backend") {
    throw "Backend remoto non risulta attivo."
}
if ($remoteSockets -match "0\.0\.0\.0:8000" -or $remoteSockets -match "\[::\]:8000") {
    throw "Il backend produzione risulta ancora esposto pubblicamente sulla porta 8000."
}
if ($remoteSockets -match "5173") {
    throw "La porta 5173 risulta ancora in ascolto sul server produzione."
}
if ($remoteSockets -notmatch "127\.0\.0\.1:8000") {
    throw "Il backend produzione non risulta vincolato su loopback 127.0.0.1:8000."
}

Write-Step "Verifica asset frontend live"
$localHtml = Get-Content $LocalIndexPath -Raw
$remoteHtml = Invoke-Native "curl.exe" @("-ksS", "$ProductionBaseUrl/") -CaptureOutput
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
Invoke-Native "curl.exe" @("-ksS", "$ProductionBaseUrl$assetPath", "-o", $remoteAssetTemp)
$localAssetHash = (Get-FileHash $localAssetPath -Algorithm SHA256).Hash
$remoteAssetHash = (Get-FileHash $remoteAssetTemp -Algorithm SHA256).Hash
if ($localAssetHash -ne $remoteAssetHash) {
    throw "Il bundle JS remoto non coincide con quello locale."
}

Write-Step "Verifica API online"
$localApiStatus = Invoke-Native "curl.exe" @("-sS", "-o", "NUL", "-w", "%{http_code}", "http://localhost:8000/api/v1/auth/me") -CaptureOutput
$localApiBody = Invoke-Native "curl.exe" @("-sS", "http://localhost:8000/api/v1/auth/me") -CaptureOutput
$remoteApiStatus = Invoke-Native "curl.exe" @("-ksS", "-o", "NUL", "-w", "%{http_code}", "$ProductionBaseUrl/api/v1/auth/me") -CaptureOutput
$remoteApiBody = Invoke-Native "curl.exe" @("-ksS", "$ProductionBaseUrl/api/v1/auth/me") -CaptureOutput
if ($remoteApiStatus.Trim() -ne $localApiStatus.Trim()) {
    throw "Status API online inatteso. Locale: $localApiStatus Remoto: $remoteApiStatus"
}
if ($remoteApiBody.Trim() -ne $localApiBody.Trim()) {
    throw "Payload API online inatteso. Locale: $localApiBody Remoto: $remoteApiBody"
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
