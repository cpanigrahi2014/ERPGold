package com.nexus.refinery.domain.repository;

import com.nexus.refinery.domain.model.RefineryBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RefineryBatchRepository extends JpaRepository<RefineryBatch, UUID> {
    List<RefineryBatch> findByTenantIdOrderByStartDateDesc(UUID tenantId);
    List<RefineryBatch> findByTenantIdAndStatusOrderByStartDateDesc(UUID tenantId, RefineryBatch.Status status);
}
