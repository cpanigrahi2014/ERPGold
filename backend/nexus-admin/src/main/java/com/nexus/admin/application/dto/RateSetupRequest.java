package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.RateSetup;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RateSetupRequest(
    @NotNull UUID branchId,
    UUID customerId,                  // null = default rate
    @NotNull UUID serviceTypeId,
    @NotNull BigDecimal rate,
    RateSetup.RateBasis rateBasis,
    LocalDate effectiveFrom,
    LocalDate effectiveTo
) {}
