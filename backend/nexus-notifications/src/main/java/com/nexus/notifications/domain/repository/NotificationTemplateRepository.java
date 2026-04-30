package com.nexus.notifications.domain.repository;

import com.nexus.notifications.domain.model.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, UUID> {
    List<NotificationTemplate> findByTenantIdOrderByCodeAsc(UUID tenantId);
    Optional<NotificationTemplate> findByTenantIdAndCode(UUID tenantId, String code);
}
