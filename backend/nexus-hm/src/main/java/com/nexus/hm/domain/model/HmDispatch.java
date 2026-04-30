package com.nexus.hm.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "hm_dispatches", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "dispatch_no"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HmDispatch extends BaseEntity {

    @Column(name = "dispatch_no", nullable = false, length = 40) private String dispatchNo;
    @Column(name = "job_id", nullable = false) private UUID jobId;
    @Column(name = "dispatched_on", nullable = false) private LocalDate dispatchedOn;
    @Column(name = "received_by_name", length = 120) private String receivedByName;
    @Column(name = "piece_count", nullable = false) private int pieceCount;
    @Column(name = "gross_weight", precision = 14, scale = 4) private BigDecimal grossWeight;
    @Column(name = "remarks", length = 500) private String remarks;
}
