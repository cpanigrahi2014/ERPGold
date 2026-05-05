package com.nexus.billing.application.service;

import com.nexus.billing.application.dto.BillingDtos.*;
import com.nexus.billing.application.support.CurrentContext;
import com.nexus.billing.application.support.DiscountApprovalProperties;
import com.nexus.billing.domain.model.*;
import com.nexus.billing.domain.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class BillingService {

    private final InvoiceRepository               invoices;
    private final InvoiceLineRepository           lines;
    private final PaymentRepository               payments;
    private final CustomerDepositRepository       deposits;
    private final BillingExchangeRecordRepository exchanges;
    private final BillingPaymentRegisterRepository paymentRegisters;
    private final BillingScrapLogRepository       scrapLogs;
    private final BillingDiscountRepository       discounts;
    private final BillingScrapMonthlyValidationRepository scrapMonthlyValidations;
    private final DiscountApprovalProperties      discountApprovalProperties;
    private final JdbcTemplate                    jdbcTemplate;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final BigDecimal HUNDRED  = new BigDecimal("100");
    private static final BigDecimal THOUSAND = new BigDecimal("1000");
    private static final BigDecimal TWO      = new BigDecimal("2");
    private static final ObjectMapper OM = new ObjectMapper();

    // ---------- Invoices ----------
    @Transactional
    public InvoiceResponse createInvoice(InvoiceRequest r) {
        Invoice inv = Invoice.builder()
            .invoiceNumber(r.invoiceNumber() == null || r.invoiceNumber().isBlank()
                ? "INV-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.invoiceNumber())
            .branchId(r.branchId()).customerId(r.customerId())
            .invoiceDate(r.invoiceDate() == null ? LocalDate.now() : r.invoiceDate())
            .dueDate(r.dueDate())
            .type(r.type() == null ? Invoice.InvoiceType.SALE : r.type())
            .placeOfSupply(r.placeOfSupply())
            .interstate(r.interstate() != null && r.interstate())
            .remarks(r.remarks())
            .build();
        stamp(inv);
        return toInvoice(invoices.save(inv));
    }

    public List<InvoiceResponse> listInvoices(Invoice.Status status, UUID customerId) {
        UUID t = ctx.tenantId();
        List<Invoice> list;
        if (customerId != null) list = invoices.findByTenantIdAndCustomerIdOrderByInvoiceDateDesc(t, customerId);
        else if (status != null) list = invoices.findByTenantIdAndStatusOrderByInvoiceDateDesc(t, status);
        else list = invoices.findByTenantIdOrderByInvoiceDateDesc(t);
        return list.stream().map(this::toInvoice).toList();
    }

    public InvoiceResponse getInvoice(UUID id) {
        return toInvoice(invoices.findById(id).orElseThrow(() -> new EntityNotFoundException("Invoice not found")));
    }

    @Transactional
    public InvoiceResponse updateStatus(UUID id, Invoice.Status status, String invoiceNumber) {
        Invoice inv = invoices.findById(id).orElseThrow(() -> new EntityNotFoundException("Invoice not found"));
        inv.setStatus(status);
        if (invoiceNumber != null && !invoiceNumber.isBlank()) {
            inv.setInvoiceNumber(invoiceNumber);
        }
        if (status == Invoice.Status.PAID || status == Invoice.Status.PARTIALLY_PAID) {
            inv.setRemarks(withLockedAmounts(inv));
            // FIFO deposit auto-consumption
            String branchCode = extractBranchCode(inv.getRemarks());
            if (branchCode != null && inv.getCustomerId() != null
                    && inv.getGrandTotal() != null && inv.getGrandTotal().signum() > 0) {
                String custIdStr = inv.getCustomerId().toString();
                BigDecimal alreadyPaid = inv.getPaidAmount() != null ? inv.getPaidAmount() : BigDecimal.ZERO;
                BigDecimal balance = inv.getGrandTotal().subtract(alreadyPaid);
                if (balance.signum() > 0) {
                    List<CustomerDeposit> deps = deposits.findByTenantIdAndCustomerIdAndBranchCodeOrderByCreatedAtAsc(
                            inv.getTenantId(), custIdStr, branchCode);
                    BigDecimal totalConsumed = BigDecimal.ZERO;
                    for (CustomerDeposit dep : deps) {
                        if (balance.signum() <= 0) break;
                        BigDecimal avail = dep.getRemaining();
                        if (avail == null || avail.signum() <= 0) continue;
                        BigDecimal consume = avail.min(balance);
                        dep.setRemaining(avail.subtract(consume));
                        deposits.save(dep);
                        balance = balance.subtract(consume);
                        totalConsumed = totalConsumed.add(consume);
                    }
                    if (totalConsumed.signum() > 0) {
                        Payment p = Payment.builder()
                                .invoiceId(inv.getId())
                                .paymentDate(LocalDate.now())
                                .amount(totalConsumed)
                                .method(Payment.Method.ADJUSTMENT)
                                .referenceNo("ADVANCE")
                                .build();
                        stamp(p);
                        payments.save(p);
                        recompute(inv);
                    }
                }
            }
        }
        inv.setUpdatedBy(ctx.userId());
        return toInvoice(invoices.save(inv));
    }

    // ---------- Lines ----------
    @Transactional
    public LineResponse addLine(LineRequest r) {
        Invoice inv = invoices.findById(r.invoiceId()).orElseThrow(() -> new EntityNotFoundException("Invoice not found"));
        if (inv.getStatus() != Invoice.Status.DRAFT) throw new IllegalStateException("Cannot modify lines on a " + inv.getStatus() + " invoice");

        BigDecimal pure       = (r.fineness() != null) ? r.grossWeight().multiply(r.fineness()).divide(THOUSAND, 4, RoundingMode.HALF_UP) : null;
        BigDecimal rate       = r.ratePerGram() == null ? BigDecimal.ZERO : r.ratePerGram();
        BigDecimal metalValue = r.grossWeight().multiply(rate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal making     = r.makingCharges() == null ? BigDecimal.ZERO : r.makingCharges();
        BigDecimal discount   = r.discount() == null ? BigDecimal.ZERO : r.discount();
        BigDecimal taxable    = metalValue.add(making).subtract(discount);
        BigDecimal taxPct     = r.taxRatePct() == null ? new BigDecimal("3") : r.taxRatePct(); // GST default 3% jewellery
        BigDecimal totalTax   = taxable.multiply(taxPct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal cgst = BigDecimal.ZERO, sgst = BigDecimal.ZERO, igst = BigDecimal.ZERO;
        if (Boolean.TRUE.equals(inv.getInterstate())) igst = totalTax;
        else { cgst = totalTax.divide(TWO, 2, RoundingMode.HALF_UP); sgst = totalTax.subtract(cgst); }
        BigDecimal lineTotal = taxable.add(totalTax);

        int next = (r.lineNo() != null) ? r.lineNo() : (lines.findByInvoiceIdOrderByLineNoAsc(r.invoiceId()).size() + 1);
        InvoiceLine ln = InvoiceLine.builder()
            .invoiceId(r.invoiceId()).lineNo(next)
            .itemDesc(r.itemDesc()).hsnCode(r.hsnCode())
            .lotId(r.lotId()).productId(r.productId())
            .grossWeight(r.grossWeight()).fineness(r.fineness()).pureWeight(pure)
            .ratePerGram(rate).metalValue(metalValue)
            .makingCharges(making).discount(discount)
            .taxableAmount(taxable).taxRatePct(taxPct)
            .cgstAmount(cgst).sgstAmount(sgst).igstAmount(igst)
            .lineTotal(lineTotal)
            .build();
        stamp(ln);
        InvoiceLine saved = lines.save(ln);
        recompute(inv);
        inv.setUpdatedBy(ctx.userId()); invoices.save(inv);
        return toLine(saved);
    }

    public List<LineResponse> listLines(UUID invoiceId) {
        return lines.findByInvoiceIdOrderByLineNoAsc(invoiceId).stream().map(this::toLine).toList();
    }

    // ---------- Payments ----------
    @Transactional
    public PaymentResponse addPayment(PaymentRequest r) {
        Invoice inv = invoices.findById(r.invoiceId()).orElseThrow(() -> new EntityNotFoundException("Invoice not found"));
        if (inv.getStatus() == Invoice.Status.DRAFT || inv.getStatus() == Invoice.Status.CANCELLED) {
            throw new IllegalStateException("Cannot record payment on a " + inv.getStatus() + " invoice");
        }
        Payment p = Payment.builder()
            .invoiceId(r.invoiceId())
            .paymentDate(r.paymentDate() == null ? LocalDate.now() : r.paymentDate())
            .amount(r.amount())
            .method(r.method() == null ? Payment.Method.CASH : r.method())
            .referenceNo(r.referenceNo()).remarks(r.remarks())
            .build();
        stamp(p);
        Payment saved = payments.save(p);
        recompute(inv);
        inv.setUpdatedBy(ctx.userId()); invoices.save(inv);
        return toPayment(saved);
    }

    public List<PaymentResponse> listPayments(UUID invoiceId) {
        return payments.findByInvoiceIdOrderByPaymentDateAsc(invoiceId).stream().map(this::toPayment).toList();
    }

    // ---------- Billing desk extensions ----------
    @Transactional
    public DepositResponse createDeposit(DepositRequest r) {
        CustomerDeposit d = CustomerDeposit.builder()
            .customerId(r.customerId().trim())
            .branchCode(r.branchCode().trim().toUpperCase())
            .amount(r.amount())
            .remaining(r.amount())
            .build();
        stamp(d);
        return toDeposit(deposits.saveAndFlush(d));
    }

    public List<DepositResponse> listDeposits() {
        return deposits.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()).stream().map(this::toDeposit).toList();
    }

    @Transactional
    public ExchangeResponse createExchange(ExchangeRequest r) {
        BillingExchangeRecord ex = BillingExchangeRecord.builder()
            .customerId(r.customerId().trim())
            .branchCode(r.branchCode().trim().toUpperCase())
            .goldGrams(r.goldGrams())
            .purity(r.purity())
            .cashComponent(r.cashComponent() == null ? BigDecimal.ZERO : r.cashComponent())
            .grandTotal(BigDecimal.ZERO)
            .build();
        stamp(ex);
        return toExchange(exchanges.saveAndFlush(ex));
    }

    public List<ExchangeResponse> listExchanges() {
        return exchanges.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()).stream().map(this::toExchange).toList();
    }

    @Transactional
    public PaymentRegisterResponse createPaymentRegister(PaymentRegisterRequest r) {
        BigDecimal grams = r.goldGrams() == null ? BigDecimal.ZERO : r.goldGrams();
        BigDecimal purity = r.purity() == null ? BigDecimal.ZERO : r.purity();
        BillingPaymentRegister p = BillingPaymentRegister.builder()
            .customerId(r.customerId().trim())
            .branchCode(r.branchCode().trim().toUpperCase())
            .amount(r.amount())
            .tender(r.tender().trim().toLowerCase())
            .goldGrams(grams)
            .purity(purity)
            .build();
        stamp(p);
        BillingPaymentRegister saved = paymentRegisters.saveAndFlush(p);
        if ("gold_physical".equals(saved.getTender()) && grams.signum() > 0 && purity.signum() > 0) {
            BigDecimal pure = grams.multiply(purity).divide(HUNDRED, 3, RoundingMode.HALF_UP);
            BillingScrapLog s = BillingScrapLog.builder()
                .linkedPaymentId(saved.getId())
                .customerId(saved.getCustomerId())
                .branchCode(saved.getBranchCode())
                .goldGrams(grams)
                .purity(purity)
                .pureGold(pure)
                .build();
            stamp(s);
            scrapLogs.save(s);
        }
        return toPaymentRegister(saved);
    }

    public List<PaymentRegisterResponse> listPaymentRegister() {
        return paymentRegisters.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()).stream().map(this::toPaymentRegister).toList();
    }

    public List<ScrapLogResponse> listScrapLog() {
        return scrapLogs.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()).stream().map(this::toScrapLog).toList();
    }

    @Transactional
    public DiscountResponse createDiscount(DiscountRequest r) {
        BillingDiscount d = BillingDiscount.builder()
            .referenceNo(nextDiscountReference())
            .customerId(r.customerId().trim())
            .branchCode(r.branchCode().trim().toUpperCase())
            .discountAmount(r.discountAmount())
            .status(BillingDiscount.Status.DRAFT)
            .customerLedgerPosted(false)
            .branchLedgerPosted(false)
            .rejectionReason(null)
            .build();
        stamp(d);
        return toDiscount(discounts.saveAndFlush(d));
    }

    public List<DiscountResponse> listDiscounts() {
        return discounts.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()).stream().map(this::toDiscount).toList();
    }

    @Transactional
    public DiscountResponse submitDiscount(UUID id) {
        BillingDiscount d = discounts.findById(id).orElseThrow(() -> new EntityNotFoundException("Discount not found"));
        if (d.getStatus() != BillingDiscount.Status.DRAFT) throw new IllegalStateException("Only DRAFT discount can be submitted");
        BigDecimal threshold = approvalThresholdForBranch(d.getBranchCode());
        if (d.getDiscountAmount().compareTo(threshold) <= 0) {
            d.setStatus(BillingDiscount.Status.APPROVED);
            d.setCustomerLedgerPosted(true);
            d.setBranchLedgerPosted(true);
            d.setApprovedAt(Instant.now());
            d.setRejectionReason(null);
        } else {
            d.setStatus(BillingDiscount.Status.PENDING_APPROVAL);
        }
        d.setUpdatedBy(ctx.userId());
        return toDiscount(discounts.save(d));
    }

    @Transactional
    public DiscountResponse approveDiscount(UUID id) {
        BillingDiscount d = discounts.findById(id).orElseThrow(() -> new EntityNotFoundException("Discount not found"));
        if (d.getStatus() != BillingDiscount.Status.PENDING_APPROVAL) throw new IllegalStateException("Only PENDING_APPROVAL discount can be approved");
        d.setStatus(BillingDiscount.Status.APPROVED);
        d.setCustomerLedgerPosted(true);
        d.setBranchLedgerPosted(true);
        d.setApprovedAt(Instant.now());
        d.setRejectionReason(null);
        d.setUpdatedBy(ctx.userId());
        return toDiscount(discounts.save(d));
    }

    @Transactional
    public DiscountResponse rejectDiscount(UUID id, String reason) {
        BillingDiscount d = discounts.findById(id).orElseThrow(() -> new EntityNotFoundException("Discount not found"));
        if (d.getStatus() != BillingDiscount.Status.PENDING_APPROVAL) throw new IllegalStateException("Only PENDING_APPROVAL discount can be rejected");
        d.setStatus(BillingDiscount.Status.REJECTED);
        d.setRejectionReason(reason == null ? null : reason.trim());
        d.setUpdatedBy(ctx.userId());
        return toDiscount(discounts.save(d));
    }

    public ScrapReportResponse scrapReport() {
        return toScrapReport(
            exchanges.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()),
            scrapLogs.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId())
        );
    }

    public DailyScrapReportResponse dailyScrapReport(LocalDate date) {
        Instant from = date.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant to = date.plusDays(1).atStartOfDay().minusNanos(1).toInstant(ZoneOffset.UTC);
        List<BillingScrapLog> logs = scrapLogs.findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(ctx.tenantId(), from, to);
        BigDecimal totalGrams = logs.stream().map(BillingScrapLog::getGoldGrams).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPure = logs.stream().map(BillingScrapLog::getPureGold).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(3, RoundingMode.HALF_UP);
        BigDecimal wt = totalGrams.signum() == 0 ? BigDecimal.ZERO : logs.stream()
            .map(r -> r.getGoldGrams().multiply(r.getPurity()))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(totalGrams, 2, RoundingMode.HALF_UP);
        List<DailyScrapEntryResponse> entries = logs.stream()
            .map(l -> new DailyScrapEntryResponse(l.getId(), l.getLinkedPaymentId(), l.getCustomerId(), l.getBranchCode(), l.getGoldGrams(), l.getPurity(), l.getPureGold(), l.getCreatedAt().toString()))
            .toList();
        return new DailyScrapReportResponse(date.toString(), entries, totalGrams, totalPure, wt);
    }

    @Transactional
    public MonthlyScrapValidationResponse createMonthlyScrapValidation(MonthlyScrapValidationRequest r) {
        YearMonth ym = YearMonth.of(r.year(), r.month());
        Instant from = ym.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant to = ym.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1).toInstant(ZoneOffset.UTC);
        List<BillingExchangeRecord> ex = exchanges.findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(ctx.tenantId(), from, to);
        List<BillingScrapLog> logs = scrapLogs.findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(ctx.tenantId(), from, to);
        ScrapReportResponse rep = toScrapReport(ex, logs);

        BillingScrapMonthlyValidation rec = scrapMonthlyValidations
            .findByTenantIdAndYearAndMonth(ctx.tenantId(), r.year(), r.month())
            .orElseGet(() -> {
                BillingScrapMonthlyValidation v = new BillingScrapMonthlyValidation();
                v.setYear(r.year());
                v.setMonth(r.month());
                stamp(v);
                return v;
            });

        rec.setExpectedPureGold(rep.expectedPureGold());
        rec.setActualPureGold(rep.actualPureGold());
        rec.setVariance(rep.variance());
        rec.setWtAvgPurityExpected(rep.wtAvgPurityExpected());
        rec.setWtAvgPurityActual(rep.wtAvgPurityActual());
        rec.setDiscrepancyFlag(rep.variance().signum() != 0);
        rec.setUpdatedBy(ctx.userId());

        return toMonthlyValidation(scrapMonthlyValidations.saveAndFlush(rec));
    }

    public List<MonthlyScrapValidationResponse> listMonthlyScrapValidations(Integer year, Integer month) {
        UUID t = ctx.tenantId();
        List<BillingScrapMonthlyValidation> rows = (year != null && month != null)
            ? scrapMonthlyValidations.findByTenantIdAndYearAndMonthOrderByCreatedAtDesc(t, year, month)
            : scrapMonthlyValidations.findByTenantIdOrderByCreatedAtDesc(t);
        return rows.stream().map(this::toMonthlyValidation).toList();
    }

    // ---------- Report Wizard (all transient — no writes) ----------

    public ServiceMixReportResponse serviceMixReport(LocalDate from, LocalDate to) {
        List<Invoice> invList = invoices.findByTenantIdAndInvoiceDateBetweenOrderByInvoiceDateAsc(
            ctx.tenantId(), from, to);
        Map<String, BigDecimal> totals = new java.util.LinkedHashMap<>();
        Map<String, Integer> counts = new java.util.LinkedHashMap<>();
        for (String t2 : List.of("HALLMARKING", "XRF TESTING", "FIRE ASSAY", "OTHER")) {
            totals.put(t2, BigDecimal.ZERO); counts.put(t2, 0);
        }
        BigDecimal grand = BigDecimal.ZERO;
        for (Invoice inv : invList) {
            if (inv.getGrandTotal() == null) continue;
            grand = grand.add(inv.getGrandTotal());
            BigDecimal huid = nvl(lockedAmount(inv.getRemarks(), "huid_amount_locked", "huidAmountLocked"));
            BigDecimal xrf  = nvl(lockedAmount(inv.getRemarks(), "xrf_amount_locked", "xrfAmountLocked"));
            BigDecimal fire = nvl(lockedAmount(inv.getRemarks(), "fire_assay_amount_locked", "fireAssayAmountLocked"));
            BigDecimal other = inv.getGrandTotal().subtract(huid).subtract(xrf).subtract(fire);
            if (other.signum() < 0) other = BigDecimal.ZERO;
            if (huid.signum() > 0) { totals.merge("HALLMARKING", huid, BigDecimal::add); counts.merge("HALLMARKING", 1, Integer::sum); }
            if (xrf.signum() > 0)  { totals.merge("XRF TESTING", xrf, BigDecimal::add);  counts.merge("XRF TESTING",  1, Integer::sum); }
            if (fire.signum() > 0) { totals.merge("FIRE ASSAY", fire, BigDecimal::add);   counts.merge("FIRE ASSAY",   1, Integer::sum); }
            if (other.signum() > 0){ totals.merge("OTHER", other, BigDecimal::add);       counts.merge("OTHER",        1, Integer::sum); }
        }
        List<ServiceMixLine> lines = totals.entrySet().stream()
            .filter(e -> e.getValue().signum() > 0)
            .map(e -> new ServiceMixLine(e.getKey(), counts.get(e.getKey()), e.getValue().setScale(2, RoundingMode.HALF_UP)))
            .toList();
        return new ServiceMixReportResponse(from.toString(), to.toString(), lines,
            grand.setScale(2, RoundingMode.HALF_UP), Instant.now().toString());
    }

    public CustomerLedgerReportResponse customerLedgerReport(String customerId, LocalDate from, LocalDate to) {
        // Try to parse as UUID first, fall back to string match
        List<Invoice> invList;
        try {
            UUID custUuid = UUID.fromString(customerId);
            invList = invoices.findByTenantIdAndCustomerIdAndInvoiceDateBetweenOrderByInvoiceDateAsc(
                ctx.tenantId(), custUuid, from, to);
        } catch (IllegalArgumentException e) {
            invList = invoices.findByTenantIdAndInvoiceDateBetweenOrderByInvoiceDateAsc(ctx.tenantId(), from, to)
                .stream().filter(i -> customerId.equals(i.getCustomerId().toString())).toList();
        }
        List<UUID> invoiceIds = invList.stream().map(Invoice::getId).toList();
        Map<UUID, List<Payment>> payMap = new java.util.HashMap<>();
        if (!invoiceIds.isEmpty()) {
            payments.findByInvoiceIdInOrderByPaymentDateAsc(invoiceIds)
                .forEach(p -> payMap.computeIfAbsent(p.getInvoiceId(), k -> new java.util.ArrayList<>()).add(p));
        }
        List<CustomerLedgerEntry> entries = new java.util.ArrayList<>();
        BigDecimal balance = BigDecimal.ZERO;
        for (Invoice inv : invList) {
            BigDecimal amt = nvl(inv.getGrandTotal());
            balance = balance.add(amt);
            entries.add(new CustomerLedgerEntry(
                inv.getInvoiceDate().toString(), "INVOICE", inv.getInvoiceNumber(),
                amt, BigDecimal.ZERO, balance.setScale(2, RoundingMode.HALF_UP)));
            List<Payment> pays = payMap.getOrDefault(inv.getId(), List.of());
            for (Payment p : pays) {
                balance = balance.subtract(p.getAmount());
                entries.add(new CustomerLedgerEntry(
                    p.getPaymentDate().toString(), "PAYMENT", p.getReferenceNo() == null ? "" : p.getReferenceNo(),
                    BigDecimal.ZERO, p.getAmount(), balance.setScale(2, RoundingMode.HALF_UP)));
            }
        }
        return new CustomerLedgerReportResponse(customerId, from.toString(), to.toString(),
            entries, balance.setScale(2, RoundingMode.HALF_UP), Instant.now().toString());
    }

    public BranchPerformanceReportResponse branchPerformanceReport(UUID branchId, LocalDate from, LocalDate to) {
        List<Invoice> invList = invoices.findByTenantIdAndBranchIdAndInvoiceDateBetweenOrderByInvoiceDateAsc(
            ctx.tenantId(), branchId, from, to);
        BigDecimal revenue = invList.stream().map(i -> nvl(i.getGrandTotal())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal collected = invList.stream().map(i -> nvl(i.getPaidAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = invList.stream().map(i -> nvl(i.getBalanceAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        int serviceCount = (int) invList.stream()
            .filter(i -> nvl(lockedAmount(i.getRemarks(), "service_total_locked", "serviceTotalLocked")).signum() > 0)
            .count();
        return new BranchPerformanceReportResponse(branchId, from.toString(), to.toString(),
            revenue.setScale(2, RoundingMode.HALF_UP),
            collected.setScale(2, RoundingMode.HALF_UP),
            outstanding.setScale(2, RoundingMode.HALF_UP),
            invList.size(), serviceCount, Instant.now().toString());
    }

    public AgeingReportResponse ageingReport(LocalDate asOf) {
        List<Invoice> outstanding = invoices.findByTenantIdOrderByInvoiceDateDesc(ctx.tenantId())
            .stream()
            .filter(i -> i.getStatus() == Invoice.Status.ISSUED || i.getStatus() == Invoice.Status.PARTIALLY_PAID)
            .toList();
        BigDecimal b0 = BigDecimal.ZERO, b31 = BigDecimal.ZERO, b61 = BigDecimal.ZERO, b91 = BigDecimal.ZERO;
        int c0 = 0, c31 = 0, c61 = 0, c91 = 0;
        for (Invoice inv : outstanding) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(inv.getInvoiceDate(), asOf);
            BigDecimal bal = nvl(inv.getBalanceAmount());
            if (days <= 30)       { b0  = b0.add(bal);  c0++;  }
            else if (days <= 60)  { b31 = b31.add(bal); c31++; }
            else if (days <= 90)  { b61 = b61.add(bal); c61++; }
            else                  { b91 = b91.add(bal); c91++; }
        }
        BigDecimal total = b0.add(b31).add(b61).add(b91);
        return new AgeingReportResponse(asOf.toString(),
            new AgeingBucket("0-30 days",  b0.setScale(2, RoundingMode.HALF_UP),  c0),
            new AgeingBucket("31-60 days", b31.setScale(2, RoundingMode.HALF_UP), c31),
            new AgeingBucket("61-90 days", b61.setScale(2, RoundingMode.HALF_UP), c61),
            new AgeingBucket("90+ days",   b91.setScale(2, RoundingMode.HALF_UP), c91),
            total.setScale(2, RoundingMode.HALF_UP), Instant.now().toString());
    }

    public ExchangeGoldMovementReportResponse exchangeGoldMovementReport(LocalDate from, LocalDate to) {
        Instant iFrom = from.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant iTo   = to.plusDays(1).atStartOfDay().minusNanos(1).toInstant(ZoneOffset.UTC);
        List<BillingExchangeRecord> exList = exchanges.findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            ctx.tenantId(), iFrom, iTo);
        BigDecimal grams = exList.stream().map(e -> nvl(e.getGoldGrams())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pure  = exList.stream().map(e -> {
            BigDecimal g = nvl(e.getGoldGrams()), p = nvl(e.getPurity());
            return g.multiply(p).divide(THOUSAND, 3, RoundingMode.HALF_UP);
        }).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(3, RoundingMode.HALF_UP);
        BigDecimal cash  = exList.stream().map(e -> nvl(e.getCashComponent())).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ExchangeGoldMovementReportResponse(from.toString(), to.toString(),
            grams.setScale(3, RoundingMode.HALF_UP), pure, cash.setScale(2, RoundingMode.HALF_UP),
            exList.size(), Instant.now().toString());
    }

    public CustomerComparisonReportResponse customerComparisonReport(String cust1, String cust2, LocalDate from, LocalDate to) {
        return new CustomerComparisonReportResponse(from.toString(), to.toString(),
            buildCustomerKpi(cust1, from, to), buildCustomerKpi(cust2, from, to), Instant.now().toString());
    }

    private CustomerKpi buildCustomerKpi(String customerId, LocalDate from, LocalDate to) {
        List<Invoice> invList;
        try {
            UUID custUuid = UUID.fromString(customerId);
            invList = invoices.findByTenantIdAndCustomerIdAndInvoiceDateBetweenOrderByInvoiceDateAsc(
                ctx.tenantId(), custUuid, from, to);
        } catch (IllegalArgumentException e) {
            invList = invoices.findByTenantIdAndInvoiceDateBetweenOrderByInvoiceDateAsc(ctx.tenantId(), from, to)
                .stream().filter(i -> customerId.equals(i.getCustomerId().toString())).toList();
        }
        BigDecimal revenue = invList.stream().map(i -> nvl(i.getGrandTotal())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = invList.stream().map(i -> nvl(i.getBalanceAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        int cnt = invList.size();
        BigDecimal avg = cnt == 0 ? BigDecimal.ZERO : revenue.divide(new BigDecimal(cnt), 2, RoundingMode.HALF_UP);
        return new CustomerKpi(customerId, revenue.setScale(2, RoundingMode.HALF_UP), cnt, avg,
            outstanding.setScale(2, RoundingMode.HALF_UP));
    }

    private BigDecimal nvl(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    // ---------- Recompute totals ----------
    private void recompute(Invoice inv) {
        var ls = lines.findByInvoiceIdOrderByLineNoAsc(inv.getId());
        BigDecimal subtotal     = ls.stream().map(InvoiceLine::getMetalValue).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal makingTotal  = ls.stream().map(InvoiceLine::getMakingCharges).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal= ls.stream().map(InvoiceLine::getDiscount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxable      = ls.stream().map(InvoiceLine::getTaxableAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cgst         = ls.stream().map(InvoiceLine::getCgstAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sgst         = ls.stream().map(InvoiceLine::getSgstAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal igst         = ls.stream().map(InvoiceLine::getIgstAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal exact        = taxable.add(cgst).add(sgst).add(igst);
        BigDecimal rounded      = exact.setScale(0, RoundingMode.HALF_UP);
        BigDecimal roundOff     = rounded.subtract(exact);
        inv.setSubtotal(subtotal); inv.setMakingTotal(makingTotal); inv.setDiscountTotal(discountTotal);
        inv.setTaxableAmount(taxable);
        inv.setCgstAmount(cgst); inv.setSgstAmount(sgst); inv.setIgstAmount(igst);
        inv.setRoundOff(roundOff); inv.setGrandTotal(rounded);

        var pays = payments.findByInvoiceIdOrderByPaymentDateAsc(inv.getId());
        BigDecimal paid = pays.stream().map(Payment::getAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = rounded.subtract(paid);
        inv.setPaidAmount(paid); inv.setBalanceAmount(balance);

        // Auto-status transitions
        if (inv.getStatus() == Invoice.Status.ISSUED || inv.getStatus() == Invoice.Status.PARTIALLY_PAID || inv.getStatus() == Invoice.Status.PAID) {
            if (paid.signum() == 0)         inv.setStatus(Invoice.Status.ISSUED);
            else if (balance.signum() <= 0) inv.setStatus(Invoice.Status.PAID);
            else                            inv.setStatus(Invoice.Status.PARTIALLY_PAID);
        }
    }

    // ---------- helpers ----------
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private InvoiceResponse toInvoice(Invoice i) {
        BigDecimal huidLocked = lockedAmount(i.getRemarks(), "huid_amount_locked", "huidAmountLocked");
        BigDecimal xrfLocked = lockedAmount(i.getRemarks(), "xrf_amount_locked", "xrfAmountLocked");
        BigDecimal fireLocked = lockedAmount(i.getRemarks(), "fire_assay_amount_locked", "fireAssayAmountLocked");
        BigDecimal serviceTotalLocked = lockedAmount(i.getRemarks(), "service_total_locked", "serviceTotalLocked");
        return new InvoiceResponse(i.getId(), i.getInvoiceNumber(), i.getBranchId(), i.getCustomerId(),
            i.getInvoiceDate(), i.getDueDate(), i.getType(), i.getPlaceOfSupply(), i.getInterstate(),
            i.getSubtotal(), i.getMakingTotal(), i.getDiscountTotal(),
            i.getTaxableAmount(), i.getCgstAmount(), i.getSgstAmount(), i.getIgstAmount(),
            i.getRoundOff(), i.getGrandTotal(), i.getPaidAmount(), i.getBalanceAmount(),
            huidLocked, xrfLocked, fireLocked, serviceTotalLocked,
            i.getStatus(), i.getRemarks());
    }

    private String extractBranchCode(String remarks) {
        if (remarks == null || remarks.isBlank()) return null;
        try {
            Map<String, Object> map = OM.readValue(remarks, new TypeReference<>() {});
            Object bc = map.get("bc");
            return bc != null ? bc.toString().trim().toUpperCase() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String withLockedAmounts(Invoice inv) {
        BigDecimal huid = BigDecimal.ZERO;
        BigDecimal xrf = BigDecimal.ZERO;
        BigDecimal fire = BigDecimal.ZERO;
        BigDecimal serviceTotal = BigDecimal.ZERO;
        for (InvoiceLine l : lines.findByInvoiceIdOrderByLineNoAsc(inv.getId())) {
            BigDecimal amt = l.getLineTotal() == null ? BigDecimal.ZERO : l.getLineTotal();
            serviceTotal = serviceTotal.add(amt);
            String d = l.getItemDesc() == null ? "" : l.getItemDesc().toUpperCase();
            if (d.contains("HUID")) huid = huid.add(amt);
            if (d.contains("XRF")) xrf = xrf.add(amt);
            if (d.contains("FIRE") && d.contains("ASSAY")) fire = fire.add(amt);
        }

        Map<String, Object> map = new HashMap<>();
        if (inv.getRemarks() != null && !inv.getRemarks().isBlank()) {
            try {
                map.putAll(OM.readValue(inv.getRemarks(), new TypeReference<Map<String, Object>>() {}));
            } catch (Exception ignored) {
                // keep existing non-JSON remarks untouched by storing under notes
                map.put("notes", inv.getRemarks());
            }
        }
        map.put("huid_amount_locked", huid);
        map.put("xrf_amount_locked", xrf);
        map.put("fire_assay_amount_locked", fire);
        map.put("service_total_locked", serviceTotal);
        map.put("huidAmountLocked", huid);
        map.put("xrfAmountLocked", xrf);
        map.put("fireAssayAmountLocked", fire);
        map.put("serviceTotalLocked", serviceTotal);

        try {
            return OM.writeValueAsString(map);
        } catch (Exception e) {
            return inv.getRemarks();
        }
    }

    private BigDecimal lockedAmount(String remarks, String snakeKey, String camelKey) {
        if (remarks == null || remarks.isBlank()) return null;
        try {
            Map<String, Object> map = OM.readValue(remarks, new TypeReference<Map<String, Object>>() {});
            Object v = map.containsKey(snakeKey) ? map.get(snakeKey) : map.get(camelKey);
            if (v == null) return null;
            if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
            return new BigDecimal(String.valueOf(v)).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception ignored) {
            return null;
        }
    }
    private LineResponse toLine(InvoiceLine l) {
        return new LineResponse(l.getId(), l.getInvoiceId(), l.getLineNo(),
            l.getItemDesc(), l.getHsnCode(), l.getLotId(), l.getProductId(),
            l.getGrossWeight(), l.getFineness(), l.getPureWeight(),
            l.getRatePerGram(), l.getMetalValue(),
            l.getMakingCharges(), l.getDiscount(),
            l.getTaxableAmount(), l.getTaxRatePct(),
            l.getCgstAmount(), l.getSgstAmount(), l.getIgstAmount(),
            l.getLineTotal());
    }
    private PaymentResponse toPayment(Payment p) {
        return new PaymentResponse(p.getId(), p.getInvoiceId(), p.getPaymentDate(),
            p.getAmount(), p.getMethod(), p.getReferenceNo(), p.getRemarks());
    }

    private DepositResponse toDeposit(CustomerDeposit d) {
        return new DepositResponse(d.getId(), d.getCustomerId(), d.getBranchCode(), d.getAmount(), d.getRemaining(), d.getCreatedAt().toString());
    }

    private ExchangeResponse toExchange(BillingExchangeRecord e) {
        return new ExchangeResponse(e.getId(), e.getCustomerId(), e.getBranchCode(), e.getGoldGrams(), e.getPurity(), e.getCashComponent(), e.getGrandTotal(), e.getCreatedAt().toString());
    }

    private PaymentRegisterResponse toPaymentRegister(BillingPaymentRegister p) {
        return new PaymentRegisterResponse(p.getId(), p.getCustomerId(), p.getBranchCode(), p.getAmount(), p.getTender(), p.getGoldGrams(), p.getPurity(), p.getCreatedAt().toString());
    }

    private ScrapLogResponse toScrapLog(BillingScrapLog s) {
        return new ScrapLogResponse(s.getId(), s.getLinkedPaymentId(), s.getCustomerId(), s.getBranchCode(), s.getGoldGrams(), s.getPurity(), s.getPureGold(), s.getCreatedAt().toString());
    }

    private DiscountResponse toDiscount(BillingDiscount d) {
        return new DiscountResponse(
            d.getId(), d.getCustomerId(), d.getBranchCode(), d.getReferenceNo(), d.getDiscountAmount(), d.getStatus().name(),
            d.isCustomerLedgerPosted(), d.isBranchLedgerPosted(),
            d.getCreatedAt().toString(), d.getApprovedAt() == null ? null : d.getApprovedAt().toString(),
            d.getRejectionReason()
        );
    }

    private MonthlyScrapValidationResponse toMonthlyValidation(BillingScrapMonthlyValidation v) {
        return new MonthlyScrapValidationResponse(
            v.getId(), v.getYear(), v.getMonth(),
            v.getExpectedPureGold(), v.getActualPureGold(), v.getVariance(),
            v.getWtAvgPurityExpected(), v.getWtAvgPurityActual(),
            v.isDiscrepancyFlag(),
            v.getCreatedAt().toString()
        );
    }

    private ScrapReportResponse toScrapReport(List<BillingExchangeRecord> ex, List<BillingScrapLog> logs) {
        BigDecimal totalExGrams = ex.stream().map(BillingExchangeRecord::getGoldGrams).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expectedPure = ex.stream()
            .map(r -> r.getGoldGrams().multiply(r.getPurity()).divide(HUNDRED, 6, RoundingMode.HALF_UP))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal wtExp = totalExGrams.signum() == 0 ? BigDecimal.ZERO : ex.stream()
            .map(r -> r.getGoldGrams().multiply(r.getPurity()))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(totalExGrams, 2, RoundingMode.HALF_UP);

        BigDecimal totalLogGrams = logs.stream().map(BillingScrapLog::getGoldGrams).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal actualPure = logs.stream().map(BillingScrapLog::getPureGold).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal wtAct = totalLogGrams.signum() == 0 ? BigDecimal.ZERO : logs.stream()
            .map(r -> r.getGoldGrams().multiply(r.getPurity()))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(totalLogGrams, 2, RoundingMode.HALF_UP);

        expectedPure = expectedPure.setScale(3, RoundingMode.HALF_UP);
        actualPure = actualPure.setScale(3, RoundingMode.HALF_UP);
        return new ScrapReportResponse(
            expectedPure,
            actualPure,
            expectedPure.subtract(actualPure).setScale(3, RoundingMode.HALF_UP),
            wtExp,
            wtAct,
            Instant.now().toString()
        );
    }

    private BigDecimal approvalThresholdForBranch(String branchCode) {
        if (branchCode == null) {
            return discountApprovalProperties.getDefaultThreshold();
        }
        BigDecimal threshold = discountApprovalProperties.getBranchThresholds().get(branchCode.toUpperCase());
        return threshold == null ? discountApprovalProperties.getDefaultThreshold() : threshold;
    }

    private String nextDiscountReference() {
        Long seq = jdbcTemplate.queryForObject("select nextval('billing_discount_ref_seq')", Long.class);
        long n = seq == null ? 0L : seq;
        return "DSC-" + LocalDate.now().format(DF) + "-" + String.format("%06d", n);
    }
}
