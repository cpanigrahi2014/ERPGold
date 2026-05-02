package com.nexus.laser.domain.repository;

import com.nexus.laser.domain.model.LaserTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface LaserTransactionRepository extends JpaRepository<LaserTransaction, UUID> {
    List<LaserTransaction> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<LaserTransaction> findByTenantIdAndTypeOrderByCreatedAtDesc(UUID tenantId, LaserTransaction.Type type);
    List<LaserTransaction> findByTenantIdAndJobIdOrderByCreatedAtDesc(UUID tenantId, UUID jobId);
}
