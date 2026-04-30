package com.nexus.notifications.domain.repository;

import com.nexus.notifications.domain.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findTop200ByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<Notification> findByTenantIdAndStatusOrderByCreatedAtDesc(UUID tenantId, Notification.Status status);
    List<Notification> findTop50ByStatusAndAttemptsLessThanOrderByCreatedAtAsc(Notification.Status status, int maxAttempts);
}
