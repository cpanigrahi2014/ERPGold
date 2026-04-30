package com.nexus.admin.application.service;

import com.nexus.admin.application.dto.RateSetupRequest;
import com.nexus.admin.application.dto.RateSetupResponse;
import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.Branch;
import com.nexus.admin.domain.model.Customer;
import com.nexus.admin.domain.model.RateSetup;
import com.nexus.admin.domain.model.ServiceType;
import com.nexus.admin.domain.repository.BranchRepository;
import com.nexus.admin.domain.repository.CustomerRepository;
import com.nexus.admin.domain.repository.RateSetupRepository;
import com.nexus.admin.domain.repository.ServiceTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class RateSetupService {

    private final RateSetupRepository repo;
    private final BranchRepository branchRepo;
    private final CustomerRepository customerRepo;
    private final ServiceTypeRepository serviceTypeRepo;
    private final CurrentContext ctx;

    public RateSetupResponse create(RateSetupRequest r) {
        UUID tenant = ctx.tenantId();
        Branch branch = branchRepo.findById(r.branchId())
            .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + r.branchId()));
        Customer customer = null;
        if (r.customerId() != null) {
            customer = customerRepo.findById(r.customerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + r.customerId()));
        }
        ServiceType st = serviceTypeRepo.findById(r.serviceTypeId())
            .orElseThrow(() -> new IllegalArgumentException("Service type not found: " + r.serviceTypeId()));

        RateSetup rs = RateSetup.builder()
            .branch(branch).customer(customer).serviceType(st)
            .rate(r.rate())
            .rateBasis(r.rateBasis() != null ? r.rateBasis() : RateSetup.RateBasis.PER_PIECE)
            .effectiveFrom(r.effectiveFrom() != null ? r.effectiveFrom() : LocalDate.now())
            .effectiveTo(r.effectiveTo())
            .build();
        rs.setTenantId(tenant);
        rs.setCreatedBy(ctx.userId());
        rs.setUpdatedBy(ctx.userId());
        return RateSetupResponse.from(repo.save(rs));
    }

    @Transactional(readOnly = true)
    public List<RateSetupResponse> list() {
        return repo.findAll().stream().map(RateSetupResponse::from).toList();
    }

    /** Rate lookup: customer-specific, fallback to default. */
    @Transactional(readOnly = true)
    public Optional<BigDecimal> resolveRate(UUID branchId, UUID customerId,
                                            UUID serviceTypeId, LocalDate asOf) {
        return repo.findApplicable(ctx.tenantId(), branchId, customerId, serviceTypeId,
                asOf != null ? asOf : LocalDate.now())
            .map(RateSetup::getRate);
    }

    public void delete(UUID id) {
        RateSetup rs = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Rate not found: " + id));
        rs.softDelete(ctx.userId());
    }
}
