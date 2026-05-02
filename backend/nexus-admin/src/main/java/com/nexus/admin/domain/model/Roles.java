package com.nexus.admin.domain.model;

import java.util.Set;

/**
 * Canonical role catalog for NEXUS ERP, aligned with the desks defined in the
 * Module Functionality spec. Stored on {@link AppUser} as plain {@code String}s
 * (legacy {@code app_user_roles} table) so that ad-hoc roles remain possible,
 * but new code should reference these constants.
 */
public final class Roles {
    private Roles() {}

    // Cross-cutting
    public static final String ADMIN              = "ADMIN";
    public static final String SUPER_ADMIN        = "SUPER_ADMIN";
    public static final String MANAGER            = "MANAGER";
    public static final String VIEWER             = "VIEWER";

    // Hallmarking desks
    public static final String RECEPTIONIST       = "RECEPTIONIST";
    public static final String DELIVERY_PERSON    = "DELIVERY_PERSON";
    public static final String QUALITY_MANAGER    = "QUALITY_MANAGER";
    public static final String XRF_TECHNICIAN     = "XRF_TECHNICIAN";
    public static final String SAMPLING_TECHNICIAN= "SAMPLING_TECHNICIAN";
    public static final String FIRE_ASSAY_TECHNICIAN = "FIRE_ASSAY_TECHNICIAN";
    public static final String TITRATION_TECHNICIAN  = "TITRATION_TECHNICIAN";
    public static final String HUID_MARKER        = "HUID_MARKER";

    // Other modules
    public static final String LASER_OPERATOR     = "LASER_OPERATOR";
    public static final String REFINER            = "REFINER";
    public static final String INVENTORY_CLERK    = "INVENTORY_CLERK";
    public static final String BILLING_CLERK      = "BILLING_CLERK";

    // Legacy aliases (still referenced in some seed data / older modules)
    public static final String HM_OPERATOR        = "HM_OPERATOR";

    public static final Set<String> ALL = Set.of(
        ADMIN, SUPER_ADMIN, MANAGER, VIEWER,
        RECEPTIONIST, DELIVERY_PERSON, QUALITY_MANAGER,
        XRF_TECHNICIAN, SAMPLING_TECHNICIAN, FIRE_ASSAY_TECHNICIAN, TITRATION_TECHNICIAN,
        HUID_MARKER, LASER_OPERATOR, REFINER, INVENTORY_CLERK, BILLING_CLERK,
        HM_OPERATOR
    );

    /** Roles a user is allowed to request at self-registration (no privileged roles). */
    public static final Set<String> SELF_SERVICE_REQUESTABLE = Set.of(
        MANAGER, VIEWER,
        RECEPTIONIST, DELIVERY_PERSON, QUALITY_MANAGER,
        XRF_TECHNICIAN, SAMPLING_TECHNICIAN, FIRE_ASSAY_TECHNICIAN, TITRATION_TECHNICIAN,
        HUID_MARKER, LASER_OPERATOR, REFINER, INVENTORY_CLERK, BILLING_CLERK
    );
}
