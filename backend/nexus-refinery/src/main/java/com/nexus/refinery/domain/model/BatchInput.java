package com.nexus.refinery.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "refinery_batch_inputs", indexes = {
    @Index(name = "ix_rbi_batch", columnList = "batch_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BatchInput extends BaseEntity {
    @Column(name = "batch_id", nullable = false) private UUID batchId;
    @Column(name = "lot_id") private UUID lotId;                  // optional ref to inventory lot
    @Column(name = "source_label", length = 120) private String sourceLabel;  // e.g. "Customer scrap"
    @Column(name = "gross_weight", nullable = false, precision = 14, scale = 4) private BigDecimal grossWeight;
    @Column(name = "fineness", precision = 7, scale = 3) private BigDecimal fineness;
    @Column(name = "pure_weight", precision = 14, scale = 4) private BigDecimal pureWeight;
    @Column(name = "remarks", length = 500) private String remarks;
}
