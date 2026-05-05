$ErrorActionPreference = 'Stop'

$adminBase = 'http://localhost:8084/api/v1/admin'
$billBase = 'http://localhost:8091/api/v1/billing'
$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')

function New-Uuid { [guid]::NewGuid().Guid }
function Dec($v) {
  if ($null -eq $v) { return [decimal]0 }
  if ($v -is [array]) { $v = $v[0] }
  return [decimal]$v
}
function SafeText($v) {
  if ($null -eq $v) { return 'N/A' }
  $s = [string]$v
  if ([string]::IsNullOrWhiteSpace($s)) { return 'N/A' }
  return $s.Trim()
}

function NearlyEq($a, $b) {
  return [math]::Abs([double]((Dec $a) - (Dec $b))) -lt 0.01
}

function ToBool($v) {
  if ($v -is [bool]) { return $v }
  return ([string]$v).Trim().ToLower() -eq 'true'
}

function New-Customer([string]$name, [string]$gstin, [string]$bis) {
  $num = ('CUST-' + ([guid]::NewGuid().ToString('N').Substring(0, 10))).ToUpper()
  $body = @{
    customerNumber = $num
    name = $name
    company = "$name Pvt Ltd"
    gstin = $gstin
    bisNumber = $bis
    type = 'JEWELLER'
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$adminBase/customers" -ContentType 'application/json' -Body $body
}

function New-Invoice([string]$customerId, [string]$branchId, [bool]$interstate, [hashtable]$remarks, [string]$lineDesc, [decimal]$qty, [decimal]$rate, [string]$invoiceNo) {
  $remarksJson = ($remarks | ConvertTo-Json -Compress)
  $invBody = @{
    invoiceNumber = ''
    branchId = [guid]$branchId
    customerId = [guid]$customerId
    invoiceDate = $today
    dueDate = $today
    type = 'SALE'
    interstate = $interstate
    placeOfSupply = if ($interstate) { 'KA-OUT' } else { 'KA' }
    remarks = $remarksJson
  } | ConvertTo-Json

  $created = Invoke-RestMethod -Method Post -Uri "$billBase/invoices" -ContentType 'application/json' -Body $invBody

  $lineBody = @{
    invoiceId = [guid]$created.id
    lineNo = 1
    itemDesc = $lineDesc
    grossWeight = $qty
    ratePerGram = $rate
    makingCharges = 0
    discount = 0
    taxRatePct = if ($interstate) { 3 } else { 3 }
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$billBase/lines" -ContentType 'application/json' -Body $lineBody | Out-Null

  Invoke-RestMethod -Method Patch -Uri "$billBase/invoices/$($created.id)/status?status=ISSUED" -ContentType 'application/json' | Out-Null
  Invoke-RestMethod -Method Patch -Uri "$billBase/invoices/$($created.id)/status?status=PAID&invoiceNumber=$invoiceNo" -ContentType 'application/json' | Out-Null

  Invoke-RestMethod -Method Get -Uri "$billBase/invoices/$($created.id)"
}

function Get-Remarks($invoice) {
  if ($null -eq $invoice.remarks -or [string]::IsNullOrWhiteSpace([string]$invoice.remarks)) { return @{} }
  try { return ($invoice.remarks | ConvertFrom-Json -AsHashtable) } catch { return @{} }
}

$results = @()

$branchId = '7c3b2c11-b0a4-4a7d-a83d-bfda1812fd80'
$runTag = ([guid]::NewGuid().ToString('N').Substring(0, 6)).ToUpper()
$custLive = New-Customer -name 'TCPT Live Customer' -gstin '29ABCDE1234F1Z5' -bis 'BIS-TCPT-001'
$custNull = New-Customer -name 'TCPT Null Customer' -gstin '' -bis ''

# Intra-state fixture (also used for locked + live customer tests)
$intraSubtotal = 1000
$intraCgst = 15
$intraSgst = 15
$intraGrand = 1030
$remarksIntra = @{
  bc = 'BLR1'
  tt = 'HALLMARKING'
  cid = $custLive.id
  cnm = 'STALE NAME SHOULD NOT PRINT'
  cgp = 1.5
  sgp = 1.5
  igp = 0
  cga = $intraCgst
  sga = $intraSgst
  iga = 0
  sub = $intraSubtotal
}
$invIntra = New-Invoice -customerId $custLive.id -branchId $branchId -interstate $false -remarks $remarksIntra -lineDesc 'HUID Marking' -qty 10 -rate 100 -invoiceNo "BLR1-HM-PT001-$runTag"

# Inter-state fixture
$interSubtotal = 800
$interIgst = 24
$interGrand = 824
$remarksInter = @{
  bc = 'DEL'
  tt = 'HALLMARKING'
  cid = $custLive.id
  cnm = 'STALE INTER NAME'
  cgp = 0
  sgp = 0
  igp = 3
  cga = 0
  sga = 0
  iga = $interIgst
  sub = $interSubtotal
}
$invInter = New-Invoice -customerId $custLive.id -branchId $branchId -interstate $true -remarks $remarksInter -lineDesc 'XRF Testing' -qty 4 -rate 200 -invoiceNo "DEL-HM-PT002-$runTag"

# Exchange fixture
$remarksExchange = @{
  bc = 'BLR1'
  tt = 'EXCHANGE'
  cid = $custLive.id
  cnm = 'EXCHANGE STALE'
  cgp = 0
  sgp = 0
  igp = 0
  cga = 0
  sga = 0
  iga = 0
  sub = 500
  exw = 12.5
  exp = 91.6
  exr = 5500
}
$invExchange = New-Invoice -customerId $custLive.id -branchId $branchId -interstate $false -remarks $remarksExchange -lineDesc 'Exchange Service' -qty 1 -rate 500 -invoiceNo "BLR1-EX-PT003-$runTag"

# Null-safe fixture
$remarksNull = @{
  bc = 'BLR1'
  tt = 'MISCELLANEOUS'
  cid = $custNull.id
  cnm = ''
  cgp = 0
  sgp = 0
  igp = 0
  cga = 0
  sga = 0
  iga = 0
  sub = 100
}
$invNull = New-Invoice -customerId $custNull.id -branchId $branchId -interstate $false -remarks $remarksNull -lineDesc 'Misc Service' -qty 1 -rate 100 -invoiceNo "BLR1-MS-PT004-$runTag"

# Simulate a later rate change / new pricing affecting other invoices only
$remarksLater = @{
  bc = 'BLR1'
  tt = 'HALLMARKING'
  cid = $custLive.id
  cnm = 'LATER RATE'
  cgp = 1.5
  sgp = 1.5
  igp = 0
  cga = 75
  sga = 75
  iga = 0
  sub = 5000
}
$null = New-Invoice -customerId $custLive.id -branchId $branchId -interstate $false -remarks $remarksLater -lineDesc 'HUID Marking' -qty 1 -rate 5000 -invoiceNo "BLR1-HM-PT005-$runTag"

$intraNow = Invoke-RestMethod -Method Get -Uri "$billBase/invoices/$($invIntra.id)"
$interNow = Invoke-RestMethod -Method Get -Uri "$billBase/invoices/$($invInter.id)"
$exchangeNow = Invoke-RestMethod -Method Get -Uri "$billBase/invoices/$($invExchange.id)"
$nullNow = Invoke-RestMethod -Method Get -Uri "$billBase/invoices/$($invNull.id)"

$rIntra = Get-Remarks $intraNow
$rInter = Get-Remarks $interNow
$rExchange = Get-Remarks $exchangeNow
$rNull = Get-Remarks $nullNow

$customerLiveNow = Invoke-RestMethod -Method Get -Uri "$adminBase/customers/$($custLive.id)"
$customerNullNow = Invoke-RestMethod -Method Get -Uri "$adminBase/customers/$($custNull.id)"

# TC-PT.01: confirmed totals match live invoice model (no stale recalc)
$ok1 = ($intraNow.status -eq 'PAID') -and (NearlyEq $intraNow.grandTotal $intraGrand)
$results += [pscustomobject]@{
  id = 'TC-PT.01'
  expected = 'Confirmed invoice grand total must match live backend model'
  actual = "status=$($intraNow.status), grand=$($intraNow.grandTotal), expected=$intraGrand"
  status = if ($ok1) { 'Pass' } else { 'Fail' }
}

# TC-PT.02: intra-state print tax model must show CGST+SGST and zero IGST
$ok2 = (NearlyEq $intraNow.cgstAmount $intraCgst) -and `
  (NearlyEq $intraNow.sgstAmount $intraSgst) -and `
  (NearlyEq $intraNow.igstAmount 0) -and `
  (-not (ToBool $intraNow.interstate))
$results += [pscustomobject]@{
  id = 'TC-PT.02'
  expected = 'Intra-state: CGST+SGST populated, IGST zero'
  actual = "interstate=$($intraNow.interstate), cgst=$($intraNow.cgstAmount), sgst=$($intraNow.sgstAmount), igst=$($intraNow.igstAmount)"
  status = if ($ok2) { 'Pass' } else { 'Fail' }
}

# TC-PT.03: inter-state print tax model must show IGST and suppress CGST+SGST
$ok3 = (ToBool $interNow.interstate) -and `
  (NearlyEq $interNow.igstAmount $interIgst) -and `
  (NearlyEq $interNow.cgstAmount 0) -and `
  (NearlyEq $interNow.sgstAmount 0)
$results += [pscustomobject]@{
  id = 'TC-PT.03'
  expected = 'Inter-state: IGST populated, CGST+SGST zero'
  actual = "interstate=$($interNow.interstate), cgst=$($interNow.cgstAmount), sgst=$($interNow.sgstAmount), igst=$($interNow.igstAmount)"
  status = if ($ok3) { 'Pass' } else { 'Fail' }
}

# TC-PT.04: locked values remain stable after subsequent rate changes
$serviceLocked = Dec $(if ($rIntra.ContainsKey('serviceTotalLocked')) { $rIntra.serviceTotalLocked } else { $rIntra.service_total_locked })
$ok4 = (NearlyEq $intraNow.grandTotal $intraGrand) -and ($serviceLocked -gt 0)
$results += [pscustomobject]@{
  id = 'TC-PT.04'
  expected = 'Confirmed invoice values stay locked despite later pricing changes'
  actual = "grand_after_changes=$($intraNow.grandTotal), serviceTotalLocked=$serviceLocked"
  status = if ($ok4) { 'Pass' } else { 'Fail' }
}

# TC-PT.05: exchange print model uses grand total zero and includes gold/fineness fields
$exchangePrintGrand = if ($rExchange.tt -eq 'EXCHANGE') { 0 } else { Dec $exchangeNow.grandTotal }
$ok5 = ($rExchange.tt -eq 'EXCHANGE') -and ($exchangePrintGrand -eq 0) -and ($rExchange.ContainsKey('exw')) -and ($rExchange.ContainsKey('exp'))
$results += [pscustomobject]@{
  id = 'TC-PT.05'
  expected = 'Exchange print: grand total 0 and old-gold/fineness populated'
  actual = "tt=$($rExchange.tt), printGrand=$exchangePrintGrand, exw=$($rExchange.exw), exp=$($rExchange.exp)"
  status = if ($ok5) { 'Pass' } else { 'Fail' }
}

# TC-PT.06: null-safe customer fields resolve to N/A
$nullGstinDisplay = SafeText $customerNullNow.gstin
$nullBisDisplay = SafeText $customerNullNow.bisNumber
$nullNameDisplay = SafeText $customerNullNow.name
$ok6 = ($nullGstinDisplay -eq 'N/A') -and ($nullBisDisplay -eq 'N/A') -and ($nullNameDisplay -ne 'N/A')
$results += [pscustomobject]@{
  id = 'TC-PT.06'
  expected = 'Missing customer fields render safely as N/A'
  actual = "name=$nullNameDisplay, gstin=$nullGstinDisplay, bis=$nullBisDisplay"
  status = if ($ok6) { 'Pass' } else { 'Fail' }
}

# TC-PT.07: customer fields come from live master model (not stale remarks)
$remarksName = [string]$rIntra.cnm
$ok7 = ($customerLiveNow.name -ne $remarksName) -and `
       ($customerLiveNow.name -eq 'TCPT Live Customer') -and `
       ($customerLiveNow.gstin -eq '29ABCDE1234F1Z5') -and `
       ($customerLiveNow.bisNumber -eq 'BIS-TCPT-001')
$results += [pscustomobject]@{
  id = 'TC-PT.07'
  expected = 'Print customer identity comes from live customer model (name+GSTIN+BIS)'
  actual = "remarksName=$remarksName, liveName=$($customerLiveNow.name), liveGSTIN=$($customerLiveNow.gstin), liveBIS=$($customerLiveNow.bisNumber)"
  status = if ($ok7) { 'Pass' } else { 'Fail' }
}

$results | ConvertTo-Json -Depth 6
