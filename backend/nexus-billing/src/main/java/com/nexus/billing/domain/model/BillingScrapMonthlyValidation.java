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
@Table(name = "billing_scrap_monthly_validation")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingScrapMonthlyValidation extends BaseEntity {
    @Column(name = "report_year", nullable = false) private Integer year;
    @Column(name = "report_month", nullable = false) private Integer month;
    @Column(name = "expected_pure_gold", nullable = false, precision = 14, scale = 3) private BigDecimal expectedPureGold;
    @Column(name = "actual_pure_gold", nullable = false, precision = 14, scale = 3) private BigDecimal actualPureGold;
    @Column(name = "variance", nullable = false, precision = 14, scale = 3) private BigDecimal variance;
    @Column(name = "wt_avg_purity_expected", nullable = false, precision = 7, scale = 3) private BigDecimal wtAvgPurityExpected;
    @Column(name = "wt_avg_purity_actual", nullable = false, precision = 7, scale = 3) private BigDecimal wtAvgPurityActual;
    @Column(name = "discrepancy_flag", nullable = false) private boolean discrepancyFlag;
}
