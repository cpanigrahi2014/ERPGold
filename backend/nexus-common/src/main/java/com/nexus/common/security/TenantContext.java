package com.nexus.common.security;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;
import java.util.UUID;

/**
 * Represents the current authenticated user context.
 * Propagated through all service calls for tenant isolation and audit.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantContext {

    private UUID userId;
    private UUID tenantId;
    private String email;
    private String fullName;
    private Set<String> roles;
    private Set<String> permissions;
    private String locale;
    private String timezone;

    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }

    public boolean hasPermission(String permission) {
        return permissions != null && permissions.contains(permission);
    }

    public boolean isAdmin() {
        return hasRole("ADMIN") || hasRole("SUPER_ADMIN");
    }
}
