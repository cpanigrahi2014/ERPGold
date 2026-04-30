package com.nexus.admin.application.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record BranchRequest(
    @NotBlank String code,
    @NotBlank String name,
    String invoiceCode,
    String addressLine1, String addressLine2,
    String city, String state, String postalCode, String country,
    String gstin, String phone, String email,
    BigDecimal handLossPct, BigDecimal goldLossPct, BigDecimal acidLossPct,
    BigDecimal marketValuePct, BigDecimal finenessTolerance
) {}
