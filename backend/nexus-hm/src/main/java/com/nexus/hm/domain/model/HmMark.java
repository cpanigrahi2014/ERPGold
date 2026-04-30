package com.nexus.hm.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "hm_marks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "huid_code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HmMark extends BaseEntity {

    @Column(name = "job_id", nullable = false) private UUID jobId;
    @Column(name = "piece_no", nullable = false) private int pieceNo;

    @Column(name = "huid_code", length = 20) private String huidCode;        // 6-char alphanumeric (BIS HUID)
    @Column(name = "marked_purity", length = 20) private String markedPurity; // e.g. 22KS916
    @Column(name = "piece_weight", precision = 14, scale = 4) private BigDecimal pieceWeight;
    @Column(name = "marked_at", nullable = false) @Builder.Default private LocalDateTime markedAt = LocalDateTime.now();
    @Column(name = "marked_by_name", length = 120) private String markedByName;

    @Enumerated(EnumType.STRING) @Column(name = "result", nullable = false, length = 20)
    @Builder.Default private Result result = Result.PASSED;
    @Column(name = "remarks", length = 500) private String remarks;

    public enum Result { PASSED, FAILED, REWORK }
}
