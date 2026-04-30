package com.nexus.inventory.application.dto;

import com.nexus.inventory.domain.model.StockMovement;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record MovementResponse(
    UUID id, UUID lotId, StockMovement.Type type,
    UUID fromLocationId, UUID toLocationId,
    BigDecimal quantity, LocalDateTime occurredAt,
    String referenceType, UUID referenceId, String remarks
) {
    public static MovementResponse from(StockMovement m) {
        return new MovementResponse(m.getId(), m.getLotId(), m.getType(),
            m.getFromLocationId(), m.getToLocationId(),
            m.getQuantity(), m.getOccurredAt(),
            m.getReferenceType(), m.getReferenceId(), m.getRemarks());
    }
}
