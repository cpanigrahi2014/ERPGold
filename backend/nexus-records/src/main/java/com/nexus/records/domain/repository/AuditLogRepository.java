package com.nexus.records.domain.repository;

import com.nexus.records.domain.model.AuditLog;
import com.nexus.records.domain.model.DayBookEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findTop200ByTenantIdOrderByOccurredAtDesc(UUID tenantId);
    List<AuditLog> findByTenantIdAndModuleOrderByOccurredAtDesc(UUID tenantId, DayBookEntry.Module module);
    List<AuditLog> findByTenantIdAndOccurredAtBetweenOrderByOccurredAtDesc(UUID tenantId, OffsetDateTime from, OffsetDateTime to);
    List<AuditLog> findByTenantIdAndEntityTypeAndEntityIdOrderByOccurredAtDesc(UUID tenantId, String entityType, UUID entityId);
}
