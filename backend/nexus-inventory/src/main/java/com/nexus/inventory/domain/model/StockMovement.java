package com.nexus.inventory.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_movements", indexes = {
    @Index(name = "ix_mov_lot", columnList = "lot_id, occurred_at"),
    @Index(name = "ix_mov_loc", columnList = "to_location_id, occurred_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StockMovement extends BaseEntity {

    @Column(name = "lot_id", nullable = false)
    private UUID lotId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private Type type;

    @Column(name = "from_location_id")
    private UUID fromLocationId;

    @Column(name = "to_location_id")
    private UUID toLocationId;

    @Column(name = "quantity", nullable = false, precision = 14, scale = 4)
    private BigDecimal quantity;          // grams

    @Column(name = "occurred_at", nullable = false)
    @Builder.Default
    private LocalDateTime occurredAt = LocalDateTime.now();

    @Column(name = "reference_type", length = 40)
    private String referenceType;          // TESTING, REFINERY, LASER, EXCHANGE, ADJUST, SPLIT, MERGE, RECEIPT

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "remarks", length = 500)
    private String remarks;

    public enum Type { IN, OUT, TRANSFER, ADJUST, SPLIT, MERGE }
}
