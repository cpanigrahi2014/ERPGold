package com.nexus.inventory.application.service;

import com.nexus.inventory.application.dto.StockLocationRequest;
import com.nexus.inventory.application.dto.StockLocationResponse;
import com.nexus.inventory.application.support.CurrentContext;
import com.nexus.inventory.domain.model.StockLocation;
import com.nexus.inventory.domain.repository.StockLocationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StockLocationService {

    private final StockLocationRepository repo;
    private final CurrentContext ctx;

    public List<StockLocationResponse> list() {
        return repo.findAll().stream().map(StockLocationResponse::from).toList();
    }

    public StockLocationResponse get(UUID id) {
        return repo.findById(id).map(StockLocationResponse::from)
            .orElseThrow(() -> new EntityNotFoundException("Location not found: " + id));
    }

    @Transactional
    public StockLocationResponse create(StockLocationRequest r) {
        StockLocation s = StockLocation.builder()
            .branchId(r.branchId()).code(r.code()).name(r.name()).kind(r.kind())
            .active(true).build();
        s.setTenantId(ctx.tenantId());
        s.setCreatedBy(ctx.userId());
        s.setUpdatedBy(ctx.userId());
        return StockLocationResponse.from(repo.save(s));
    }

    @Transactional
    public void delete(UUID id) {
        StockLocation s = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Location not found: " + id));
        s.softDelete(ctx.userId());
        repo.save(s);
    }
}
