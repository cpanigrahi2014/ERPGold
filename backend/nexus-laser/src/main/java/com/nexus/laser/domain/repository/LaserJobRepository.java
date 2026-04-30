package com.nexus.laser.domain.repository;

import com.nexus.laser.domain.model.LaserJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaserJobRepository extends JpaRepository<LaserJob, UUID> {
    List<LaserJob> findByTenantIdOrderByReceivedDateDesc(UUID tenantId);
    List<LaserJob> findByTenantIdAndStatusOrderByReceivedDateDesc(UUID tenantId, LaserJob.Status status);
}
