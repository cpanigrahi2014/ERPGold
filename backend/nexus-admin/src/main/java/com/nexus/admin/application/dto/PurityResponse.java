package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Product;
import com.nexus.admin.domain.model.PurityCatalogEntry;

import java.math.BigDecimal;
import java.util.UUID;

public record PurityResponse(
    UUID id, String label, BigDecimal finenessThreshold,
    Product.Metal metal, boolean active
) {
    public static PurityResponse from(PurityCatalogEntry p) {
        return new PurityResponse(
            p.getId(), p.getLabel(), p.getFinenessThreshold(),
            p.getMetal(), p.isActive()
        );
    }
}
