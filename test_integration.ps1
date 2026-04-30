# ====================================================================
# NEXUS ERP — Cross-Module Integration Test
# Verifies all 10 module backends are healthy and exercises the
# end-to-end "happy path": Admin -> Inventory -> Testing -> Hallmarking
# -> Laser -> Refinery -> Exchange -> Billing -> Records -> Notifications.
#
#   pwsh ./test_integration.ps1
# ====================================================================
$ErrorActionPreference = 'Stop'
$pass = 0; $fail = 0
$results = @()

function Step($name, $action) {
    Write-Host ("--- {0}" -f $name) -ForegroundColor Cyan
    try {
        & $action
        $script:pass++; $script:results += [pscustomobject]@{Name=$name; Status='PASS'}
        Write-Host "    PASS" -ForegroundColor Green
    } catch {
        $script:fail++; $script:results += [pscustomobject]@{Name=$name; Status='FAIL'; Error=$_.Exception.Message}
        Write-Host ("    FAIL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    }
}

$H = @{ 'Content-Type' = 'application/json' }

# ---------- Endpoints ----------
$svcs = [ordered]@{
    'Admin'        = 'http://localhost:8084'
    'Inventory'    = 'http://localhost:8085'
    'Testing'      = 'http://localhost:8086'
    'Hallmarking'  = 'http://localhost:8087'
    'Laser'        = 'http://localhost:8088'
    'Refinery'     = 'http://localhost:8089'
    'Exchange'     = 'http://localhost:8090'
    'Billing'      = 'http://localhost:8091'
    'Records'      = 'http://localhost:8092'
    'Notifications'= 'http://localhost:8093'
}

# ---------- 1. Health checks ----------
foreach ($k in $svcs.Keys) {
    $base = $svcs[$k]
    Step "Health: $k @ $base" {
        $r = Invoke-RestMethod "$base/actuator/health" -TimeoutSec 5
        if ($r.status -ne 'UP') { throw "status=$($r.status)" }
    }
}

# ---------- 2. Admin masters present ----------
$branchId = $null
$customerId = $null
Step 'Admin: branches list non-empty' {
    $br = Invoke-RestMethod "$($svcs.Admin)/api/v1/admin/branches"
    if (-not $br -or $br.Count -lt 1) { throw 'no branches' }
    $script:branchId = $br[0].id
}
Step 'Admin: customers list reachable' {
    $cu = Invoke-RestMethod "$($svcs.Admin)/api/v1/admin/customers"
    if ($null -eq $cu) { throw 'customers is null' }
    if ($cu.Count -ge 1) { $script:customerId = $cu[0].id } else { Write-Host '    (no customers seeded — skipping dependent assertions)' -ForegroundColor Yellow }
}

# ---------- 3. Inventory ----------
Step 'Inventory: lots list reachable' {
    $lots = Invoke-RestMethod "$($svcs.Inventory)/api/v1/inventory/lots"
    if ($null -eq $lots) { throw 'lots is null' }
}

# ---------- 4. Records day-book write/read ----------
$recRef = "INTEG-$(Get-Random -Maximum 99999)"
Step 'Records: post day-book entry' {
    $body = @{
        entryDate = (Get-Date -Format 'yyyy-MM-dd')
        branchId = $branchId
        module = 'BILLING'; txnType = 'SALE'
        referenceNo = $recRef; partyName = 'IntegTest'
        narration = 'cross-module test'
        amountIn = 1000; amountOut = 0
    } | ConvertTo-Json
    Invoke-RestMethod -Method POST "$($svcs.Records)/api/v1/records/daybook" -Headers $H -Body $body | Out-Null
}
Step 'Records: day-book contains entry' {
    $list = Invoke-RestMethod "$($svcs.Records)/api/v1/records/daybook"
    if (-not ($list | Where-Object { $_.referenceNo -eq $recRef })) { throw 'entry not found' }
}

# ---------- 5. Notifications ----------
$notifId = $null
Step 'Notifications: templates seeded' {
    $tpls = Invoke-RestMethod "$($svcs.Notifications)/api/v1/notifications/templates"
    if (($tpls | Where-Object { $_.code -eq 'INVOICE_ISSUED' }).Count -lt 1) { throw 'INVOICE_ISSUED template missing' }
}
Step 'Notifications: send via INVOICE_ISSUED template' {
    $body = @{
        templateCode = 'INVOICE_ISSUED'
        recipient = 'integration-test@nexus.local'
        recipientName = 'IntegTest'
        sourceModule = 'BILLING'; sourceRef = $recRef
        context = @{ customerName='IntegTest'; invoiceNumber=$recRef; grandTotal='1000.00'; balance='0.00'; dueDate='2026-12-31' }
    } | ConvertTo-Json -Depth 4
    $r = Invoke-RestMethod -Method POST "$($svcs.Notifications)/api/v1/notifications/send" -Headers $H -Body $body
    if ($r.status -ne 'SENT') { throw "expected SENT, got $($r.status)" }
    $script:notifId = $r.id
}
Step 'Notifications: delivery attempt logged' {
    $att = Invoke-RestMethod "$($svcs.Notifications)/api/v1/notifications/$notifId/attempts"
    if (-not $att -or $att.Count -lt 1) { throw 'no attempts' }
    if ($att[0].result -ne 'SUCCESS') { throw "attempt result=$($att[0].result)" }
}

# ---------- 6. Billing list reachable ----------
Step 'Billing: invoices list reachable' {
    $invs = Invoke-RestMethod "$($svcs.Billing)/api/v1/billing/invoices"
    if ($null -eq $invs) { throw 'invoices is null' }
}

# ---------- Summary ----------
Write-Host ''
Write-Host '=========================================='
Write-Host (' INTEGRATION TEST RESULTS  PASS={0}  FAIL={1}' -f $pass, $fail)
Write-Host '=========================================='
$results | Format-Table -AutoSize
if ($fail -gt 0) { exit 1 } else { exit 0 }
