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
@Table(name = "billing_exchange_records")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingExchangeRecord extends BaseEntity {
    @Column(name = "customer_id", nullable = false, length = 80) private String customerId;
    @Column(name = "branch_code", nullable = false, length = 20) private String branchCode;
    @Column(name = "gold_grams", nullable = false, precision = 14, scale = 3) private BigDecimal goldGrams;
    @Column(name = "purity", nullable = false, precision = 7, scale = 3) private BigDecimal purity;
    @Column(name = "cash_component", nullable = false, precision = 16, scale = 2) private BigDecimal cashComponent;
    @Column(name = "grand_total", nullable = false, precision = 16, scale = 2) private BigDecimal grandTotal;
}
