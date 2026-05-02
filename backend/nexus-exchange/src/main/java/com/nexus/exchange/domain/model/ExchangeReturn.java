package com.nexus.exchange.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "exchange_returns", indexes = {
    @Index(name = "ix_exr_tenant_status", columnList = "tenant_id,status"),
    @Index(name = "ix_exr_tenant_txn", columnList = "tenant_id,txn_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExchangeReturn extends BaseEntity {

    @Column(name = "txn_id", nullable = false)
    private UUID txnId;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.PENDING;

    public enum Status { PENDING, APPROVED, REJECTED }
}
