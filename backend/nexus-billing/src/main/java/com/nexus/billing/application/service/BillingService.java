package com.nexus.billing.application.service;

import com.nexus.billing.application.dto.BillingDtos.*;
import com.nexus.billing.application.support.CurrentContext;
import com.nexus.billing.domain.model.*;
import com.nexus.billing.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class BillingService {

    private final InvoiceRepository      invoices;
    private final InvoiceLineRepository  lines;
    private final PaymentRepository      payments;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final BigDecimal HUNDRED  = new BigDecimal("100");
    private static final BigDecimal THOUSAND = new BigDecimal("1000");
    private static final BigDecimal TWO      = new BigDecimal("2");

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
    public InvoiceResponse updateStatus(UUID id, Invoice.Status status) {
        Invoice inv = invoices.findById(id).orElseThrow(() -> new EntityNotFoundException("Invoice not found"));
        inv.setStatus(status); inv.setUpdatedBy(ctx.userId());
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
        return new InvoiceResponse(i.getId(), i.getInvoiceNumber(), i.getBranchId(), i.getCustomerId(),
            i.getInvoiceDate(), i.getDueDate(), i.getType(), i.getPlaceOfSupply(), i.getInterstate(),
            i.getSubtotal(), i.getMakingTotal(), i.getDiscountTotal(),
            i.getTaxableAmount(), i.getCgstAmount(), i.getSgstAmount(), i.getIgstAmount(),
            i.getRoundOff(), i.getGrandTotal(), i.getPaidAmount(), i.getBalanceAmount(),
            i.getStatus(), i.getRemarks());
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
}
