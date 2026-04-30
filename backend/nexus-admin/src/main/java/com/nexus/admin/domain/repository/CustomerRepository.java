package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findByTenantIdAndCustomerNumber(UUID tenantId, String customerNumber);
}
