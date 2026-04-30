package com.nexus.inventory.application.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record SplitRequest(
    @NotNull UUID lotId,
    @NotNull @Positive List<BigDecimal> childWeights
) {}
