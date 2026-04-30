package com.nexus.notifications.domain.repository;

import com.nexus.notifications.domain.model.DeliveryAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeliveryAttemptRepository extends JpaRepository<DeliveryAttempt, UUID> {
    List<DeliveryAttempt> findByNotificationIdOrderByAttemptNoAsc(UUID notificationId);
}
