package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.CustomerDeposit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomerDepositRepository extends JpaRepository<CustomerDeposit, UUID> {
    List<CustomerDeposit> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<CustomerDeposit> findByTenantIdAndCustomerIdAndBranchCodeOrderByCreatedAtAsc(UUID tenantId, String customerId, String branchCode);
}
