package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.RateSetup;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RateSetupResponse(
    UUID id, UUID branchId, String branchCode,
    UUID customerId, String customerName,
    UUID serviceTypeId, String serviceTypeCode,
    BigDecimal rate, RateSetup.RateBasis rateBasis,
    LocalDate effectiveFrom, LocalDate effectiveTo, boolean active
) {
    public static RateSetupResponse from(RateSetup r) {
        return new RateSetupResponse(
            r.getId(),
            r.getBranch().getId(), r.getBranch().getCode(),
            r.getCustomer() != null ? r.getCustomer().getId() : null,
            r.getCustomer() != null ? r.getCustomer().getName() : null,
            r.getServiceType().getId(), r.getServiceType().getCode(),
            r.getRate(), r.getRateBasis(),
            r.getEffectiveFrom(), r.getEffectiveTo(), r.isActive()
        );
    }
}
