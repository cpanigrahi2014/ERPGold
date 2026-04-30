package com.nexus.testing.domain.repository;

import com.nexus.testing.domain.model.TestingJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TestingJobRepository extends JpaRepository<TestingJob, UUID> {
    List<TestingJob> findByTenantIdOrderByReceivedDateDesc(UUID tenantId);
    List<TestingJob> findByTenantIdAndStatusOrderByReceivedDateDesc(UUID tenantId, TestingJob.Status status);
    long countByTenantIdAndStatus(UUID tenantId, TestingJob.Status status);
}
