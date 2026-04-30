package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BranchRepository extends JpaRepository<Branch, UUID> {
    Optional<Branch> findByTenantIdAndCode(UUID tenantId, String code);
}
