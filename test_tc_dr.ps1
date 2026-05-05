$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8091/api/v1/billing'

function New-Uuid { [guid]::NewGuid().Guid }
function New-Discount([string]$cid, [string]$branch, [decimal]$amount) {
    $body = @{ customerId = $cid; branchCode = $branch; discountAmount = $amount } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/discounts" -ContentType 'application/json' -Body $body
}
function Submit-Discount([string]$id) {
    Invoke-RestMethod -Method Patch -Uri "$base/discounts/$id/submit"
}
function Approve-Discount([string]$id) {
    Invoke-RestMethod -Method Patch -Uri "$base/discounts/$id/approve"
}
function Try-Invoke([scriptblock]$sb) {
    try {
        $res = & $sb
        return [pscustomobject]@{ ok = $true; result = $res; statusCode = 200; message = '' }
    } catch {
        $code = 0
        $msg = $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $code = [int]$_.Exception.Response.StatusCode
        }
        return [pscustomobject]@{ ok = $false; result = $null; statusCode = $code; message = $msg }
    }
}

$results = @()

# TC-DR.01: New discount should start DRAFT and have auto sequence reference number.
$cid1 = New-Uuid
$d1 = New-Discount $cid1 'BLR1' 100
$hasReferenceField = ($d1.PSObject.Properties.Name -contains 'referenceNo')
$looksLikeSequence = $hasReferenceField -and ($d1.referenceNo -match '^DSC-\d{8}-\d{6}$')
$results += [pscustomobject]@{
    id = 'TC-DR.01'
    observedStatus = $d1.status
    hasReferenceField = $hasReferenceField
    referenceNo = $d1.referenceNo
    expected = 'DRAFT + auto-generated discount reference sequence'
    actual = "status=$($d1.status), referenceNo=$($d1.referenceNo)"
    status = if ($d1.status -eq 'DRAFT' -and $looksLikeSequence) { 'Pass' } else { 'Fail' }
}

# TC-DR.02: Amount within threshold should auto-approve on submit.
$cid2 = New-Uuid
$d2 = New-Discount $cid2 'BLR1' 50
$s2 = Submit-Discount $d2.id
$results += [pscustomobject]@{
    id = 'TC-DR.02'
    submittedStatus = $s2.status
    expected = 'APPROVED (auto)'
    actual = $s2.status
    status = if ($s2.status -eq 'APPROVED') { 'Pass' } else { 'Fail' }
}

# TC-DR.03: Amount above threshold should go to PENDING_APPROVAL on submit.
$cid3 = New-Uuid
$d3 = New-Discount $cid3 'BLR1' 100000
$s3 = Submit-Discount $d3.id
$results += [pscustomobject]@{
    id = 'TC-DR.03'
    submittedStatus = $s3.status
    expected = 'PENDING_APPROVAL'
    actual = $s3.status
    status = if ($s3.status -eq 'PENDING_APPROVAL') { 'Pass' } else { 'Fail' }
}

# TC-DR.04: Approver approves pending discount.
$a4 = Approve-Discount $d3.id
$results += [pscustomobject]@{
    id = 'TC-DR.04'
    approvedStatus = $a4.status
    customerLedgerPosted = $a4.customerLedgerPosted
    branchLedgerPosted = $a4.branchLedgerPosted
    expected = 'APPROVED and applied'
    actual = "status=$($a4.status), customerLedgerPosted=$($a4.customerLedgerPosted), branchLedgerPosted=$($a4.branchLedgerPosted)"
    status = if ($a4.status -eq 'APPROVED' -and $a4.customerLedgerPosted -and $a4.branchLedgerPosted) { 'Pass' } else { 'Fail' }
}

# TC-DR.05: Reject pending discount with reason.
$cid5 = New-Uuid
$d5 = New-Discount $cid5 'BLR1' 99999
$s5 = Submit-Discount $d5.id
$r5 = Try-Invoke { Invoke-RestMethod -Method Patch -Uri "$base/discounts/$($d5.id)/reject" -ContentType 'application/json' -Body (@{ reason = 'Too high' } | ConvertTo-Json) }
$r5Status = if ($r5.ok) { $r5.result.status } else { $null }
$r5Reason = if ($r5.ok) { $r5.result.rejectionReason } else { $null }
$results += [pscustomobject]@{
    id = 'TC-DR.05'
    rejectEndpointWorked = $r5.ok
    rejectedStatus = $r5Status
    rejectionReason = $r5Reason
    expected = 'Rejected state and invoice unchanged'
    actual = if ($r5.ok) { "status=$r5Status, reason=$r5Reason" } else { "Reject endpoint failed: $($r5.message)" }
    status = if ($r5.ok -and $r5Status -eq 'REJECTED' -and $r5Reason -eq 'Too high') { 'Pass' } else { 'Fail' }
}

# TC-DR.06: Rejected discount cannot be approved directly.
$a6 = Try-Invoke { Approve-Discount $d5.id }
$results += [pscustomobject]@{
    id = 'TC-DR.06'
    approveRejectedBlocked = (-not $a6.ok)
    expected = 'Rejected discount cannot be approved directly'
    actual = if ($a6.ok) { 'Approve unexpectedly succeeded' } else { "Blocked as expected: $($a6.message)" }
    status = if (-not $a6.ok) { 'Pass' } else { 'Fail' }
}

# TC-DR.07: Two discounts should have unique sequence references.
$cid7a = New-Uuid
$cid7b = New-Uuid
$d7a = New-Discount $cid7a 'BLR1' 10
$d7b = New-Discount $cid7b 'BLR1' 20
$hasRef7 = ($d7a.PSObject.Properties.Name -contains 'referenceNo')
$uniqueRefs = $hasRef7 -and $d7a.referenceNo -ne $d7b.referenceNo
$results += [pscustomobject]@{
    id = 'TC-DR.07'
    hasReferenceField = $hasRef7
    ref1 = $d7a.referenceNo
    ref2 = $d7b.referenceNo
    expected = 'Unique discount sequence references'
    actual = if ($hasRef7) { "ref1=$($d7a.referenceNo), ref2=$($d7b.referenceNo)" } else { 'No reference field in API response/model' }
    status = if ($uniqueRefs) { 'Pass' } else { 'Fail' }
}

$results | ConvertTo-Json -Depth 5
