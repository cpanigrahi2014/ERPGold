package com.nexus.testing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "testing_results", indexes = {
    @Index(name = "ix_result_job", columnList = "job_id, sample_no")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestingResult extends BaseEntity {

    @Column(name = "job_id", nullable = false) private UUID jobId;

    @Column(name = "sample_no", nullable = false) private int sampleNo;
    @Column(name = "sample_weight", precision = 14, scale = 4) private BigDecimal sampleWeight;

    // Au, Ag, Cu, Zn, Ni, Pd, Pt — store the assay table as separate columns for query/index, plus JSONB extras
    @Column(name = "au_pct", precision = 7, scale = 4) private BigDecimal auPct;
    @Column(name = "ag_pct", precision = 7, scale = 4) private BigDecimal agPct;
    @Column(name = "cu_pct", precision = 7, scale = 4) private BigDecimal cuPct;
    @Column(name = "zn_pct", precision = 7, scale = 4) private BigDecimal znPct;
    @Column(name = "ni_pct", precision = 7, scale = 4) private BigDecimal niPct;
    @Column(name = "pd_pct", precision = 7, scale = 4) private BigDecimal pdPct;
    @Column(name = "pt_pct", precision = 7, scale = 4) private BigDecimal ptPct;
    @Column(name = "other_pct", precision = 7, scale = 4) private BigDecimal otherPct;

    @Column(name = "fineness", precision = 7, scale = 3) private BigDecimal fineness;       // ppt (Au content)
    @Column(name = "tested_at", nullable = false) @Builder.Default private LocalDateTime testedAt = LocalDateTime.now();
    @Column(name = "tested_by_name", length = 120) private String testedByName;
    @Column(name = "remarks", length = 500) private String remarks;
}
