package com.nexus.notifications.application.dto;

import com.nexus.notifications.domain.model.DeliveryAttempt;
import com.nexus.notifications.domain.model.Notification;
import com.nexus.notifications.domain.model.NotificationTemplate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public class NotificationsDtos {

    public record TemplateRequest(
        @NotBlank String code, @NotBlank String name,
        @NotNull NotificationTemplate.Channel channel,
        String subjectTpl, @NotBlank String bodyTpl,
        Boolean active, String description
    ) {}

    public record TemplateResponse(
        UUID id, String code, String name,
        NotificationTemplate.Channel channel,
        String subjectTpl, String bodyTpl,
        Boolean active, String description
    ) {}

    public record SendRequest(
        String templateCode,
        NotificationTemplate.Channel channel,
        @NotBlank String recipient,
        String recipientName,
        String subject, String body,
        Map<String,Object> context,
        String sourceModule, String sourceRef
    ) {}

    public record NotificationResponse(
        UUID id, String templateCode,
        NotificationTemplate.Channel channel,
        String recipient, String recipientName,
        String subject, String body,
        String sourceModule, String sourceRef,
        Notification.Status status,
        Integer attempts,
        OffsetDateTime lastAttemptAt, OffsetDateTime sentAt,
        String lastError, Instant createdAt
    ) {}

    public record AttemptResponse(
        UUID id, UUID notificationId,
        int attemptNo, OffsetDateTime attemptedAt,
        DeliveryAttempt.Result result,
        String provider, String providerRef,
        String responseMessage, Long durationMs
    ) {}
}
