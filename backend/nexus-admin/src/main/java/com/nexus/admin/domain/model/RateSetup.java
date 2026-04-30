package com.nexus.admin.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Rate setup — service pricing per branch + service.
 * customer_id = NULL means the default rate (used as fallback when no
 * customer-specific rate exists, per Billing module rule #37).
 */
@Entity
@Table(name = "rate_setups", indexes = {
    @Index(name = "ix_rate_lookup", columnList = "tenant_id,branch_id,customer_id,service_type_id,effective_from")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RateSetup extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    /** NULL = default rate for the branch + service. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_type_id", nullable = false)
    private ServiceType serviceType;

    @Column(name = "rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal rate;

    @Enumerated(EnumType.STRING)
    @Column(name = "rate_basis", nullable = false, length = 20)
    @Builder.Default
    private RateBasis rateBasis = RateBasis.PER_PIECE;

    @Column(name = "effective_from", nullable = false)
    @Builder.Default
    private LocalDate effectiveFrom = LocalDate.now();

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    public enum RateBasis { PER_PIECE, PER_GRAM, PER_LOT, FLAT }
}
