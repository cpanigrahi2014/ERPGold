package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.BillingScrapMonthlyValidation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BillingScrapMonthlyValidationRepository extends JpaRepository<BillingScrapMonthlyValidation, UUID> {
    List<BillingScrapMonthlyValidation> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<BillingScrapMonthlyValidation> findByTenantIdAndYearAndMonthOrderByCreatedAtDesc(UUID tenantId, Integer year, Integer month);
    Optional<BillingScrapMonthlyValidation> findByTenantIdAndYearAndMonth(UUID tenantId, Integer year, Integer month);
}
