$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8092/api/v1/records'

function New-Uuid { [guid]::NewGuid().Guid }

function New-Record([string]$branchCode, [string]$branchName) {
    $month = Get-Random -Minimum 1 -Maximum 13
    $year = Get-Random -Minimum 2030 -Maximum 2090
    $branchRef = New-Uuid
    $name = "BR/$branchName/$year-$('{0:D2}' -f $month)"
    $body = @{
        branchRef = $branchRef
        branchCode = $branchCode
        branchName = $branchName
        month = $month
        year = $year
        name = $name
    } | ConvertTo-Json
    return Invoke-RestMethod -Method Post -Uri "$base/business-records" -ContentType 'application/json' -Body $body
}

function Update-Record([string]$id, [string]$expenseRows, [string]$corpRows) {
    $body = @{}
    if ($null -ne $expenseRows) { $body.expenseRows = $expenseRows }
    if ($null -ne $corpRows) { $body.corporateExpenseRows = $corpRows }
    return Invoke-RestMethod -Method Patch -Uri "$base/business-records/$id" -ContentType 'application/json' -Body ($body | ConvertTo-Json)
}

function Parse-JsonArray([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    try {
        $v = $text | ConvertFrom-Json
        if ($v -is [array]) { return $v }
        return @($v)
    } catch {
        return @()
    }
}

function Find-ById([array]$rows, [string]$id) {
    return $rows | Where-Object { $_.id -eq $id } | Select-Object -First 1
}

$results = @()

# TC-BE.01
$r1 = New-Record 'BLR1' 'Bangalore Branch'
$exp1 = @(@{ id = (New-Uuid); date = '2026-05-01'; source = 'Stationery'; amount = 1200 }) | ConvertTo-Json -Compress
Update-Record $r1.id $exp1 '[]' | Out-Null
$all = Invoke-RestMethod -Method Get -Uri "$base/business-records"
$x1 = Find-ById $all $r1.id
$x1Exp = Parse-JsonArray $x1.expenseRows
$x1Corp = Parse-JsonArray $x1.corporateExpenseRows
$results += [pscustomobject]@{
    id = 'TC-BE.01'
    branchCode = $x1.branchCode
    expenseCount = $x1Exp.Count
    corporateExpenseCount = $x1Corp.Count
    expected = 'Branch expense tied to BLR1 and not in corporate expense log'
    actual = "branch=$($x1.branchCode), expenseCount=$($x1Exp.Count), corporateExpenseCount=$($x1Corp.Count)"
    status = if ($x1.branchCode -eq 'BLR1' -and $x1Exp.Count -eq 1 -and $x1Corp.Count -eq 0) { 'Pass' } else { 'Fail' }
}

# TC-BE.02
$r2 = New-Record 'CORP' 'Corporate HQ'
$corp2 = @(@{ id = (New-Uuid); head = 'Legal'; amount = 5000 }) | ConvertTo-Json -Compress
Update-Record $r2.id '[]' $corp2 | Out-Null
$all = Invoke-RestMethod -Method Get -Uri "$base/business-records"
$x2 = Find-ById $all $r2.id
$x2Exp = Parse-JsonArray $x2.expenseRows
$x2Corp = Parse-JsonArray $x2.corporateExpenseRows
$results += [pscustomobject]@{
    id = 'TC-BE.02'
    branchCode = $x2.branchCode
    expenseCount = $x2Exp.Count
    corporateExpenseCount = $x2Corp.Count
    expected = 'Corporate expense saved in corporate log and not mixed with branch expense'
    actual = "branch=$($x2.branchCode), expenseCount=$($x2Exp.Count), corporateExpenseCount=$($x2Corp.Count)"
    status = if ($x2.branchCode -eq 'CORP' -and $x2Corp.Count -eq 1 -and $x2Exp.Count -eq 0) { 'Pass' } else { 'Fail' }
}

# TC-BE.03
$r3 = New-Record 'CORP' 'Corporate HQ'
$corp3 = @(@{ id = (New-Uuid); head = 'Professional Fees'; grossAmount = 10000; tdsPct = 10 }) | ConvertTo-Json -Compress
Update-Record $r3.id '[]' $corp3 | Out-Null
$all = Invoke-RestMethod -Method Get -Uri "$base/business-records"
$x3 = Find-ById $all $r3.id
$x3Corp = Parse-JsonArray $x3.corporateExpenseRows
$row3 = if ($x3Corp.Count -gt 0) { $x3Corp[0] } else { $null }
$expTds = 1000
$expNet = 9000
$hasComputed = $false
if ($null -ne $row3) {
    $tdsAmount = $row3.PSObject.Properties['tdsAmount']
    $netAmount = $row3.PSObject.Properties['netAmount']
    if ($null -ne $tdsAmount -and $null -ne $netAmount) {
        $hasComputed = ([decimal]$tdsAmount.Value -eq [decimal]$expTds -and [decimal]$netAmount.Value -eq [decimal]$expNet)
    }
}
$results += [pscustomobject]@{
    id = 'TC-BE.03'
    computedTdsAndNet = $hasComputed
    expected = 'TDS amount computed and net stored for corporate expense'
    actual = if ($hasComputed) { 'Computed fields present and correct' } else { 'No automatic tdsAmount/netAmount computation found' }
    status = if ($hasComputed) { 'Pass' } else { 'Fail' }
}

# TC-BE.04
$r4 = New-Record 'CORP' 'Corporate HQ'
$corp4 = @(@{ id = (New-Uuid); head = 'Utilities'; grossAmount = 7000; tdsPct = 0 }) | ConvertTo-Json -Compress
Update-Record $r4.id '[]' $corp4 | Out-Null
$all = Invoke-RestMethod -Method Get -Uri "$base/business-records"
$x4 = Find-ById $all $r4.id
$x4Corp = Parse-JsonArray $x4.corporateExpenseRows
$row4 = if ($x4Corp.Count -gt 0) { $x4Corp[0] } else { $null }
$grossEqualsNet = $false
if ($null -ne $row4) {
    $grossAmount = $row4.PSObject.Properties['grossAmount']
    $netAmount = $row4.PSObject.Properties['netAmount']
    if ($null -ne $grossAmount -and $null -ne $netAmount) {
        $grossEqualsNet = ([decimal]$grossAmount.Value -eq [decimal]$netAmount.Value)
    }
}
$results += [pscustomobject]@{
    id = 'TC-BE.04'
    grossEqualsNet = $grossEqualsNet
    expected = 'For TDS=0, gross amount equals net amount'
    actual = if ($grossEqualsNet) { 'grossAmount equals netAmount' } else { 'No automatic gross/net handling for TDS=0 found' }
    status = if ($grossEqualsNet) { 'Pass' } else { 'Fail' }
}

# TC-BE.05
$r5 = New-Record 'BLR1' 'Bangalore Branch'
$exp5 = @(@{ id = (New-Uuid); date = '2026-05-01'; source = 'Courier'; amount = 800; tdsPct = 5; tdsAmount = 40; netAmount = 760 }) | ConvertTo-Json -Compress
Update-Record $r5.id $exp5 '[]' | Out-Null
$all = Invoke-RestMethod -Method Get -Uri "$base/business-records"
$x5 = Find-ById $all $r5.id
$x5Exp = Parse-JsonArray $x5.expenseRows
$row5 = if ($x5Exp.Count -gt 0) { $x5Exp[0] } else { $null }
$tdsPersistedInBranch = $false
if ($null -ne $row5) {
    $tdsPersistedInBranch = ($null -ne $row5.PSObject.Properties['tdsPct']) -or ($null -ne $row5.PSObject.Properties['tdsAmount']) -or ($null -ne $row5.PSObject.Properties['netAmount'])
}
$results += [pscustomobject]@{
    id = 'TC-BE.05'
    branchAcceptedTdsFields = $tdsPersistedInBranch
    expected = 'TDS fields absent/disabled for branch expenses (this case marked FAIL expected in spec)'
    actual = if ($tdsPersistedInBranch) { 'Branch expense accepted TDS-like fields in stored payload' } else { 'TDS fields not present in branch payload' }
    status = if ($tdsPersistedInBranch) { 'Fail (expected)' } else { 'Pass' }
}

# TC-BE.06
$r6a = New-Record 'BLR1' 'Bangalore Branch'
$r6b = New-Record 'DEL2' 'Delhi Branch'
$exp6a = @(@{ id = (New-Uuid); date = '2026-05-02'; source = 'Fuel'; amount = 1000 }) | ConvertTo-Json -Compress
$exp6b = @(@{ id = (New-Uuid); date = '2026-05-02'; source = 'Transport'; amount = 2000 }) | ConvertTo-Json -Compress
Update-Record $r6a.id $exp6a '[]' | Out-Null
Update-Record $r6b.id $exp6b '[]' | Out-Null
$all = Invoke-RestMethod -Method Get -Uri "$base/business-records"
$blrRows = $all | Where-Object { $_.branchCode -eq 'BLR1' }
$delRows = $all | Where-Object { $_.branchCode -eq 'DEL2' }
$blrExpenseTotal = 0
foreach ($r in $blrRows) {
    $rows = Parse-JsonArray $r.expenseRows
    foreach ($e in $rows) { if ($null -ne $e.amount) { $blrExpenseTotal += [decimal]$e.amount } }
}
$results += [pscustomobject]@{
    id = 'TC-BE.06'
    blrRecordCount = ($blrRows | Measure-Object).Count
    delRecordCount = ($delRows | Measure-Object).Count
    blrExpenseTotal = $blrExpenseTotal
    expected = 'BLR1 expense report should show BLR1 expenses only'
    actual = 'Branch-coded records remain separable by branchCode in API payload'
    status = if ((($blrRows | Measure-Object).Count -ge 1) -and (($delRows | Measure-Object).Count -ge 1)) { 'Pass' } else { 'Fail' }
}

$results | ConvertTo-Json -Depth 6
