package com.nexus.inventory.application.dto;

import com.nexus.inventory.domain.model.StockLocation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record StockLocationRequest(
    @NotNull UUID branchId,
    @NotBlank String code,
    @NotBlank String name,
    @NotNull StockLocation.Kind kind
) {}
