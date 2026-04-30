package com.nexus.records.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Statutory stock registers (Form 13 of Bullion / GST Stock Register / Hallmark Register).
 * One row per movement; running balances are computed by service.
 */
@Entity
@Table(name = "register_entries", indexes = {
    @Index(name = "ix_re_register", columnList = "tenant_id, register_type, entry_date"),
    @Index(name = "ix_re_branch",   columnList = "tenant_id, branch_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RegisterEntry extends BaseEntity {

    @Enumerated(EnumType.STRING) @Column(name = "register_type", nullable = false, length = 30)
    private RegisterType registerType;

    @Column(name = "entry_date", nullable = false) private LocalDate entryDate;
    @Column(name = "serial_no",  nullable = false) private Long serialNo;

    @Column(name = "branch_id") private UUID branchId;
    @Column(name = "metal", length = 20) private String metal;
    @Column(name = "purity_label", length = 20) private String purityLabel;

    @Column(name = "particulars", length = 500) private String particulars;
    @Column(name = "voucher_no",  length = 60)  private String voucherNo;
    @Column(name = "party_name",  length = 200) private String partyName;

    @Column(name = "qty_in",  precision = 14, scale = 4) private BigDecimal qtyIn;
    @Column(name = "qty_out", precision = 14, scale = 4) private BigDecimal qtyOut;
    @Column(name = "balance", precision = 14, scale = 4) private BigDecimal balance;
    @Column(name = "value_in",  precision = 16, scale = 2) private BigDecimal valueIn;
    @Column(name = "value_out", precision = 16, scale = 2) private BigDecimal valueOut;

    public enum RegisterType { STOCK, HALLMARK, REFINERY, EXCHANGE, FORM13 }
}
