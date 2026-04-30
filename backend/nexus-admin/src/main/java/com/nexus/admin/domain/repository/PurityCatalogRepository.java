package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.PurityCatalogEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PurityCatalogRepository extends JpaRepository<PurityCatalogEntry, UUID> {
    Optional<PurityCatalogEntry> findByTenantIdAndLabel(UUID tenantId, String label);
}
