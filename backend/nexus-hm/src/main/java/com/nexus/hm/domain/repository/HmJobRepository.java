package com.nexus.hm.domain.repository;

import com.nexus.hm.domain.model.HmJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HmJobRepository extends JpaRepository<HmJob, UUID> {
    List<HmJob> findByTenantIdOrderByReceivedDateDesc(UUID tenantId);
    List<HmJob> findByTenantIdAndStatusOrderByReceivedDateDesc(UUID tenantId, HmJob.Status status);
}
