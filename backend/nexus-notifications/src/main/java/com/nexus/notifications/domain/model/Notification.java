package com.nexus.notifications.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "ix_n_status",  columnList = "tenant_id, status"),
    @Index(name = "ix_n_created", columnList = "tenant_id, created_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification extends BaseEntity {

    @Column(name = "template_id") private UUID templateId;
    @Column(name = "template_code", length = 60) private String templateCode;

    @Enumerated(EnumType.STRING) @Column(name = "channel", nullable = false, length = 20)
    private NotificationTemplate.Channel channel;

    @Column(name = "recipient", nullable = false, length = 300) private String recipient;
    @Column(name = "recipient_name", length = 200) private String recipientName;
    @Column(name = "subject", length = 300) private String subject;
    @Column(name = "body", columnDefinition = "TEXT", nullable = false) private String body;

    @Column(name = "context_json", columnDefinition = "TEXT") private String contextJson;
    @Column(name = "source_module", length = 30) private String sourceModule;
    @Column(name = "source_ref",    length = 60) private String sourceRef;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20)
    @Builder.Default private Status status = Status.PENDING;

    @Column(name = "attempts") @Builder.Default private Integer attempts = 0;
    @Column(name = "last_attempt_at") private OffsetDateTime lastAttemptAt;
    @Column(name = "sent_at")         private OffsetDateTime sentAt;
    @Column(name = "last_error", length = 500) private String lastError;

    public enum Status { PENDING, SENT, FAILED, CANCELLED }
}
