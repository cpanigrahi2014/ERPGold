package com.nexus.refinery.domain.repository;

import com.nexus.refinery.domain.model.RefineryOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RefineryOrderRepository extends JpaRepository<RefineryOrder, UUID> {
    List<RefineryOrder> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<RefineryOrder> findByTenantIdAndStatusOrderByCreatedAtDesc(UUID tenantId, RefineryOrder.Status status);
}
