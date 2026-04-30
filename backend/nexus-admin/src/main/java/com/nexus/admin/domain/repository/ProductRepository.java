package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    Optional<Product> findByTenantIdAndCode(UUID tenantId, String code);
}
