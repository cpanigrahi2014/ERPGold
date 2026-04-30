package com.nexus.exchange.application.support;

import com.nexus.common.security.TenantContext;
import com.nexus.common.security.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentContext {
    @Value("${nexus.exchange.default-tenant-id}") private UUID defaultTenantId;
    @Value("${nexus.exchange.system-user-id}") private UUID systemUserId;
    public UUID tenantId() {
        TenantContext c = TenantContextHolder.getOptional();
        return (c != null && c.getTenantId() != null) ? c.getTenantId() : defaultTenantId;
    }
    public UUID userId() {
        TenantContext c = TenantContextHolder.getOptional();
        return (c != null && c.getUserId() != null) ? c.getUserId() : systemUserId;
    }
}
