package com.nexus.common.security;

/**
 * Thread-local holder for tenant context.
 * Set by security filter, used by repositories for RLS scoping.
 */
public final class TenantContextHolder {

    private static final ThreadLocal<TenantContext> CONTEXT = new ThreadLocal<>();

    private TenantContextHolder() {}

    public static void set(TenantContext context) {
        CONTEXT.set(context);
    }

    public static TenantContext get() {
        TenantContext context = CONTEXT.get();
        if (context == null) {
            throw new IllegalStateException("No TenantContext available. Ensure authentication filter is active.");
        }
        return context;
    }

    public static TenantContext getOptional() {
        return CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
