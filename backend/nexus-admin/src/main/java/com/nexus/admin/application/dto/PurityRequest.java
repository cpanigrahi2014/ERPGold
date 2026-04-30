package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Product;
import com.nexus.admin.domain.model.PurityCatalogEntry;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.util.UUID;

public record PurityRequest(
    @NotBlank String label,
    BigDecimal finenessThreshold,
    Product.Metal metal
) {}
