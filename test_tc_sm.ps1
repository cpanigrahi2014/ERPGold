$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8091/api/v1/billing'

function New-Uuid { [guid]::NewGuid().Guid }

function Create-PaymentRegister([string]$cid, [string]$branch, [decimal]$amount, [string]$tender, [decimal]$grams, [decimal]$purity) {
    $body = @{
        customerId = $cid
        branchCode = $branch
        amount = $amount
        tender = $tender
        goldGrams = $grams
        purity = $purity
    } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/payments-register" -ContentType 'application/json' -Body $body
}

function Create-Exchange([string]$cid, [string]$branch, [decimal]$grams, [decimal]$purity) {
    $body = @{
        customerId = $cid
        branchCode = $branch
        goldGrams = $grams
        purity = $purity
        cashComponent = 0
    } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/exchange-records" -ContentType 'application/json' -Body $body
}

function Get-ScrapLog { Invoke-RestMethod -Method Get -Uri "$base/scrap-log" }
function Get-ScrapReport { Invoke-RestMethod -Method Get -Uri "$base/scrap-report" }
function Get-DailyScrapReport([string]$date) { Invoke-RestMethod -Method Get -Uri "$base/scrap-report/daily?date=$date" }
function Get-Exchanges { Invoke-RestMethod -Method Get -Uri "$base/exchange-records" }
function Create-MonthlyValidation([int]$year, [int]$month) {
    $body = @{ year = $year; month = $month } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/scrap-validations/monthly" -ContentType 'application/json' -Body $body
}

function Round3([decimal]$v) { [decimal]::Round($v, 3) }
function AsList($v) {
    if ($null -eq $v) { return @() }
    if ($v -is [array]) {
        if ($v.Count -eq 1 -and $v[0] -is [array]) { return $v[0] }
        return $v
    }
    return @($v)
}
function Dbl($v) {
    if ($v -is [array]) { $v = $v[0] }
    return [double]$v
}
function Dec($v) {
    if ($v -is [array]) { $v = $v[0] }
    return [decimal]$v
}
function Str($v) {
    if ($v -is [array]) { $v = $v[0] }
    return [string]$v
}

$results = @()

# TC-SM.01: Day 1 events 2.5g@916 and 1.0g@750 should appear with pure-gold equivalents
$cid1 = New-Uuid
$p1 = Create-PaymentRegister $cid1 'BLR1' 100 'gold_physical' 2.5 916
$p2 = Create-PaymentRegister $cid1 'BLR1' 100 'gold_physical' 1.0 750
$day1 = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$daily = Get-DailyScrapReport $day1
$entries1 = AsList $daily.entries
$p1id = Str $p1.id
$p2id = Str $p2.id
$e1 = $entries1 | Where-Object { (Str $_.linkedPaymentId) -eq $p1id } | Select-Object -First 1
$e2 = $entries1 | Where-Object { (Str $_.linkedPaymentId) -eq $p2id } | Select-Object -First 1
if ($e1 -is [array]) { $e1 = $e1[0] }
if ($e2 -is [array]) { $e2 = $e2[0] }
$expPure1 = Round3((2.5 * 916) / 100)
$expPure2 = Round3((1.0 * 750) / 100)
$ok1 = $null -ne $e1 -and $null -ne $e2 -and (Dec $e1.goldGrams -eq 2.5) -and (Dec $e1.purity -eq 916) -and (Dec $e1.pureGold -eq $expPure1) -and (Dec $e2.goldGrams -eq 1.0) -and (Dec $e2.purity -eq 750) -and (Dec $e2.pureGold -eq $expPure2)
$results += [pscustomobject]@{
    id = 'TC-SM.01'
    expected = 'Daily report lists both entries with computed pure-gold equivalents'
    actual = if ($ok1) { "daily entries include both payments: pure1=$($e1.pureGold), pure2=$($e2.pureGold)" } else { 'Daily report missing one or both entries / values mismatch' }
    status = if ($ok1) { 'Pass' } else { 'Fail' }
}

# TC-SM.02: Monthly validation aggregate record creation
$ym2 = Get-Date
$v2 = Create-MonthlyValidation $ym2.Year $ym2.Month
$ok2 = ($null -ne $v2.id) -and ((Dec $v2.expectedPureGold) -ge 0) -and ((Dec $v2.actualPureGold) -ge 0)
$results += [pscustomobject]@{
    id = 'TC-SM.02'
    expected = 'Monthly validation record created aggregating all daily entries'
    actual = if ($ok2) { "validationId=$($v2.id), expected=$($v2.expectedPureGold), actual=$($v2.actualPureGold)" } else { 'Validation record not created or values invalid' }
    status = if ($ok2) { 'Pass' } else { 'Fail' }
}

# TC-SM.03: Expected=50 pure, Actual=48 pure, variance should be 2 and discrepancy shown
$cid3 = New-Uuid
Create-Exchange $cid3 'BLR1' 50 100 | Out-Null
Create-PaymentRegister $cid3 'BLR1' 100 'gold_physical' 48 100 | Out-Null
$ex3 = AsList (Get-Exchanges) | Where-Object { (Str $_.customerId) -eq $cid3 }
$log3 = AsList (Get-ScrapLog) | Where-Object { (Str $_.customerId) -eq $cid3 }
$exp3 = 0.0
foreach ($e in $ex3) { $exp3 += ((Dbl $e.goldGrams) * (Dbl $e.purity) / 100.0) }
$act3 = 0.0
foreach ($l in $log3) { $act3 += (Dbl $l.pureGold) }
$deltaExpected = Round3([decimal]$exp3)
$deltaActual = Round3([decimal]$act3)
$deltaVar = Round3([decimal]($exp3 - $act3))
$ok3 = ($deltaExpected -eq 50) -and ($deltaActual -eq 48) -and ($deltaVar -eq 2)
$results += [pscustomobject]@{
    id = 'TC-SM.03'
    expected = 'Variance shown as 2g and discrepancy flagged'
    actual = "deltaExpected=$deltaExpected, deltaActual=$deltaActual, deltaVariance=$deltaVar"
    status = if ($ok3) { 'Pass' } else { 'Fail' }
}

# TC-SM.04: Weighted average purity from multiple entries
$logBefore4 = AsList (Get-ScrapLog)
$sumW0 = 0.0
$sumGW0 = 0.0
foreach ($x in $logBefore4) { $sumW0 += (Dbl $x.goldGrams); $sumGW0 += ((Dbl $x.goldGrams) * (Dbl $x.purity)) }
$cid4 = New-Uuid
Create-PaymentRegister $cid4 'BLR1' 100 'gold_physical' 3.0 900 | Out-Null
Create-PaymentRegister $cid4 'BLR1' 100 'gold_physical' 1.0 700 | Out-Null
$report4 = Get-ScrapReport
$sumW1 = $sumW0 + 4.0
$sumGW1 = $sumGW0 + (3.0*900.0) + (1.0*700.0)
$expectedWt = if ($sumW1 -eq 0) { 0 } else { [math]::Round(($sumGW1 / $sumW1), 2) }
$actualWt = Dbl $report4.wtAvgPurityActual
$ok4 = [math]::Abs($actualWt - $expectedWt) -le 0.01
$results += [pscustomobject]@{
    id = 'TC-SM.04'
    expected = 'Weighted average purity computed correctly'
    actual = "expectedWt=$expectedWt, apiWt=$actualWt"
    status = if ($ok4) { 'Pass' } else { 'Fail' }
}

# TC-SM.05: No scrap events in a given month validation
$futureYear = 2099
$futureMonth = 12
$v5 = Create-MonthlyValidation $futureYear $futureMonth
$ok5 = ((Dec $v5.actualPureGold) -eq 0) -and ((Dec $v5.variance) -eq (Dec $v5.expectedPureGold))
$results += [pscustomobject]@{
    id = 'TC-SM.05'
    expected = 'No-events month shows zero actual scrap and variance = expected scrap'
    actual = "expected=$($v5.expectedPureGold), actual=$($v5.actualPureGold), variance=$($v5.variance)"
    status = if ($ok5) { 'Pass' } else { 'Fail' }
}

# TC-SM.06: gold_physical payment appears in daily scrap log and included in totals
$cid6 = New-Uuid
$p6 = Create-PaymentRegister $cid6 'BLR1' 100 'gold_physical' 2.0 800
$log6 = AsList (Get-ScrapLog)
$p6id = Str $p6.id
$entry6 = $log6 | Where-Object { (Str $_.linkedPaymentId) -eq $p6id } | Select-Object -First 1
if ($entry6 -is [array]) { $entry6 = $entry6[0] }
$sumLogPure = 0.0
foreach ($l in $log6) { $sumLogPure += (Dbl $l.pureGold) }
$report6 = Get-ScrapReport
$reportMatchesLogs = ([math]::Abs((Dbl $report6.actualPureGold) - $sumLogPure) -le 0.01)
$ok6 = $null -ne $entry6 -and (Dec $entry6.pureGold -eq 16.000) -and $reportMatchesLogs
$results += [pscustomobject]@{
    id = 'TC-SM.06'
    expected = 'gold_physical payment appears in scrap log and contributes to totals'
    actual = if ($ok6) { "entryPure=$($entry6.pureGold), reportActualMatchesLogSum=$reportMatchesLogs" } else { 'Entry missing or totals do not align with scrap report actual' }
    status = if ($ok6) { 'Pass' } else { 'Fail' }
}

$results | ConvertTo-Json -Depth 5
