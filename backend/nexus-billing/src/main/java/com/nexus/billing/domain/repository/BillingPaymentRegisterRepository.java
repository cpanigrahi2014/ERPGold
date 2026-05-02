package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.BillingPaymentRegister;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BillingPaymentRegisterRepository extends JpaRepository<BillingPaymentRegister, UUID> {
    List<BillingPaymentRegister> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
