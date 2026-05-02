package com.nexus.billing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "billing_discounts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingDiscount extends BaseEntity {
    @Column(name = "customer_id", nullable = false, length = 80) private String customerId;
    @Column(name = "branch_code", nullable = false, length = 20) private String branchCode;
    @Column(name = "discount_amount", nullable = false, precision = 16, scale = 2) private BigDecimal discountAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private Status status = Status.DRAFT;

    @Column(name = "customer_ledger_posted", nullable = false)
    @Builder.Default
    private boolean customerLedgerPosted = false;

    @Column(name = "branch_ledger_posted", nullable = false)
    @Builder.Default
    private boolean branchLedgerPosted = false;

    @Column(name = "approved_at") private Instant approvedAt;

    public enum Status { DRAFT, PENDING_APPROVAL, APPROVED, REJECTED }
}
