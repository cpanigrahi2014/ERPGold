package com.nexus.hm.domain.repository;

import com.nexus.hm.domain.model.HmDeliveryReturn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HmDeliveryReturnRepository extends JpaRepository<HmDeliveryReturn, UUID> {
    List<HmDeliveryReturn> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
