package com.nexus.billing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "invoices", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "invoice_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invoice extends BaseEntity {

    @Column(name = "invoice_number", nullable = false, length = 40) private String invoiceNumber;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Column(name = "invoice_date", nullable = false) private LocalDate invoiceDate;
    @Column(name = "due_date") private LocalDate dueDate;

    @Enumerated(EnumType.STRING) @Column(name = "type", nullable = false, length = 20)
    @Builder.Default private InvoiceType type = InvoiceType.SALE;

    @Column(name = "place_of_supply", length = 60) private String placeOfSupply;
    @Column(name = "is_interstate") @Builder.Default private Boolean interstate = false;

    // Totals (recomputed from lines + payments)
    @Column(name = "subtotal",        precision = 16, scale = 2) private BigDecimal subtotal;
    @Column(name = "making_total",    precision = 16, scale = 2) private BigDecimal makingTotal;
    @Column(name = "discount_total",  precision = 16, scale = 2) private BigDecimal discountTotal;
    @Column(name = "taxable_amount",  precision = 16, scale = 2) private BigDecimal taxableAmount;
    @Column(name = "cgst_amount",     precision = 16, scale = 2) private BigDecimal cgstAmount;
    @Column(name = "sgst_amount",     precision = 16, scale = 2) private BigDecimal sgstAmount;
    @Column(name = "igst_amount",     precision = 16, scale = 2) private BigDecimal igstAmount;
    @Column(name = "round_off",       precision = 8,  scale = 2) private BigDecimal roundOff;
    @Column(name = "grand_total",     precision = 16, scale = 2) private BigDecimal grandTotal;
    @Column(name = "paid_amount",     precision = 16, scale = 2) private BigDecimal paidAmount;
    @Column(name = "balance_amount",  precision = 16, scale = 2) private BigDecimal balanceAmount;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20)
    @Builder.Default private Status status = Status.DRAFT;

    @Column(name = "remarks", length = 500) private String remarks;

    public enum InvoiceType { SALE, PROFORMA, CREDIT_NOTE, DEBIT_NOTE }
    public enum Status      { DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED }
}
