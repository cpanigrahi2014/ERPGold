package com.nexus.inventory.application.dto;

import com.nexus.inventory.domain.model.Lot;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record LotRequest(
    String lotNumber,                    // optional — auto-generated if null
    @NotNull UUID branchId,
    UUID customerId,
    UUID currentLocationId,
    @NotNull Lot.Metal metal,
    String purityLabel,
    BigDecimal declaredFineness,
    @NotNull @Positive BigDecimal grossWeight,
    BigDecimal netWeight,
    LocalDate receivedDate,
    String remarks
) {}
