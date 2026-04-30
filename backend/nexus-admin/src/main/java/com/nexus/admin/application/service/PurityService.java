package com.nexus.admin.application.service;

import com.nexus.admin.application.dto.PurityRequest;
import com.nexus.admin.application.dto.PurityResponse;
import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.Product;
import com.nexus.admin.domain.model.PurityCatalogEntry;
import com.nexus.admin.domain.repository.PurityCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class PurityService {

    private final PurityCatalogRepository repo;
    private final CurrentContext ctx;

    public PurityResponse create(PurityRequest r) {
        UUID tenant = ctx.tenantId();
        repo.findByTenantIdAndLabel(tenant, r.label()).ifPresent(p -> {
            throw new IllegalArgumentException("Purity label already exists: " + r.label());
        });
        var threshold = r.finenessThreshold() != null
            ? r.finenessThreshold()
            : PurityCatalogEntry.computeThreshold(r.label());
        PurityCatalogEntry p = PurityCatalogEntry.builder()
            .label(r.label())
            .finenessThreshold(threshold)
            .metal(r.metal() != null ? r.metal() : Product.Metal.GOLD)
            .build();
        p.setTenantId(tenant);
        p.setCreatedBy(ctx.userId());
        p.setUpdatedBy(ctx.userId());
        return PurityResponse.from(repo.save(p));
    }

    @Transactional(readOnly = true)
    public List<PurityResponse> list() {
        return repo.findAll().stream().map(PurityResponse::from).toList();
    }

    public void delete(UUID id) {
        PurityCatalogEntry p = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Purity not found: " + id));
        // Per PDF rule: a purity value cannot be deleted if any item references it.
        // Cross-module reference checks live in those modules; here we soft-delete.
        p.softDelete(ctx.userId());
    }
}
