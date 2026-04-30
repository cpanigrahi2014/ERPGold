package com.nexus.admin.application.service;

import com.nexus.admin.application.dto.ProductRequest;
import com.nexus.admin.application.dto.ProductResponse;
import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.ItemCategory;
import com.nexus.admin.domain.model.Product;
import com.nexus.admin.domain.repository.ItemCategoryRepository;
import com.nexus.admin.domain.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {

    private final ProductRepository repo;
    private final ItemCategoryRepository categoryRepo;
    private final CurrentContext ctx;

    public ProductResponse create(ProductRequest r) {
        UUID tenant = ctx.tenantId();
        repo.findByTenantIdAndCode(tenant, r.code()).ifPresent(p -> {
            throw new IllegalArgumentException("Product code already exists: " + r.code());
        });
        ItemCategory cat = null;
        if (r.categoryId() != null) {
            cat = categoryRepo.findById(r.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found: " + r.categoryId()));
        }
        Product p = Product.builder()
            .code(r.code()).name(r.name()).category(cat)
            .defaultMetal(r.defaultMetal() != null ? r.defaultMetal() : Product.Metal.GOLD)
            .hsnCode(r.hsnCode())
            .build();
        p.setTenantId(tenant);
        p.setCreatedBy(ctx.userId());
        p.setUpdatedBy(ctx.userId());
        return ProductResponse.from(repo.save(p));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> list() {
        return repo.findAll().stream().map(ProductResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse get(UUID id) {
        return repo.findById(id).map(ProductResponse::from)
            .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
    }

    public void delete(UUID id) {
        Product p = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        p.softDelete(ctx.userId());
    }
}
