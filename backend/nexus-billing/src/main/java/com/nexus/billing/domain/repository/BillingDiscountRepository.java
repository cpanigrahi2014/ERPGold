package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.BillingDiscount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BillingDiscountRepository extends JpaRepository<BillingDiscount, UUID> {
    List<BillingDiscount> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
