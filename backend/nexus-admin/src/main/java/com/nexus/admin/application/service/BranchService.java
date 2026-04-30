package com.nexus.admin.application.service;

import com.nexus.admin.application.dto.BranchRequest;
import com.nexus.admin.application.dto.BranchResponse;
import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.Branch;
import com.nexus.admin.domain.repository.BranchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class BranchService {

    private final BranchRepository repo;
    private final CurrentContext ctx;

    public BranchResponse create(BranchRequest r) {
        UUID tenant = ctx.tenantId();
        repo.findByTenantIdAndCode(tenant, r.code()).ifPresent(b -> {
            throw new IllegalArgumentException("Branch code already exists: " + r.code());
        });
        Branch b = Branch.builder()
            .code(r.code()).name(r.name()).invoiceCode(r.invoiceCode())
            .addressLine1(r.addressLine1()).addressLine2(r.addressLine2())
            .city(r.city()).state(r.state()).postalCode(r.postalCode())
            .country(r.country() != null ? r.country() : "IN")
            .gstin(r.gstin()).phone(r.phone()).email(r.email())
            .build();
        if (r.handLossPct() != null) b.setHandLossPct(r.handLossPct());
        if (r.goldLossPct() != null) b.setGoldLossPct(r.goldLossPct());
        if (r.acidLossPct() != null) b.setAcidLossPct(r.acidLossPct());
        if (r.marketValuePct() != null) b.setMarketValuePct(r.marketValuePct());
        if (r.finenessTolerance() != null) b.setFinenessTolerance(r.finenessTolerance());
        b.setTenantId(tenant);
        b.setCreatedBy(ctx.userId());
        b.setUpdatedBy(ctx.userId());
        return BranchResponse.from(repo.save(b));
    }

    @Transactional(readOnly = true)
    public List<BranchResponse> list() {
        return repo.findAll().stream().map(BranchResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public BranchResponse get(UUID id) {
        return repo.findById(id).map(BranchResponse::from)
            .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + id));
    }

    public BranchResponse update(UUID id, BranchRequest r) {
        Branch b = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + id));
        b.setName(r.name());
        b.setInvoiceCode(r.invoiceCode());
        b.setAddressLine1(r.addressLine1()); b.setAddressLine2(r.addressLine2());
        b.setCity(r.city()); b.setState(r.state()); b.setPostalCode(r.postalCode());
        if (r.country() != null) b.setCountry(r.country());
        b.setGstin(r.gstin()); b.setPhone(r.phone()); b.setEmail(r.email());
        if (r.handLossPct() != null) b.setHandLossPct(r.handLossPct());
        if (r.goldLossPct() != null) b.setGoldLossPct(r.goldLossPct());
        if (r.acidLossPct() != null) b.setAcidLossPct(r.acidLossPct());
        if (r.marketValuePct() != null) b.setMarketValuePct(r.marketValuePct());
        if (r.finenessTolerance() != null) b.setFinenessTolerance(r.finenessTolerance());
        b.setUpdatedBy(ctx.userId());
        return BranchResponse.from(b);
    }

    public void delete(UUID id) {
        Branch b = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + id));
        b.softDelete(ctx.userId());
    }
}
