param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DoHost = "bite-do"
$ServerRoot = "/root/mio-gestionale"
$ServerBackend = "$ServerRoot/backend"
$LocalIndexPath = Join-Path $RepoRoot "frontend\dist\index.html"
$RemoteIndexTemp = Join-Path $env:TEMP "bite_erp_live_index.html"
$RemoteAssetTemp = Join-Path $env:TEMP "bite_erp_live_asset.js"
$LocalTableCountsSql = @'
SELECT table_name || '=' || (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
'@
$SchemaFingerprintSql = @'
SELECT md5(string_agg(table_name || ':' || column_name || ':' || data_type || ':' || coalesce(column_default,'') || ':' || is_nullable, '|' ORDER BY table_name, ordinal_position))
FROM information_schema.columns
WHERE table_schema='public';
'@
$DbIdentitySql = @'
SELECT current_database() || '|' || current_user;
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

    $previousNativePref = $null
    if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
        $previousNativePref = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }

    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE

    if ($null -ne $previousNativePref) {
        $PSNativeCommandUseErrorActionPreference = $previousNativePref
    }

    if ($exitCode -ne 0) {
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
        $previousNativePref = $null
        if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
            $previousNativePref = $PSNativeCommandUseErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $false
        }

        $output = Invoke-Expression $Command 2>&1
        $exitCode = $LASTEXITCODE

        if ($null -ne $previousNativePref) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePref
        }

        if ($exitCode -ne 0) {
            throw ($output | Out-String).Trim()
        }
        return ($output | Out-String).Trim()
    }
    finally {
        Pop-Location
    }
}

function Get-LocalPsqlResult {
    param([string]$Sql)
    $result = $Sql | docker exec -i bite_erp_db psql -U bite -d bite_erp -At
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile eseguire la query sul DB locale."
    }
    return ($result | Out-String).Trim()
}

function Get-RemotePsqlResult {
    param([string]$Sql)
    $result = $Sql | ssh $DoHost 'docker exec -i bite_erp_db psql -U bite -d bite_erp -At'
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile eseguire la query sul DB remoto."
    }
    return ($result | Out-String).Trim()
}

function Assert-Equal {
    param(
        [string]$Expected,
        [string]$Actual,
        [string]$Message
    )

    if ($Expected -ne $Actual) {
        throw "$Message`nAtteso: $Expected`nReale:  $Actual"
    }
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

try {
    Write-Step "Verifica git locale, GitHub e server"
    $localHead = Invoke-RepoCommand "git rev-parse HEAD"
    $originHead = (Invoke-RepoCommand "git ls-remote origin refs/heads/main").Split("`t")[0].Trim()
    $remoteHead = Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git rev-parse HEAD") -CaptureOutput
    Assert-Equal -Expected $localHead -Actual $originHead -Message "HEAD locale e GitHub non coincidono."
    Assert-Equal -Expected $localHead -Actual $remoteHead -Message "HEAD locale e server non coincidono."

    $localStatus = Invoke-RepoCommand "git status --short --branch"
    $remoteStatus = Invoke-Native "ssh" @($DoHost, "cd $ServerRoot && git status --short --branch") -CaptureOutput
    Assert-Equal -Expected "## main...origin/main" -Actual $localStatus.Trim() -Message "Repository locale non pulito."
    Assert-Equal -Expected "## main...origin/main" -Actual $remoteStatus.Trim() -Message "Repository server non pulito."

    Write-Step "Verifica runtime locale e server"
    $localCompose = Invoke-Native "docker" @("compose", "-f", (Join-Path $RepoRoot "backend\docker-compose.yml"), "ps") -CaptureOutput
    $remoteCompose = Invoke-Native "ssh" @($DoHost, "cd $ServerBackend && docker compose ps") -CaptureOutput
    if ($localCompose -notmatch "bite_erp_backend" -or $localCompose -notmatch "bite_erp_db" -or $localCompose -notmatch "bite_erp_frontend" -or $localCompose -notmatch "bite_erp_nginx") {
        throw "Stack locale incompleto o non attivo."
    }
    if ($remoteCompose -notmatch "bite_erp_backend" -or $remoteCompose -notmatch "bite_erp_db" -or $remoteCompose -notmatch "bite_erp_frontend" -or $remoteCompose -notmatch "bite_erp_nginx") {
        throw "Stack server incompleto o non attivo."
    }

    $localHealth = Invoke-Native "powershell" @("-NoProfile", "-Command", "(Invoke-WebRequest -UseBasicParsing http://localhost:8000/health).Content") -CaptureOutput
    $prodApi = Invoke-Native "curl.exe" @("-ksS", "https://178.128.198.11/api/v1/auth/me") -CaptureOutput
    Assert-Equal -Expected '{"status":"ok"}' -Actual $localHealth.Trim() -Message "Backend locale non risponde come previsto."
    Assert-Equal -Expected '{"detail":"Not authenticated"}' -Actual $prodApi.Trim() -Message "API produzione non risponde come previsto."

    Write-Step "Verifica build React locale vs online"
    Invoke-Native "curl.exe" @("-ksS", "https://178.128.198.11/", "-o", $RemoteIndexTemp)
    $localIndexHash = (Get-FileHash $LocalIndexPath -Algorithm SHA256).Hash
    $remoteIndexHash = (Get-FileHash $RemoteIndexTemp -Algorithm SHA256).Hash
    Assert-Equal -Expected $localIndexHash -Actual $remoteIndexHash -Message "index.html della build React non coincide tra locale e online."

    $localHtml = Get-Content $LocalIndexPath -Raw
    $assetMatch = [regex]::Match($localHtml, 'src="(?<path>/assets/[^"]+\.js)"')
    if (-not $assetMatch.Success) {
        throw "Impossibile individuare il bundle JS principale nella build locale."
    }
    $assetPath = $assetMatch.Groups["path"].Value
    $localAssetPath = Join-Path $RepoRoot ("frontend\dist" + $assetPath.Replace("/", "\"))
    Invoke-Native "curl.exe" @("-ksS", "https://178.128.198.11$assetPath", "-o", $RemoteAssetTemp)
    $localAssetHash = (Get-FileHash $localAssetPath -Algorithm SHA256).Hash
    $remoteAssetHash = (Get-FileHash $RemoteAssetTemp -Algorithm SHA256).Hash
    Assert-Equal -Expected $localAssetHash -Actual $remoteAssetHash -Message "Bundle JS React non coincide tra locale e online."

    Write-Step "Verifica database locale vs server"
    $remoteComposeConfig = Invoke-Native "ssh" @($DoHost, "cd $ServerBackend && docker compose config") -CaptureOutput
    if ($remoteComposeConfig -notmatch "DATABASE_URL: postgresql\+asyncpg://") {
        throw "Il backend server non espone una DATABASE_URL PostgreSQL valida."
    }
    if ($remoteComposeConfig -notmatch "@db:5432/bite_erp") {
        throw "Il backend server non punta al Postgres Docker interno previsto."
    }

    $localDbIdentity = Get-LocalPsqlResult -Sql $DbIdentitySql
    $remoteDbIdentity = Get-RemotePsqlResult -Sql $DbIdentitySql
    Assert-Equal -Expected "bite_erp|bite" -Actual $localDbIdentity -Message "Il DB locale attivo non e' quello previsto."
    Assert-Equal -Expected "bite_erp|bite" -Actual $remoteDbIdentity -Message "Il DB server attivo non e' quello previsto."

    $localSchemaFingerprint = Get-LocalPsqlResult -Sql $SchemaFingerprintSql
    $remoteSchemaFingerprint = Get-RemotePsqlResult -Sql $SchemaFingerprintSql
    Assert-Equal -Expected $localSchemaFingerprint -Actual $remoteSchemaFingerprint -Message "Schema DB locale e server non coincidono."

    $localCounts = @((Get-LocalPsqlResult -Sql $LocalTableCountsSql) -split "`r?`n" | Where-Object { $_ })
    $remoteCounts = @((Get-RemotePsqlResult -Sql $LocalTableCountsSql) -split "`r?`n" | Where-Object { $_ })
    Assert-NoDifference -Reference $localCounts -Difference $remoteCounts -Label "Conteggi tabellari DB"

    Start-Sleep -Seconds 3

    $localCountsRecheck = @((Get-LocalPsqlResult -Sql $LocalTableCountsSql) -split "`r?`n" | Where-Object { $_ })
    $remoteCountsRecheck = @((Get-RemotePsqlResult -Sql $LocalTableCountsSql) -split "`r?`n" | Where-Object { $_ })
    Assert-NoDifference -Reference $localCountsRecheck -Difference $remoteCountsRecheck -Label "Conteggi tabellari DB al re-check"

    Write-Step "Pulizia file temporanei"
    Remove-Item $RemoteIndexTemp -ErrorAction SilentlyContinue
    Remove-Item $RemoteAssetTemp -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "Verifica completata con successo."
    Write-Host "HEAD allineata: $localHead"
    Write-Host "Bundle React live: $assetPath"
    Write-Host "Hash index.html: $localIndexHash"
    Write-Host "Hash bundle JS: $localAssetHash"
    Write-Host "Fingerprint schema DB: $localSchemaFingerprint"
}
catch {
    Remove-Item $RemoteIndexTemp -ErrorAction SilentlyContinue
    Remove-Item $RemoteAssetTemp -ErrorAction SilentlyContinue
    throw
}
