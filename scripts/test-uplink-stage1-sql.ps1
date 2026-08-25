[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$reviewRoot = Join-Path $repoRoot 'supabase/review'
$containerName = 'rqs-uplink-stage1-sql-' + $PID
$postgresImage = 'postgres:17-alpine'
$localPassword = 'rqs-local-fixture-only'

function Invoke-Docker {
  param([Parameter(Mandatory)][string[]]$Arguments)

  $output = & docker @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed: $([Environment]::NewLine)$($output | Out-String)"
  }
  return $output
}

function Invoke-Psql {
  param(
    [Parameter(Mandatory)][string]$Database,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  return Invoke-Docker -Arguments (@(
    'exec', $containerName,
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', $Database
  ) + $Arguments)
}

function Invoke-PsqlFile {
  param(
    [Parameter(Mandatory)][string]$Database,
    [Parameter(Mandatory)][string]$ContainerPath,
    [string]$ExpectedState
  )

  $arguments = @()
  if ($ExpectedState) {
    $arguments += @('-v', "expected_state=$ExpectedState")
  }
  $arguments += @('-f', $ContainerPath)
  Invoke-Psql -Database $Database -Arguments $arguments | Out-Host
}

function Invoke-PsqlFileExpectFailure {
  param(
    [Parameter(Mandatory)][string]$Database,
    [Parameter(Mandatory)][string]$ContainerPath,
    [Parameter(Mandatory)][string]$ExpectedError
  )

  $output = & docker exec $containerName psql -v ON_ERROR_STOP=1 -U postgres -d $Database -f $ContainerPath 2>&1
  $exitCode = $LASTEXITCODE
  $text = $output | Out-String
  if ($exitCode -eq 0) {
    throw "EXPECTED_SQL_FAILURE_MISSING: $ExpectedError"
  }
  if ($text -notmatch [regex]::Escape($ExpectedError)) {
    throw "UNEXPECTED_SQL_FAILURE: expected=$ExpectedError output=$text"
  }
}

function Set-OwnerPolicies {
  param(
    [Parameter(Mandatory)][string]$Database,
    [Parameter(Mandatory)][string]$SelectPredicate,
    [Parameter(Mandatory)][string]$InsertPredicate
  )

  $sql = @"
drop policy if exists "Owners can read own uplinks" on public.rqs_uplinks;
create policy "Owners can read own uplinks"
on public.rqs_uplinks for select to authenticated
using ($SelectPredicate);
drop policy if exists "Permitir inserção de uplinks" on public.rqs_uplinks;
create policy "Permitir inserção de uplinks"
on public.rqs_uplinks for insert to authenticated
with check ($InsertPredicate);
"@
  Invoke-Psql -Database $Database -Arguments @('-c', $sql) | Out-Host
}

function Test-PolicyCompatibilityControls {
  param(
    [Parameter(Mandatory)][string]$Database,
    [Parameter(Mandatory)][string]$Fixture
  )

  $optimizedOwner = '(select auth.uid()) = user_id'
  $insertOwner = if ($Fixture -eq 'staging_like') {
    'auth.uid() = user_id'
  } else {
    $optimizedOwner
  }

  Set-OwnerPolicies -Database $Database -SelectPredicate 'true' -InsertPredicate $insertOwner
  Invoke-PsqlFileExpectFailure -Database $Database -ContainerPath '/review/uplink_stage1_creation_migration.sql' -ExpectedError 'RQS_UPLINKS_OWNER_SELECT_POLICY_REQUIRED'
  Set-OwnerPolicies -Database $Database -SelectPredicate $optimizedOwner -InsertPredicate $insertOwner

  Invoke-Psql -Database $Database -Arguments @(
    '-c',
    @"
create policy "Broad SELECT negative control"
on public.rqs_uplinks for select to authenticated
using ((select auth.uid()) = user_id or true);
"@
  ) | Out-Host
  Invoke-PsqlFileExpectFailure -Database $Database -ContainerPath '/review/uplink_stage1_creation_migration.sql' -ExpectedError 'RQS_UPLINKS_BROAD_SELECT_POLICY_REJECTED'
  Invoke-Psql -Database $Database -Arguments @(
    '-c', 'drop policy "Broad SELECT negative control" on public.rqs_uplinks;'
  ) | Out-Host

  Set-OwnerPolicies -Database $Database -SelectPredicate $optimizedOwner -InsertPredicate 'true'
  Invoke-PsqlFileExpectFailure -Database $Database -ContainerPath '/review/uplink_stage1_creation_migration.sql' -ExpectedError 'RQS_UPLINKS_OWNER_INSERT_POLICY_REQUIRED'
  Set-OwnerPolicies -Database $Database -SelectPredicate $optimizedOwner -InsertPredicate $insertOwner

  Invoke-Psql -Database $Database -Arguments @(
    '-c',
    @"
create policy "Broad INSERT negative control"
on public.rqs_uplinks for insert to authenticated
with check (true);
"@
  ) | Out-Host
  Invoke-PsqlFileExpectFailure -Database $Database -ContainerPath '/review/uplink_stage1_creation_migration.sql' -ExpectedError 'RQS_UPLINKS_BROAD_INSERT_POLICY_REJECTED'
  Invoke-Psql -Database $Database -Arguments @(
    '-c', 'drop policy "Broad INSERT negative control" on public.rqs_uplinks;'
  ) | Out-Host

  $selectPolicy = (
    Invoke-Psql -Database $Database -Arguments @(
      '-Atc',
      "select qual from pg_policies where schemaname='public' and tablename='rqs_uplinks' and cmd='SELECT';"
    ) | Out-String
  ).Trim()
  if ($selectPolicy -notmatch '(?i)select\s+auth\.uid\(\)') {
    throw "OPTIMIZED_SELECT_POLICY_SERIALIZATION_MISSING [$Fixture]: $selectPolicy"
  }

  if ($Fixture -eq 'production_like') {
    $insertPolicy = (
      Invoke-Psql -Database $Database -Arguments @(
        '-Atc',
        "select with_check from pg_policies where schemaname='public' and tablename='rqs_uplinks' and cmd='INSERT';"
      ) | Out-String
    ).Trim()
    if ($insertPolicy -notmatch '(?i)select\s+auth\.uid\(\)') {
      throw "OPTIMIZED_INSERT_POLICY_SERIALIZATION_MISSING [$Fixture]: $insertPolicy"
    }
  } else {
    $insertPolicy = (
      Invoke-Psql -Database $Database -Arguments @(
        '-Atc',
        "select with_check from pg_policies where schemaname='public' and tablename='rqs_uplinks' and cmd='INSERT';"
      ) | Out-String
    ).Trim()
    if ($insertPolicy -match '(?i)select\s+auth\.uid\(\)') {
      throw "DIRECT_INSERT_POLICY_SERIALIZATION_MISSING [$Fixture]: $insertPolicy"
    }
    Write-Output "DIRECT_OWNER_POLICY_FORM [$Fixture]: PASS"
  }

  Write-Output "REAL_OPTIMIZED_RLS_POLICY_FORM [$Fixture]: PASS"
  Write-Output "BROAD_POLICY_NEGATIVE_CONTROL [$Fixture]: PASS"
}

function Get-TrackingFingerprint {
  param([Parameter(Mandatory)][string]$Database)

  $query = @"
select md5(
  pg_get_functiondef(to_regprocedure('public.increment_uplink_clicks(uuid,text,text)'))
  || coalesce((
    select c.relacl::text || ':' || c.relrowsecurity::text
    from pg_class c
    where c.oid = 'public.rqs_uplink_click_dedup'::regclass
  ), '')
  || coalesce((
    select string_agg(indexdef, '|' order by indexname)
    from pg_indexes
    where schemaname = 'public' and tablename = 'rqs_uplink_click_dedup'
  ), '')
);
"@
  return (Invoke-Psql -Database $Database -Arguments @('-Atc', $query) | Out-String).Trim()
}

function Test-FreeConcurrency {
  param([Parameter(Mandatory)][string]$Database)

  $owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $seed = @"
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '$owner', false);
select custom_slug from public.create_rqs_uplink('https://example.com/concurrent-seed-1', 'concurrent-seed-1');
select custom_slug from public.create_rqs_uplink('https://example.com/concurrent-seed-2', 'concurrent-seed-2');
"@
  Invoke-Psql -Database $Database -Arguments @('-c', $seed) | Out-Host

  $jobScript = {
    param($Container, $Db, $Owner, $Slug)
    $sql = @"
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '$Owner', false);
select custom_slug from public.create_rqs_uplink('https://example.com/$Slug', '$Slug');
"@
    $output = & docker exec $Container psql -v ON_ERROR_STOP=1 -U postgres -d $Db -c $sql 2>&1
    [pscustomobject]@{
      ExitCode = $LASTEXITCODE
      Output = ($output | Out-String)
    }
  }

  $jobs = @(
    Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $Database, $owner, 'concurrent-a'
    Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $Database, $owner, 'concurrent-b'
  )
  try {
    $jobs | Wait-Job | Out-Null
    $results = @($jobs | Receive-Job)
  } finally {
    $jobs | Remove-Job -Force
  }

  $successCount = @($results | Where-Object ExitCode -eq 0).Count
  $limitedCount = @(
    $results | Where-Object {
      $_.ExitCode -ne 0 -and $_.Output -match 'UPLINK_FREE_LIMIT_REACHED'
    }
  ).Count
  if ($successCount -ne 1 -or $limitedCount -ne 1) {
    throw "FREE_CONCURRENCY_CONTRACT_FAILED: success=$successCount limited=$limitedCount"
  }

  $count = (
    Invoke-Psql -Database $Database -Arguments @(
      '-Atc',
      "select count(*) from public.rqs_uplinks where user_id = '$owner';"
    ) | Out-String
  ).Trim()
  if ($count -ne '3') {
    throw "FREE_CONCURRENCY_FINAL_COUNT_INVALID: $count"
  }
  Write-Output 'FREE_CONCURRENCY_MAX3: PASS'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'DOCKER_NOT_FOUND'
}

try {
  Invoke-Docker -Arguments @(
    'run', '--detach', '--rm', '--name', $containerName,
    '--env', "POSTGRES_PASSWORD=$localPassword",
    $postgresImage
  ) | Out-Null

  # The official image briefly starts a temporary bootstrap server. A plain
  # pg_isready can succeed during that window and race the final restart.
  $initComplete = $false
  foreach ($attempt in 1..120) {
    $logs = (& docker logs $containerName 2>&1 | Out-String)
    if ($logs -match 'PostgreSQL init process complete; ready for start up\.') {
      $initComplete = $true
      break
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $initComplete) {
    throw 'LOCAL_POSTGRES_CONTAINER_INIT_NOT_COMPLETE'
  }

  $ready = $false
  foreach ($attempt in 1..60) {
    $probe = & docker exec $containerName psql -Atc 'select 1;' -U postgres -d postgres 2>$null
    if ($LASTEXITCODE -eq 0 -and ($probe | Out-String).Trim() -eq '1') {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw 'LOCAL_POSTGRES_CONTAINER_NOT_READY'
  }

  Invoke-Docker -Arguments @('cp', "$reviewRoot/.", "$($containerName):/review") | Out-Null

  foreach ($fixture in @('staging_like', 'production_like')) {
    $database = 'rqs_uplink_' + $fixture
    Invoke-Psql -Database postgres -Arguments @(
      '-c', "create database $database;"
    ) | Out-Host
    Invoke-PsqlFile -Database $database -ContainerPath "/review/fixtures/uplink_stage1_$fixture.sql"

    Write-Output "BASELINE_AUDIT [$fixture]"
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_audit.sql'
    Test-PolicyCompatibilityControls -Database $database -Fixture $fixture
    $trackingBefore = Get-TrackingFingerprint -Database $database

    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_migration.sql'
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_tests.sql' -ExpectedState expand
    Test-FreeConcurrency -Database $database
    Invoke-Psql -Database $database -Arguments @(
      '-c', 'delete from public.rqs_uplinks where user_id is not null;'
    ) | Out-Host

    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_contract.sql'
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_tests.sql' -ExpectedState contract

    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_rollback.sql'
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_tests.sql' -ExpectedState rollback

    Invoke-Psql -Database $database -Arguments @(
      '-c', 'delete from public.rqs_uplinks where user_id is not null;'
    ) | Out-Host
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_migration.sql'
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_contract.sql'
    Invoke-PsqlFile -Database $database -ContainerPath '/review/uplink_stage1_creation_tests.sql' -ExpectedState contract

    $trackingAfter = Get-TrackingFingerprint -Database $database
    if ($trackingBefore -ne $trackingAfter) {
      throw "TRACKING_V3_SENTINEL_CHANGED [$fixture]"
    }

    $final = (
      Invoke-Psql -Database $database -Arguments @(
        '-Atc',
        @"
select
  (not has_table_privilege('authenticated', 'public.rqs_uplinks', 'INSERT'))
  and has_table_privilege('authenticated', 'public.rqs_uplinks', 'SELECT')
  and has_function_privilege('authenticated', 'public.create_rqs_uplink(text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_rqs_uplink(text,text)', 'EXECUTE');
"@
      ) | Out-String
    ).Trim()
    if ($final -ne 't') {
      throw "FINAL_HARDENED_STATE_INVALID [$fixture]"
    }

    Write-Output "UPLINK_SQL_MATRIX [$fixture]: PASS"
  }

  Write-Output 'UPLINK_STAGE1_SQL_MATRIX: PASS'
} finally {
  & docker rm --force $containerName 2>$null | Out-Null
}
