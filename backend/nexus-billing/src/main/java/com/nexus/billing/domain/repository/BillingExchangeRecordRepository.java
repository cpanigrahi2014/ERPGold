package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.BillingExchangeRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface BillingExchangeRecordRepository extends JpaRepository<BillingExchangeRecord, UUID> {
    List<BillingExchangeRecord> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<BillingExchangeRecord> findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(UUID tenantId, Instant from, Instant to);
}
