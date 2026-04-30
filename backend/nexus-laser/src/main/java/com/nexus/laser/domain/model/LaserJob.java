package com.nexus.laser.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "laser_jobs", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "job_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LaserJob extends BaseEntity {

    @Column(name = "job_number", nullable = false, length = 40) private String jobNumber;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Column(name = "lot_id") private UUID lotId;
    @Column(name = "machine_id") private UUID machineId;

    @Column(name = "received_date", nullable = false) private LocalDate receivedDate;
    @Column(name = "due_date") private LocalDate dueDate;
    @Column(name = "completed_date") private LocalDate completedDate;

    @Column(name = "piece_count", nullable = false) @Builder.Default private int pieceCount = 1;
    @Column(name = "marking_text", length = 200) private String markingText;
    @Column(name = "font", length = 40) private String font;            // e.g. Arial, Times
    @Column(name = "depth_mm", precision = 6, scale = 3) private BigDecimal depthMm;
    @Column(name = "power_pct") private Integer powerPct;
    @Column(name = "speed_mmps") private Integer speedMmps;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.ORDER;

    @Column(name = "rate_per_piece", precision = 14, scale = 2) private BigDecimal ratePerPiece;
    @Column(name = "remarks", length = 500) private String remarks;

    public enum Status { ORDER, IN_QUEUE, IN_PROGRESS, COMPLETED, DELIVERED, REJECTED, CANCELLED }
}
