package com.nexus.refinery.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "refinery_process_steps", indexes = {
    @Index(name = "ix_rps_batch", columnList = "batch_id, step_no")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProcessStep extends BaseEntity {
    @Column(name = "batch_id", nullable = false) private UUID batchId;
    @Column(name = "step_no", nullable = false) private int stepNo;
    @Column(name = "step_name", nullable = false, length = 80) private String stepName;
    @Column(name = "operator_name", length = 120) private String operatorName;
    @Column(name = "started_at") private LocalDateTime startedAt;
    @Column(name = "completed_at") private LocalDateTime completedAt;
    @Column(name = "notes", length = 1000) private String notes;
}
