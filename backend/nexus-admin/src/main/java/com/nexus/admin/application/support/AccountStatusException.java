package com.nexus.admin.application.support;

/**
 * Thrown when login is rejected for a status reason (PENDING / REJECTED / DISABLED)
 * rather than for invalid credentials. Carries a stable {@code code} so the
 * frontend can show the appropriate message and CTA (e.g. "wait for approval").
 */
public class AccountStatusException extends RuntimeException {

    private final String code;

    public AccountStatusException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() { return code; }
}
