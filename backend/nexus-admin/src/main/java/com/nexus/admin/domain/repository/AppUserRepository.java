package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByEmail(String email);
    Optional<AppUser> findByTenantIdAndEmail(UUID tenantId, String email);
}
