package com.nexus.inventory.application.dto;

import com.nexus.inventory.domain.model.StockMovement;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

public record MovementRequest(
    @NotNull UUID lotId,
    @NotNull StockMovement.Type type,
    UUID fromLocationId,
    UUID toLocationId,
    @NotNull @Positive BigDecimal quantity,
    String referenceType,
    UUID referenceId,
    String remarks
) {}
