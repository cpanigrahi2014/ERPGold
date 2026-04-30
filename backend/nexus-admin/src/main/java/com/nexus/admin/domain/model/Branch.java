package com.nexus.admin.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Branch / Centre — physical office where operations happen.
 * Holds tolerance settings referenced by Hallmarking, Refinery & Billing.
 */
@Entity
@Table(name = "branches", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Branch extends BaseEntity {

    @Column(name = "code", nullable = false, length = 20)
    private String code;                    // e.g. "BLR1"

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "invoice_code", length = 10)
    private String invoiceCode;             // prefix for invoice numbering

    @Column(name = "address_line1")
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "state", length = 100)
    private String state;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(name = "country", length = 3)
    @Builder.Default
    private String country = "IN";

    @Column(name = "gstin", length = 20)
    private String gstin;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "email")
    private String email;

    // -- Tolerance / business config (referenced by Refinery & Hallmarking) --

    @Column(name = "hand_loss_pct", precision = 6, scale = 3)
    @Builder.Default
    private BigDecimal handLossPct = new BigDecimal("0.500");

    @Column(name = "gold_loss_pct", precision = 6, scale = 3)
    @Builder.Default
    private BigDecimal goldLossPct = new BigDecimal("0.200");

    @Column(name = "acid_loss_pct", precision = 6, scale = 3)
    @Builder.Default
    private BigDecimal acidLossPct = new BigDecimal("5.000");

    @Column(name = "market_value_pct", precision = 6, scale = 3)
    @Builder.Default
    private BigDecimal marketValuePct = new BigDecimal("99.500");

    @Column(name = "fineness_tolerance", precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal finenessTolerance = new BigDecimal("0.50");

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;
}
