param($Base = 'http://localhost:8087/api/v1/hm')
$H = @{ 'Content-Type' = 'application/json' }
$p = 0; $f = 0

function T($n, [scriptblock]$b) {
    Write-Host "--- $n" -ForegroundColor Cyan
    try { &$b; $script:p++; Write-Host "  PASS" -ForegroundColor Green }
    catch { $script:f++; Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red }
}

# 1. Health
T 'Health UP' {
    $r = Invoke-RestMethod "http://localhost:8087/actuator/health"
    if ($r.status -ne 'UP') { throw "status=$($r.status)" }
    Write-Host "  status=UP db=$($r.components.db.status)"
}

# 2. List jobs
T 'GET /jobs' {
    $list = Invoke-RestMethod "$Base/jobs" -Headers $H
    Write-Host "  existing jobs: $($list.Count)"
}

# 3. Create job with workflowData
$jobId = $null
T 'POST /jobs (with workflowData)' {
    $rnd = Get-Random -Maximum 99999
    $jobNo = "HMR-APITEST-$rnd"
    $wf = @{ localId='api-test'; requestNumber=$jobNo; frontendStatus='DRAFT'; customerName='API Test Co'; material='GOLD'; ahcCenter='AHC-MUM'; lines=@() } | ConvertTo-Json -Compress
    $body = @{
        jobNumber=$jobNo
        branchId='00000000-0000-0000-0000-000000000001'
        jewellerId='00000000-0000-0000-0000-000000000002'
        kind='HUID'; purityLabel='GOLD'; pieceCount=2; grossWeight=7.5
        workflowData=$wf
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST "$Base/jobs" -Headers $H -Body $body
    if (-not $r.id) { throw 'no id in response' }
    $script:jobId = $r.id
    Write-Host "  id=$($r.id) status=$($r.status) workflowData=$(if ($r.workflowData) {'present'} else {'MISSING'})"
}

# 4. PATCH /jobs/{id}
T 'PATCH /jobs/{id} update status + workflowData' {
    $wf2 = @{ localId='api-test'; frontendStatus='AT_QUALITY_MANAGER' } | ConvertTo-Json -Compress
    $body = @{ status='RECEIVED'; workflowData=$wf2 } | ConvertTo-Json
    $r = Invoke-RestMethod -Method PATCH "$Base/jobs/$jobId" -Headers $H -Body $body
    if ($r.status -ne 'RECEIVED') { throw "expected RECEIVED got $($r.status)" }
    if (-not $r.workflowData) { throw 'workflowData missing in response' }
    Write-Host "  status=$($r.status) workflowData=present"
}

# 5. PATCH again — advance to SAMPLED
T 'PATCH /jobs/{id} advance to SAMPLED' {
    $wf3 = @{ localId='api-test'; frontendStatus='SAMPLING' } | ConvertTo-Json -Compress
    $body = @{ status='SAMPLED'; workflowData=$wf3 } | ConvertTo-Json
    $r = Invoke-RestMethod -Method PATCH "$Base/jobs/$jobId" -Headers $H -Body $body
    if ($r.status -ne 'SAMPLED') { throw "expected SAMPLED got $($r.status)" }
    Write-Host "  status=$($r.status)"
}

# 6. Delivery order
$orderId = $null
T 'POST /delivery-orders' {
    $body = @{ customerName='Jewels Ltd'; deliveryType='PICKUP'; remarks='api test' } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST "$Base/delivery-orders" -Headers $H -Body $body
    if (-not $r.id) { throw 'no id' }
    $script:orderId = $r.id
    Write-Host "  id=$($r.id) number=$($r.orderNumber) status=$($r.status)"
}

# 7. GET delivery-orders
T 'GET /delivery-orders' {
    $list = Invoke-RestMethod "$Base/delivery-orders" -Headers $H
    $found = $list | Where-Object { $_.id -eq $orderId }
    if (-not $found) { throw 'order not in list' }
    Write-Host "  total=$($list.Count) found AWAITING_PICKUP order"
}

# 8. Pickup
T 'PATCH /delivery-orders/{id}/pickup → IN_TRANSIT' {
    $body = @{ customerGrossWeight=7.2; customerNetWeight=7.0 } | ConvertTo-Json
    $r = Invoke-RestMethod -Method PATCH "$Base/delivery-orders/$orderId/pickup" -Headers $H -Body $body
    if ($r.status -ne 'IN_TRANSIT') { throw "got $($r.status)" }
    Write-Host "  status=$($r.status) gross=$($r.customerGrossWeight)"
}

# 9. Receive
T 'PATCH /delivery-orders/{id}/receive → RECEIVED' {
    $body = @{ phcQuantity=4; phcGrossWeight=6.9; declaredPurity='22K' } | ConvertTo-Json
    $r = Invoke-RestMethod -Method PATCH "$Base/delivery-orders/$orderId/receive" -Headers $H -Body $body
    if ($r.status -ne 'RECEIVED') { throw "got $($r.status)" }
    Write-Host "  status=$($r.status) phcQty=$($r.phcQuantity)"
}

# 10. Create return
$retId = $null
T 'POST /delivery-orders/returns' {
    $body = @{ customerName='Jewels Ltd'; orderId=$orderId; orderNumber='DO-APITEST'; deliveryDetails='Blue Dart' } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST "$Base/delivery-orders/returns" -Headers $H -Body $body
    if (-not $r.id) { throw 'no id' }
    $script:retId = $r.id
    Write-Host "  id=$($r.id) number=$($r.returnNumber) status=$($r.status)"
}

# 11. GET returns
T 'GET /delivery-orders/returns' {
    $list = Invoke-RestMethod "$Base/delivery-orders/returns" -Headers $H
    if (-not ($list | Where-Object { $_.id -eq $retId })) { throw 'return not in list' }
    Write-Host "  total=$($list.Count)"
}

# 12. Mark return delivered
T 'PATCH /delivery-orders/returns/{id}/deliver → DELIVERED' {
    $r = Invoke-RestMethod -Method PATCH "$Base/delivery-orders/returns/$retId/deliver" -Headers $H
    if ($r.status -ne 'DELIVERED') { throw "got $($r.status)" }
    Write-Host "  status=$($r.status) deliveryDate=$($r.deliveryDate)"
}

# 12b. Cancel a fresh order
T 'PATCH /delivery-orders/{id}/cancel → CANCELLED' {
    $ob2 = @{ customerName='Cancel Test'; deliveryType='DISPATCH' } | ConvertTo-Json
    $o2 = Invoke-RestMethod -Method POST "$Base/delivery-orders" -Headers $H -Body $ob2
    $r = Invoke-RestMethod -Method PATCH "$Base/delivery-orders/$($o2.id)/cancel" -Headers $H
    if ($r.status -ne 'CANCELLED') { throw "got $($r.status)" }
    Write-Host "  status=$($r.status)"
}

# 13. Advance job to MARKED, then dispatch
T 'PATCH job → MARKED + POST /dispatches' {
    Invoke-RestMethod -Method PATCH "$Base/jobs/$jobId/status?status=MARKED" -Headers $H | Out-Null
    $db = @{ jobId=$jobId; receivedByName='Test Officer'; pieceCount=2; grossWeight=7.5 } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST "$Base/dispatches" -Headers $H -Body $db
    if (-not $r.dispatchNo) { throw 'no dispatchNo' }
    Write-Host "  dispatchNo=$($r.dispatchNo)"
}

# 14. GET /jobs/{jobId}/dispatch
T 'GET /jobs/{jobId}/dispatch' {
    $r = Invoke-RestMethod "$Base/jobs/$jobId/dispatch" -Headers $H
    if (-not $r.dispatchNo) { throw 'no dispatchNo returned' }
    Write-Host "  dispatchNo=$($r.dispatchNo) jobId=$($r.jobId)"
}

Write-Host ''
Write-Host ('=' * 50)
Write-Host "  HM API TEST   PASS=$p   FAIL=$f" -ForegroundColor $(if ($f -eq 0) { 'Green' } else { 'Red' })
Write-Host ('=' * 50)
if ($f -gt 0) { exit 1 }
