package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.BillingScrapLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface BillingScrapLogRepository extends JpaRepository<BillingScrapLog, UUID> {
    List<BillingScrapLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<BillingScrapLog> findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(UUID tenantId, Instant from, Instant to);
}
