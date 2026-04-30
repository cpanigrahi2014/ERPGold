package com.nexus.inventory.domain.repository;

import com.nexus.inventory.domain.model.StockLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StockLocationRepository extends JpaRepository<StockLocation, UUID> {
    List<StockLocation> findByTenantIdAndBranchId(UUID tenantId, UUID branchId);
}
