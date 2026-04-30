package com.nexus.inventory.application.dto;

import com.nexus.inventory.domain.model.StockLocation;

import java.util.UUID;

public record StockLocationResponse(
    UUID id, UUID branchId, String code, String name,
    StockLocation.Kind kind, boolean active
) {
    public static StockLocationResponse from(StockLocation s) {
        return new StockLocationResponse(s.getId(), s.getBranchId(), s.getCode(), s.getName(),
            s.getKind(), s.isActive());
    }
}
