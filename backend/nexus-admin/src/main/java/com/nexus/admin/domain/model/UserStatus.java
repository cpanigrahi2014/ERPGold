package com.nexus.admin.domain.model;

/**
 * Lifecycle status of an {@link AppUser} account.
 *
 * <ul>
 *   <li>{@link #PENDING}  &mdash; user self-registered, waiting for admin approval. Cannot log in.</li>
 *   <li>{@link #APPROVED} &mdash; admin approved + assigned roles. Can log in.</li>
 *   <li>{@link #REJECTED} &mdash; admin rejected. Cannot log in.</li>
 *   <li>{@link #DISABLED} &mdash; previously approved user disabled by admin. Cannot log in.</li>
 * </ul>
 */
public enum UserStatus {
    PENDING,
    APPROVED,
    REJECTED,
    DISABLED
}
