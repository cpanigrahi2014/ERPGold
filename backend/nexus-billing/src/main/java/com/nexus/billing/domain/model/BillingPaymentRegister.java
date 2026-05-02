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

@Entity
@Table(name = "billing_payments_register")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingPaymentRegister extends BaseEntity {
    @Column(name = "customer_id", nullable = false, length = 80) private String customerId;
    @Column(name = "branch_code", nullable = false, length = 20) private String branchCode;
    @Column(name = "amount", nullable = false, precision = 16, scale = 2) private BigDecimal amount;
    @Column(name = "tender", nullable = false, length = 30) private String tender;
    @Column(name = "gold_grams", precision = 14, scale = 3) private BigDecimal goldGrams;
    @Column(name = "purity", precision = 7, scale = 3) private BigDecimal purity;
}
