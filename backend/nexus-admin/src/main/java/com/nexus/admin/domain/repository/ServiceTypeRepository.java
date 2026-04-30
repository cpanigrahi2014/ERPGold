package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.ServiceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ServiceTypeRepository extends JpaRepository<ServiceType, UUID> {
    Optional<ServiceType> findByTenantIdAndCode(UUID tenantId, String code);
}
