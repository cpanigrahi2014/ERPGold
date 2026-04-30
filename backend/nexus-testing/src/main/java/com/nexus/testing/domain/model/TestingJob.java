package com.nexus.testing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "testing_jobs", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "job_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestingJob extends BaseEntity {

    @Column(name = "job_number", nullable = false, length = 40) private String jobNumber;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Column(name = "lot_id") private UUID lotId;

    @Enumerated(EnumType.STRING) @Column(name = "method", nullable = false, length = 20)
    private Method method;

    @Column(name = "received_date", nullable = false) private LocalDate receivedDate;
    @Column(name = "due_date") private LocalDate dueDate;
    @Column(name = "completed_date") private LocalDate completedDate;

    @Column(name = "sample_count", nullable = false) @Builder.Default private int sampleCount = 1;
    @Column(name = "gross_weight", precision = 14, scale = 4) private BigDecimal grossWeight;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.RECEIVED;

    @Column(name = "rate", precision = 14, scale = 2) private BigDecimal rate;
    @Column(name = "remarks", length = 500) private String remarks;

    public enum Method { XRF, FIRE_ASSAY, TITRATION, CUPELLATION }
    public enum Status { RECEIVED, IN_PROGRESS, COMPLETED, CERTIFIED, INVOICED, CANCELLED }
}
