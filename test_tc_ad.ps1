$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8091/api/v1/billing'

function New-Uuid { [guid]::NewGuid().Guid }

function Create-Deposit($cid, $branch, $amt) {
    $body = @{ customerId = $cid; branchCode = $branch; amount = [decimal]$amt } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/deposits" -ContentType 'application/json' -Body $body
}

function Create-Invoice($cid, $branch, $total) {
    $remarks = @{
        bc = $branch; tt = 'HALLMARKING'; cid = $cid; cnm = 'AD-API'
        lines = @(@{ id = 'L1'; serviceCode = 'HM_STANDARD'; serviceName = 'HM Standard'; qty = 1; ratePerUnit = [decimal]$total; amount = [decimal]$total })
        sub = [decimal]$total; cgp = 0; sgp = 0; cga = 0; sga = 0
    } | ConvertTo-Json -Compress
    $invBody = @{ invoiceNumber = ''; branchId = (New-Uuid); customerId = $cid; type = 'SALE'; remarks = $remarks } | ConvertTo-Json
    $inv = Invoke-RestMethod -Method Post -Uri "$base/invoices" -ContentType 'application/json' -Body $invBody
    $lineBody = @{ invoiceId = $inv.id; lineNo = 1; itemDesc = 'HM Standard'; grossWeight = 1; ratePerGram = [decimal]$total; makingCharges = 0; discount = 0; taxRatePct = 0 } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/lines" -ContentType 'application/json' -Body $lineBody | Out-Null
    return $inv.id
}

function Confirm-Invoice($id) {
    Invoke-RestMethod -Method Patch -Uri "$base/invoices/$id/status?status=PAID&invoiceNumber=INV-AD-$(Get-Random -Maximum 999999)" | Out-Null
}

function Get-Inv($id) { Invoke-RestMethod -Method Get -Uri "$base/invoices/$id" }

function Get-PaySum($id) {
    $pays = Invoke-RestMethod -Method Get -Uri "$base/invoices/$id/payments"
    $s = ($pays | Measure-Object amount -Sum).Sum
    if (-not $s) { return 0 }
    return $s
}

function Get-Dep($depId) {
    (Invoke-RestMethod -Method Get -Uri "$base/deposits") | Where-Object { $_.id -eq $depId } | Select-Object -First 1
}

$results = @()

# TC-AD.01 – partial consumption: deposit 500, invoice 700 → consume 500, balance 200
$cid = New-Uuid; $d = Create-Deposit $cid 'BLR1' 500; $id = Create-Invoice $cid 'BLR1' 700
Confirm-Invoice $id; $inv = Get-Inv $id; $pay = Get-PaySum $id; $dep = Get-Dep $d.id
$results += [pscustomobject]@{
    id = 'TC-AD.01'; consumed = [decimal]$pay; balance = [decimal]$inv.balanceAmount; depRemaining = [decimal]$dep.remaining
    status = if ($pay -eq 500 -and [decimal]$inv.balanceAmount -eq 200 -and [decimal]$dep.remaining -eq 0) { 'Pass' } else { 'Fail' }
}

# TC-AD.02 – FIFO two deposits: 200+400, invoice 500 → dep1=0, dep2=100
$cid = New-Uuid; $d1 = Create-Deposit $cid 'BLR1' 200; $d2 = Create-Deposit $cid 'BLR1' 400; $id = Create-Invoice $cid 'BLR1' 500
Confirm-Invoice $id; $dep1 = Get-Dep $d1.id; $dep2 = Get-Dep $d2.id
$results += [pscustomobject]@{
    id = 'TC-AD.02'; dep1Remaining = [decimal]$dep1.remaining; dep2Remaining = [decimal]$dep2.remaining
    status = if ([decimal]$dep1.remaining -eq 0 -and [decimal]$dep2.remaining -eq 100) { 'Pass' } else { 'Fail' }
}

# TC-AD.03 – deposit exceeds invoice: deposit 1000, invoice 300 → consume 300, dep=700
$cid = New-Uuid; $d = Create-Deposit $cid 'BLR1' 1000; $id = Create-Invoice $cid 'BLR1' 300
Confirm-Invoice $id; $inv = Get-Inv $id; $pay = Get-PaySum $id; $dep = Get-Dep $d.id
$results += [pscustomobject]@{
    id = 'TC-AD.03'; consumed = [decimal]$pay; balance = [decimal]$inv.balanceAmount; depRemaining = [decimal]$dep.remaining
    status = if ($pay -eq 300 -and [decimal]$inv.balanceAmount -eq 0 -and [decimal]$dep.remaining -eq 700) { 'Pass' } else { 'Fail' }
}

# TC-AD.04 – wrong branch deposit: deposit DEL2, invoice BLR1 → no consumption
$cid = New-Uuid; $d = Create-Deposit $cid 'DEL2' 500; $id = Create-Invoice $cid 'BLR1' 500
Confirm-Invoice $id; $inv = Get-Inv $id; $pay = Get-PaySum $id; $dep = Get-Dep $d.id
$results += [pscustomobject]@{
    id = 'TC-AD.04'; consumed = [decimal]$pay; balance = [decimal]$inv.balanceAmount; del2Remaining = [decimal]$dep.remaining
    status = if ($pay -eq 0 -and [decimal]$inv.balanceAmount -eq 500 -and [decimal]$dep.remaining -eq 500) { 'Pass' } else { 'Fail' }
}

# TC-AD.05 – zero total invoice: deposit 250, invoice 0 → no consumption
$cid = New-Uuid; $d = Create-Deposit $cid 'BLR1' 250; $id = Create-Invoice $cid 'BLR1' 0
Confirm-Invoice $id; $inv = Get-Inv $id; $pay = Get-PaySum $id; $dep = Get-Dep $d.id
$results += [pscustomobject]@{
    id = 'TC-AD.05'; consumed = [decimal]$pay; balance = [decimal]$inv.balanceAmount; depRemaining = [decimal]$dep.remaining
    status = if ($pay -eq 0 -and [decimal]$inv.balanceAmount -eq 0 -and [decimal]$dep.remaining -eq 250) { 'Pass' } else { 'Fail' }
}

# TC-AD.06 – no deposit for customer: invoice 500, no deposit
$cid = New-Uuid; $id = Create-Invoice $cid 'BLR1' 500
Confirm-Invoice $id; $inv = Get-Inv $id; $pay = Get-PaySum $id
$results += [pscustomobject]@{
    id = 'TC-AD.06'; consumed = [decimal]$pay; balance = [decimal]$inv.balanceAmount
    status = if ($pay -eq 0 -and [decimal]$inv.balanceAmount -eq 500) { 'Pass' } else { 'Fail' }
}

# TC-AD.07 – deposit exhausted by earlier invoice: dep 300, pre-inv 300 exhausts it, next inv 400 → no consumption
$cid = New-Uuid; $d = Create-Deposit $cid 'BLR1' 300
$pre = Create-Invoice $cid 'BLR1' 300; Confirm-Invoice $pre
$id = Create-Invoice $cid 'BLR1' 400; Confirm-Invoice $id
$inv = Get-Inv $id; $pay = Get-PaySum $id; $dep = Get-Dep $d.id
$results += [pscustomobject]@{
    id = 'TC-AD.07'; consumed = [decimal]$pay; balance = [decimal]$inv.balanceAmount; depRemaining = [decimal]$dep.remaining
    status = if ($pay -eq 0 -and [decimal]$inv.balanceAmount -eq 400 -and [decimal]$dep.remaining -eq 0) { 'Pass' } else { 'Fail' }
}

$results | ConvertTo-Json -Depth 4
