package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.ItemCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ItemCategoryRepository extends JpaRepository<ItemCategory, UUID> {
    Optional<ItemCategory> findByTenantIdAndCode(UUID tenantId, String code);
}
