package com.nexus.laser.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "laser_marks", indexes = {
    @Index(name = "ix_lmark_job", columnList = "job_id, piece_no")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LaserMark extends BaseEntity {

    @Column(name = "job_id", nullable = false) private UUID jobId;
    @Column(name = "piece_no", nullable = false) private int pieceNo;
    @Column(name = "engraved_text", length = 200) private String engravedText;
    @Column(name = "piece_weight", precision = 14, scale = 4) private BigDecimal pieceWeight;
    @Column(name = "operator_name", length = 120) private String operatorName;
    @Column(name = "marked_at", nullable = false) @Builder.Default private LocalDateTime markedAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING) @Column(name = "result", nullable = false, length = 20)
    @Builder.Default private Result result = Result.OK;
    @Column(name = "remarks", length = 500) private String remarks;

    public enum Result { OK, REWORK, REJECT }
}
