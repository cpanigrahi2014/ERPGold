package com.nexus.records.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "day_book", indexes = {
    @Index(name = "ix_db_date",   columnList = "tenant_id, entry_date"),
    @Index(name = "ix_db_branch", columnList = "tenant_id, branch_id"),
    @Index(name = "ix_db_module", columnList = "module")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DayBookEntry extends BaseEntity {

    @Column(name = "entry_date",  nullable = false) private LocalDate entryDate;
    @Column(name = "branch_id",   nullable = false) private UUID branchId;

    @Enumerated(EnumType.STRING) @Column(name = "module", nullable = false, length = 30)
    private Module module;

    @Enumerated(EnumType.STRING) @Column(name = "txn_type", nullable = false, length = 30)
    private TxnType txnType;

    @Column(name = "reference_no", length = 60) private String referenceNo;
    @Column(name = "reference_id") private UUID referenceId;
    @Column(name = "party_id") private UUID partyId;
    @Column(name = "party_name", length = 200) private String partyName;
    @Column(name = "narration", length = 500) private String narration;

    @Column(name = "metal_in_g",  precision = 14, scale = 4) private BigDecimal metalInG;
    @Column(name = "metal_out_g", precision = 14, scale = 4) private BigDecimal metalOutG;
    @Column(name = "amount_in",   precision = 16, scale = 2) private BigDecimal amountIn;
    @Column(name = "amount_out",  precision = 16, scale = 2) private BigDecimal amountOut;

    public enum Module { INVENTORY, TESTING, HALLMARKING, LASER, REFINERY, EXCHANGE, BILLING, RECORDS, MANUAL }
    public enum TxnType {
        RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, JOB_IN, JOB_OUT,
        SALE, PURCHASE, RETURN, PAYMENT, EXCHANGE_OLD, EXCHANGE_NEW,
        MONTHLY_OPEN, DAILY_TRANSFER
    }
}
