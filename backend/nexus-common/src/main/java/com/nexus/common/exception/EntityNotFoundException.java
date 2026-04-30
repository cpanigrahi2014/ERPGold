package com.nexus.common.exception;

import java.util.UUID;

public class EntityNotFoundException extends RuntimeException {
    public EntityNotFoundException(String entityType, UUID id) {
        super(String.format("%s not found with id: %s", entityType, id));
    }

    public EntityNotFoundException(String entityType, String identifier) {
        super(String.format("%s not found: %s", entityType, identifier));
    }
}
