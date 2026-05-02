package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.AppUser;
import com.nexus.admin.domain.model.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByEmail(String email);
    Optional<AppUser> findByTenantIdAndEmail(UUID tenantId, String email);
    List<AppUser> findByTenantIdAndStatus(UUID tenantId, UserStatus status);
    List<AppUser> findByTenantId(UUID tenantId);
    boolean existsByEmail(String email);
}
