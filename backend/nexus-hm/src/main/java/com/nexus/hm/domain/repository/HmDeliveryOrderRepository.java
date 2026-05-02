package com.nexus.hm.domain.repository;

import com.nexus.hm.domain.model.HmDeliveryOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HmDeliveryOrderRepository extends JpaRepository<HmDeliveryOrder, UUID> {
    List<HmDeliveryOrder> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<HmDeliveryOrder> findByTenantIdAndStatusOrderByCreatedAtDesc(UUID tenantId, HmDeliveryOrder.Status status);
}
