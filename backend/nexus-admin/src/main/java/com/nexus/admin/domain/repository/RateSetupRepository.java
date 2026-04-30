package com.nexus.admin.domain.repository;

import com.nexus.admin.domain.model.RateSetup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RateSetupRepository extends JpaRepository<RateSetup, UUID> {

    /**
     * Customer-first rate lookup: customer-specific rate, else default (customer is null).
     */
    @Query("""
        SELECT r FROM RateSetup r
        WHERE r.tenantId = :tenantId
          AND r.branch.id = :branchId
          AND r.serviceType.id = :serviceTypeId
          AND r.active = true
          AND (r.customer.id = :customerId OR r.customer IS NULL)
          AND r.effectiveFrom <= :asOf
          AND (r.effectiveTo IS NULL OR r.effectiveTo >= :asOf)
        ORDER BY CASE WHEN r.customer.id = :customerId THEN 0 ELSE 1 END,
                 r.effectiveFrom DESC
    """)
    List<RateSetup> lookup(@Param("tenantId") UUID tenantId,
                           @Param("branchId") UUID branchId,
                           @Param("customerId") UUID customerId,
                           @Param("serviceTypeId") UUID serviceTypeId,
                           @Param("asOf") LocalDate asOf);

    default Optional<RateSetup> findApplicable(UUID tenantId, UUID branchId,
                                               UUID customerId, UUID serviceTypeId,
                                               LocalDate asOf) {
        return lookup(tenantId, branchId, customerId, serviceTypeId, asOf)
                .stream().findFirst();
    }
}
