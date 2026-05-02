package com.nexus.refinery.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "refinery_orders", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "order_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RefineryOrder extends BaseEntity {

    @Column(name = "order_number", nullable = false, length = 60)
    private String orderNumber;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "branch_code", length = 10)
    private String branchCode;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "customer_no", length = 30)
    private String customerNo;

    @Column(name = "customer_name", length = 120)
    private String customerName;

    @Column(name = "work_type", length = 20)
    @Builder.Default private String workType = "CUSTOMER";

    @Column(name = "sent_gold_weight", nullable = false, precision = 14, scale = 4)
    private BigDecimal sentGoldWeight;

    @Column(name = "declared_purity", nullable = false, length = 30)
    private String declaredPurity;

    @Column(name = "received_gold_weight", precision = 14, scale = 4)
    private BigDecimal receivedGoldWeight;

    @Column(name = "observed_purity_pct", precision = 7, scale = 3)
    private BigDecimal observedPurityPct;

    @Column(name = "melting_total_weight", precision = 14, scale = 4)
    private BigDecimal meltingTotalWeight;

    @Column(name = "melting_sample_weight", precision = 14, scale = 4)
    private BigDecimal meltingSampleWeight;

    @Column(name = "batch_id")
    private UUID batchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.RECEIPT;

    public enum Status { RECEIPT, INTAKE_APPROVAL, BATCHED }
}
