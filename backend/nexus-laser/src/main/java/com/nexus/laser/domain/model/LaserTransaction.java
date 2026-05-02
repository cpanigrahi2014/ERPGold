package com.nexus.laser.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "laser_transactions", indexes = {
    @Index(name = "ix_ltxn_date", columnList = "created_at"),
    @Index(name = "ix_ltxn_type", columnList = "txn_type")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LaserTransaction extends BaseEntity {

    @Column(name = "job_id", nullable = false) private UUID jobId;
    @Column(name = "order_id", nullable = false, length = 60) private String orderId;
    
    @Enumerated(EnumType.STRING) @Column(name = "txn_type", nullable = false, length = 30)
    private Type type;  // Non-HUID, Seal, General

    @Column(name = "non_huid_qty", nullable = false) @Builder.Default private int nonHuidQty = 0;
    @Column(name = "seal_qty", nullable = false) @Builder.Default private int sealQty = 0;
    @Column(name = "total_markings", nullable = false) private int totalMarkings;

    public enum Type { NON_HUID, SEAL, GENERAL }
}
