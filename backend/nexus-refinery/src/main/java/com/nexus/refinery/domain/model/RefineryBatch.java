package com.nexus.refinery.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "refinery_batches", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "batch_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RefineryBatch extends BaseEntity {

    @Column(name = "batch_number", nullable = false, length = 40) private String batchNumber;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "customer_id") private UUID customerId;     // null when batching own stock

    @Enumerated(EnumType.STRING) @Column(name = "metal", nullable = false, length = 20)
    @Builder.Default private Metal metal = Metal.GOLD;

    @Enumerated(EnumType.STRING) @Column(name = "method", nullable = false, length = 30)
    @Builder.Default private Method method = Method.AQUA_REGIA;

    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "completed_date") private LocalDate completedDate;

    @Column(name = "input_gross",       precision = 14, scale = 4) private BigDecimal inputGross;     // sum of inputs
    @Column(name = "input_pure",        precision = 14, scale = 4) private BigDecimal inputPure;     // sum of pure metal in
    @Column(name = "output_gross",      precision = 14, scale = 4) private BigDecimal outputGross;
    @Column(name = "output_pure",       precision = 14, scale = 4) private BigDecimal outputPure;
    @Column(name = "loss_gross",        precision = 14, scale = 4) private BigDecimal lossGross;
    @Column(name = "loss_pct",          precision = 7,  scale = 4) private BigDecimal lossPct;
    @Column(name = "expected_fineness", precision = 7,  scale = 3) private BigDecimal expectedFineness;
    @Column(name = "actual_fineness",   precision = 7,  scale = 3) private BigDecimal actualFineness;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.OPEN;

    @Column(name = "remarks", length = 500) private String remarks;

    public enum Metal  { GOLD, SILVER, PLATINUM, MIXED }
    public enum Method { AQUA_REGIA, ELECTROLYSIS, CUPELLATION, INQUARTATION, MILLER }
    public enum Status { OPEN, IN_PROCESS, COMPLETED, RECONCILED, CANCELLED }
}
