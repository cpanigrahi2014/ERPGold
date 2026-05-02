package com.nexus.hm.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "hm_jobs", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "job_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HmJob extends BaseEntity {

    @Column(name = "job_number", nullable = false, length = 40) private String jobNumber;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "jeweller_id", nullable = false) private UUID jewellerId;     // customer id (jeweller)
    @Column(name = "lot_id") private UUID lotId;

    @Enumerated(EnumType.STRING) @Column(name = "kind", nullable = false, length = 20)
    private Kind kind;

    @Column(name = "received_date", nullable = false) private LocalDate receivedDate;
    @Column(name = "marked_date") private LocalDate markedDate;
    @Column(name = "dispatched_date") private LocalDate dispatchedDate;

    @Column(name = "purity_label", length = 20) private String purityLabel;       // 22K, 18K, etc.
    @Column(name = "declared_fineness", precision = 7, scale = 3) private BigDecimal declaredFineness;
    @Column(name = "assayed_fineness", precision = 7, scale = 3) private BigDecimal assayedFineness;

    @Column(name = "piece_count", nullable = false) @Builder.Default private int pieceCount = 1;
    @Column(name = "gross_weight", precision = 14, scale = 4) private BigDecimal grossWeight;
    @Column(name = "huid_required", nullable = false) @Builder.Default private boolean huidRequired = true;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.RECEIVED;

    @Column(name = "rate_per_piece", precision = 14, scale = 2) private BigDecimal ratePerPiece;
    @Column(name = "remarks", length = 500) private String remarks;
    @Column(name = "workflow_data", columnDefinition = "TEXT") private String workflowData;

    public enum Kind { HUID, NON_HUID }
    public enum Status { RECEIVED, SAMPLED, TESTED, MARKED, DISPATCHED, REJECTED, CANCELLED }
}
