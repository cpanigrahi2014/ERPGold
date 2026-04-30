package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Product;

import java.util.UUID;

public record ProductResponse(
    UUID id, String code, String name,
    UUID categoryId, String categoryName,
    Product.Metal defaultMetal, String hsnCode, boolean active
) {
    public static ProductResponse from(Product p) {
        return new ProductResponse(
            p.getId(), p.getCode(), p.getName(),
            p.getCategory() != null ? p.getCategory().getId() : null,
            p.getCategory() != null ? p.getCategory().getName() : null,
            p.getDefaultMetal(), p.getHsnCode(), p.isActive()
        );
    }
}
