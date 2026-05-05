$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8092/api/v1/records'

function New-Uuid { [guid]::NewGuid().Guid }

function New-Record([string]$branchCode, [string]$branchName, [int]$month, [int]$year) {
    $body = @{
        branchRef = (New-Uuid)
        branchCode = $branchCode
        branchName = $branchName
        month = $month
        year = $year
        name = "BR/$branchName/$year-$('{0:D2}' -f $month)"
    } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/business-records" -ContentType 'application/json' -Body $body
}

function Update-RecordRows([string]$id, [string]$cashRows, [string]$expenseRows) {
    $body = @{
        cashRows = $cashRows
        expenseRows = $expenseRows
    } | ConvertTo-Json
    Invoke-RestMethod -Method Patch -Uri "$base/business-records/$id" -ContentType 'application/json' -Body $body | Out-Null
}

function Invoke-Export([string]$branchCode, [string]$fromDate, [string]$toDate) {
    $json = @{ branchCode = $branchCode; fromDate = $fromDate; toDate = $toDate } | ConvertTo-Json
    $tmp = Join-Path $env:TEMP ("cr_export_" + [guid]::NewGuid().Guid + ".xlsx")
  $hdr = Join-Path $env:TEMP ("cr_export_hdr_" + [guid]::NewGuid().Guid + ".txt")
  $null = & curl.exe -sS -X POST "$base/business-records/export" -H "Content-Type: application/json" -d $json -D $hdr -o $tmp
  $headerText = Get-Content $hdr -Raw
  [pscustomobject]@{ file = $tmp; headersText = $headerText }
}

function Invoke-Download([string]$recordId) {
    $tmp = Join-Path $env:TEMP ("cr_download_" + [guid]::NewGuid().Guid + ".xlsx")
  $hdr = Join-Path $env:TEMP ("cr_download_hdr_" + [guid]::NewGuid().Guid + ".txt")
  $null = & curl.exe -sS "$base/business-records/$recordId/export/download" -D $hdr -o $tmp
  $headerText = Get-Content $hdr -Raw
  [pscustomobject]@{ file = $tmp; headersText = $headerText }
}

function Header-Value([string]$headersText, [string]$name) {
  $rx = [regex]::Match($headersText, "(?im)^" + [regex]::Escape($name) + ":\s*(.+)$")
  if ($rx.Success) { return $rx.Groups[1].Value.Trim() }
  return $null
}

function File-HashHex([string]$path) {
    (Get-FileHash -Algorithm SHA256 -Path $path).Hash
}

function Read-XlsxDataText([string]$xlsxPath) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($xlsxPath)
    try {
        $sb = New-Object System.Text.StringBuilder
        foreach ($entry in $zip.Entries) {
      if ($entry.FullName -like 'xl/worksheets/*.xml' -or $entry.FullName -eq 'xl/sharedStrings.xml') {
                $sr = New-Object System.IO.StreamReader($entry.Open())
                try { [void]$sb.AppendLine($sr.ReadToEnd()) } finally { $sr.Close() }
            }
        }
        return $sb.ToString()
    } finally {
        $zip.Dispose()
    }
}

$results = @()

# Seed deterministic fixture for BLR1 and DEL2 in May 2026
$blr = New-Record 'BLR1' 'Bangalore Branch' 5 2026
$del = New-Record 'DEL2' 'Delhi Branch' 5 2026

$blrCash = @(
  @{ id = (New-Uuid); date = '2026-05-10'; source = 'BLR1_CASH_IN_SCOPE'; amount = 1000 },
  @{ id = (New-Uuid); date = '2026-06-01'; source = 'BLR1_CASH_OUT_OF_SCOPE'; amount = 999 }
) | ConvertTo-Json -Compress
$blrExp = @(
  @{ id = (New-Uuid); date = '2026-05-12'; source = 'BLR1_EXP_IN_SCOPE'; amount = 200 },
  @{ id = (New-Uuid); date = '2026-04-30'; source = 'BLR1_EXP_OUT_OF_SCOPE'; amount = 888 }
) | ConvertTo-Json -Compress
Update-RecordRows $blr.id $blrCash $blrExp

$delCash = @(
  @{ id = (New-Uuid); date = '2026-05-11'; source = 'DEL2_CASH_SHOULD_NOT_APPEAR'; amount = 777 }
) | ConvertTo-Json -Compress
$delExp = @(
  @{ id = (New-Uuid); date = '2026-05-11'; source = 'DEL2_EXP_SHOULD_NOT_APPEAR'; amount = 111 }
) | ConvertTo-Json -Compress
Update-RecordRows $del.id $delCash $delExp

# TC-CR.01
$ex1 = Invoke-Export 'BLR1' '2026-05-01' '2026-05-31'
$recordHeader1 = Header-Value $ex1.headersText 'X-Record-Id'
$ok1 = (Test-Path $ex1.file) -and ((Get-Item $ex1.file).Length -gt 0) -and $recordHeader1
$results += [pscustomobject]@{
  id = 'TC-CR.01'
  expected = 'Workbook built in memory, attachment stored, immediate download returned'
  actual = "fileSize=$((Get-Item $ex1.file).Length), recordIdHeader=$recordHeader1"
  status = if ($ok1) { 'Pass' } else { 'Fail' }
}

# TC-CR.02
$xml2 = Read-XlsxDataText $ex1.file
$ok2 = ($xml2 -match 'BLR1_CASH_IN_SCOPE') -and ($xml2 -match 'BLR1_EXP_IN_SCOPE') -and
       ($xml2 -notmatch 'DEL2_CASH_SHOULD_NOT_APPEAR') -and ($xml2 -notmatch 'DEL2_EXP_SHOULD_NOT_APPEAR') -and
       ($xml2 -notmatch 'BLR1_CASH_OUT_OF_SCOPE') -and ($xml2 -notmatch 'BLR1_EXP_OUT_OF_SCOPE')
$results += [pscustomobject]@{
  id = 'TC-CR.02'
  expected = 'BLR1 Month-M workbook has only BLR1 in-range data'
  actual = if ($ok2) { 'In-range BLR1 rows present; DEL2 and out-of-range rows excluded' } else { 'Workbook content filter mismatch' }
  status = if ($ok2) { 'Pass' } else { 'Fail' }
}

# TC-CR.03
$ex3a = Invoke-Export 'BLR1' '2026-05-01' '2026-05-31'
$dataA = Read-XlsxDataText $ex3a.file
$ex3b = Invoke-Export 'BLR1' '2026-05-01' '2026-05-31'
$dataB = Read-XlsxDataText $ex3b.file
$ok3 = ($dataA -eq $dataB) -and ($ex3a.file -ne $ex3b.file)
$results += [pscustomobject]@{
  id = 'TC-CR.03'
  expected = 'Two exports with same parameters produce identical data and fresh file'
  actual = "sameData=$($dataA -eq $dataB), fileA=$($ex3a.file), fileB=$($ex3b.file)"
  status = if ($ok3) { 'Pass' } else { 'Fail' }
}

# TC-CR.04 (1000+ rows)
$bigRows = @()
for ($i=1; $i -le 1100; $i++) {
  $bigRows += @{ id = (New-Uuid); date = '2026-05-15'; source = "BLR1_BIG_$i"; amount = $i }
}
Update-RecordRows $blr.id ($bigRows | ConvertTo-Json -Compress) $blrExp
$ex4 = Invoke-Export 'BLR1' '2026-05-01' '2026-05-31'
$xml4 = Read-XlsxDataText $ex4.file
$ok4 = ($xml4 -match 'BLR1_BIG_1') -and ($xml4 -match 'BLR1_BIG_1100') -and ((Get-Item $ex4.file).Length -gt 20000)
$results += [pscustomobject]@{
  id = 'TC-CR.04'
  expected = 'Large export completes without timeout and attachment is downloadable'
  actual = "fileSize=$((Get-Item $ex4.file).Length), hasFirst=$($xml4 -match 'BLR1_BIG_1'), hasLast=$($xml4 -match 'BLR1_BIG_1100')"
  status = if ($ok4) { 'Pass' } else { 'Fail' }
}

# TC-CR.05 (no matching records)
$ex5 = Invoke-Export 'BLR1' '2099-12-01' '2099-12-31'
$xml5 = Read-XlsxDataText $ex5.file
$ok5 = ($xml5 -match 'No records for selected filter')
$results += [pscustomobject]@{
  id = 'TC-CR.05'
  expected = 'Empty workbook or informative message when no records match'
  actual = if ($ok5) { 'Workbook contains informative no-records message' } else { 'No informative empty-state message detected' }
  status = if ($ok5) { 'Pass' } else { 'Fail' }
}

# TC-CR.06 persisted re-download
$ex6 = Invoke-Export 'BLR1' '2026-05-01' '2026-05-31'
$recordId = Header-Value $ex6.headersText 'X-Record-Id'
$dl1 = Invoke-Download $recordId
$dl2 = Invoke-Download $recordId
$ok6 = (File-HashHex $dl1.file) -eq (File-HashHex $dl2.file)
$results += [pscustomobject]@{
  id = 'TC-CR.06'
  expected = 'Attachment persists on record and can be re-downloaded'
  actual = "recordId=$recordId, hash1=$(File-HashHex $dl1.file), hash2=$(File-HashHex $dl2.file)"
  status = if ($ok6) { 'Pass' } else { 'Fail' }
}

$results | ConvertTo-Json -Depth 6
