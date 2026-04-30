package com.nexus.notifications.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "delivery_attempts", indexes = {
    @Index(name = "ix_da_notif", columnList = "notification_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeliveryAttempt extends BaseEntity {

    @Column(name = "notification_id", nullable = false) private UUID notificationId;
    @Column(name = "attempt_no", nullable = false) private Integer attemptNo;
    @Column(name = "attempted_at", nullable = false) private OffsetDateTime attemptedAt;

    @Enumerated(EnumType.STRING) @Column(name = "result", nullable = false, length = 20)
    private Result result;

    @Column(name = "provider", length = 60) private String provider;
    @Column(name = "provider_ref", length = 200) private String providerRef;
    @Column(name = "response_message", length = 500) private String responseMessage;
    @Column(name = "duration_ms") private Long durationMs;

    public enum Result { SUCCESS, FAILED }
}
