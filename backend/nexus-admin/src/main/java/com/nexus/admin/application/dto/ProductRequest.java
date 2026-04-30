package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Product;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record ProductRequest(
    @NotBlank String code,
    @NotBlank String name,
    UUID categoryId,
    Product.Metal defaultMetal,
    String hsnCode
) {}
