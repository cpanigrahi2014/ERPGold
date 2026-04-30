package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Branch;

import java.math.BigDecimal;
import java.util.UUID;

public record BranchResponse(
    UUID id, String code, String name, String invoiceCode,
    String addressLine1, String addressLine2,
    String city, String state, String postalCode, String country,
    String gstin, String phone, String email,
    BigDecimal handLossPct, BigDecimal goldLossPct, BigDecimal acidLossPct,
    BigDecimal marketValuePct, BigDecimal finenessTolerance,
    boolean active
) {
    public static BranchResponse from(Branch b) {
        return new BranchResponse(
            b.getId(), b.getCode(), b.getName(), b.getInvoiceCode(),
            b.getAddressLine1(), b.getAddressLine2(),
            b.getCity(), b.getState(), b.getPostalCode(), b.getCountry(),
            b.getGstin(), b.getPhone(), b.getEmail(),
            b.getHandLossPct(), b.getGoldLossPct(), b.getAcidLossPct(),
            b.getMarketValuePct(), b.getFinenessTolerance(),
            b.isActive()
        );
    }
}
