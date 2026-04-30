package com.nexus.billing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "invoice_lines", indexes = {
    @Index(name = "ix_il_invoice", columnList = "invoice_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InvoiceLine extends BaseEntity {
    @Column(name = "invoice_id", nullable = false) private UUID invoiceId;
    @Column(name = "line_no", nullable = false) private Integer lineNo;

    @Column(name = "item_desc",  length = 200) private String itemDesc;
    @Column(name = "hsn_code",   length = 20)  private String hsnCode;
    @Column(name = "lot_id") private UUID lotId;
    @Column(name = "product_id") private UUID productId;

    @Column(name = "gross_weight",  precision = 14, scale = 4) private BigDecimal grossWeight;
    @Column(name = "fineness",      precision = 7,  scale = 3) private BigDecimal fineness;
    @Column(name = "pure_weight",   precision = 14, scale = 4) private BigDecimal pureWeight;
    @Column(name = "rate_per_gram", precision = 14, scale = 2) private BigDecimal ratePerGram;
    @Column(name = "metal_value",   precision = 16, scale = 2) private BigDecimal metalValue;
    @Column(name = "making_charges",precision = 16, scale = 2) private BigDecimal makingCharges;
    @Column(name = "discount",      precision = 16, scale = 2) private BigDecimal discount;
    @Column(name = "taxable_amount",precision = 16, scale = 2) private BigDecimal taxableAmount;
    @Column(name = "tax_rate_pct",  precision = 5,  scale = 2) private BigDecimal taxRatePct;
    @Column(name = "cgst_amount",   precision = 16, scale = 2) private BigDecimal cgstAmount;
    @Column(name = "sgst_amount",   precision = 16, scale = 2) private BigDecimal sgstAmount;
    @Column(name = "igst_amount",   precision = 16, scale = 2) private BigDecimal igstAmount;
    @Column(name = "line_total",    precision = 16, scale = 2) private BigDecimal lineTotal;
}
