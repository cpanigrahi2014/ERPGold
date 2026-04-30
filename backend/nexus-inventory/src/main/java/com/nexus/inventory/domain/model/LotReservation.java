package com.nexus.inventory.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "lot_reservations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LotReservation extends BaseEntity {

    @Column(name = "lot_id", nullable = false)
    private UUID lotId;

    @Column(name = "reserved_for_type", nullable = false, length = 30)
    private String reservedForType;       // TESTING_JOB, REFINERY_BATCH, LASER_JOB, EXCHANGE_TXN

    @Column(name = "reserved_for_id", nullable = false)
    private UUID reservedForId;

    @Column(name = "quantity", nullable = false, precision = 14, scale = 4)
    private BigDecimal quantity;

    @Column(name = "reserved_at", nullable = false)
    @Builder.Default
    private LocalDateTime reservedAt = LocalDateTime.now();

    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.ACTIVE;

    public enum Status { ACTIVE, CONSUMED, RELEASED, EXPIRED }
}
