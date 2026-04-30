package com.nexus.common.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable domain event — the backbone of event sourcing in NEXUS.
 * Every state change is captured as an event for audit trail and replay.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DomainEvent {

    private UUID eventId;
    private String eventType;
    private String aggregateType;
    private UUID aggregateId;
    private UUID tenantId;
    private UUID userId;
    private Instant timestamp;
    private int sequenceNumber;
    private String payload;    // JSON serialized event data
    private Map<String, String> metadata;

    public static DomainEvent create(String eventType, String aggregateType,
                                     UUID aggregateId, UUID tenantId,
                                     UUID userId, String payload) {
        return DomainEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .tenantId(tenantId)
                .userId(userId)
                .timestamp(Instant.now())
                .payload(payload)
                .build();
    }
}
