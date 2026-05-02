package com.nexus.billing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "billing_scrap_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingScrapLog extends BaseEntity {
    @Column(name = "linked_payment_id", nullable = false) private UUID linkedPaymentId;
    @Column(name = "customer_id", nullable = false, length = 80) private String customerId;
    @Column(name = "branch_code", nullable = false, length = 20) private String branchCode;
    @Column(name = "gold_grams", nullable = false, precision = 14, scale = 3) private BigDecimal goldGrams;
    @Column(name = "purity", nullable = false, precision = 7, scale = 3) private BigDecimal purity;
    @Column(name = "pure_gold", nullable = false, precision = 14, scale = 3) private BigDecimal pureGold;
}
