package com.nexus.records.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_log", indexes = {
    @Index(name = "ix_al_at",     columnList = "tenant_id, occurred_at"),
    @Index(name = "ix_al_actor",  columnList = "tenant_id, actor_id"),
    @Index(name = "ix_al_entity", columnList = "tenant_id, entity_type, entity_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog extends BaseEntity {

    @Column(name = "occurred_at", nullable = false) private OffsetDateTime occurredAt;

    @Enumerated(EnumType.STRING) @Column(name = "module", nullable = false, length = 30)
    private DayBookEntry.Module module;

    @Column(name = "action",      nullable = false, length = 60) private String action;
    @Column(name = "entity_type", length = 60) private String entityType;
    @Column(name = "entity_id") private UUID entityId;
    @Column(name = "actor_id") private UUID actorId;
    @Column(name = "actor_name", length = 200) private String actorName;
    @Column(name = "ip_address", length = 60) private String ipAddress;
    @Column(name = "summary",    length = 500) private String summary;

    @Column(name = "before_json", columnDefinition = "TEXT") private String beforeJson;
    @Column(name = "after_json",  columnDefinition = "TEXT") private String afterJson;
}
