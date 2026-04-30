package com.nexus.admin.application.support;

import com.nexus.common.security.TenantContext;
import com.nexus.common.security.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Resolves the current tenant + user. In standalone single-customer mode
 * (when no JWT is present) it falls back to the configured default tenant /
 * system user IDs so writes still satisfy the not-null audit columns.
 */
@Component
public class CurrentContext {

    private final UUID defaultTenantId;
    private final UUID systemUserId;

    public CurrentContext(@Value("${nexus.admin.default-tenant-id}") String tenantId,
                          @Value("${nexus.admin.system-user-id}") String userId) {
        this.defaultTenantId = UUID.fromString(tenantId);
        this.systemUserId = UUID.fromString(userId);
    }

    public UUID tenantId() {
        TenantContext ctx = TenantContextHolder.getOptional();
        return (ctx != null && ctx.getTenantId() != null) ? ctx.getTenantId() : defaultTenantId;
    }

    public UUID userId() {
        TenantContext ctx = TenantContextHolder.getOptional();
        return (ctx != null && ctx.getUserId() != null) ? ctx.getUserId() : systemUserId;
    }

    public UUID defaultTenantId() { return defaultTenantId; }
    public UUID systemUserId() { return systemUserId; }
}
