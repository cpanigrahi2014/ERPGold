package com.nexus.common.event;

import com.nexus.common.domain.DomainEvent;

/**
 * Interface for publishing domain events to the event bus (Kafka).
 */
public interface EventPublisher {

    void publish(DomainEvent event);

    void publish(String topic, DomainEvent event);
}
