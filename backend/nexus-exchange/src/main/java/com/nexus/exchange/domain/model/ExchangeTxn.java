package com.nexus.exchange.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "exchange_txns", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "txn_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExchangeTxn extends BaseEntity {

    @Column(name = "txn_number", nullable = false, length = 40) private String txnNumber;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Column(name = "exchange_date", nullable = false) private LocalDate exchangeDate;
    @Column(name = "posted_date") private LocalDate postedDate;

    @Enumerated(EnumType.STRING) @Column(name = "metal", nullable = false, length = 20)
    @Builder.Default private Metal metal = Metal.GOLD;

    @Column(name = "valuation_rate", precision = 14, scale = 2) private BigDecimal valuationRate; // ₹/g pure
    @Column(name = "old_gross",      precision = 14, scale = 4) private BigDecimal oldGross;
    @Column(name = "old_pure",       precision = 14, scale = 4) private BigDecimal oldPure;
    @Column(name = "old_value",      precision = 16, scale = 2) private BigDecimal oldValue;
    @Column(name = "new_gross",      precision = 14, scale = 4) private BigDecimal newGross;
    @Column(name = "new_pure",       precision = 14, scale = 4) private BigDecimal newPure;
    @Column(name = "new_value",      precision = 16, scale = 2) private BigDecimal newValue;
    @Column(name = "making_charges", precision = 16, scale = 2) private BigDecimal makingCharges;
    @Column(name = "balance_payable",precision = 16, scale = 2) private BigDecimal balancePayable;

    @Enumerated(EnumType.STRING) @Column(name = "settlement_type", length = 20)
    @Builder.Default private SettlementType settlementType = SettlementType.CASH;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20)
    @Builder.Default private Status status = Status.DRAFT;

    @Column(name = "remarks", length = 500) private String remarks;

    public enum Metal          { GOLD, SILVER, PLATINUM }
    public enum SettlementType { CASH, CREDIT, NEW_ITEM, REFUND }
    public enum Status         { DRAFT, POSTED, CANCELLED }
}
