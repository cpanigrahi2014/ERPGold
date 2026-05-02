package com.nexus.inventory.application.service;

import com.nexus.inventory.application.dto.MovementRequest;
import com.nexus.inventory.application.dto.MovementResponse;
import com.nexus.inventory.application.support.CurrentContext;
import com.nexus.inventory.domain.model.Lot;
import com.nexus.inventory.domain.model.StockMovement;
import com.nexus.inventory.domain.repository.LotRepository;
import com.nexus.inventory.domain.repository.StockMovementRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StockMovementService {

    private final StockMovementRepository movRepo;
    private final LotRepository lotRepo;
    private final CurrentContext ctx;

    public List<MovementResponse> ledger(UUID lotId) {
        return movRepo.findByLotIdOrderByOccurredAtDesc(lotId).stream()
            .map(MovementResponse::from).toList();
    }

    public List<MovementResponse> listAll() {
        return movRepo.findByTenantIdOrderByOccurredAtDesc(ctx.tenantId()).stream()
            .map(MovementResponse::from).toList();
    }

    @Transactional
    public MovementResponse create(MovementRequest r) {
        Lot lot = lotRepo.findById(r.lotId())
            .orElseThrow(() -> new EntityNotFoundException("Lot not found: " + r.lotId()));

        StockMovement m = StockMovement.builder()
            .lotId(r.lotId()).type(r.type())
            .fromLocationId(r.fromLocationId()).toLocationId(r.toLocationId())
            .quantity(r.quantity())
            .referenceType(r.referenceType()).referenceId(r.referenceId())
            .remarks(r.remarks())
            .build();
        m.setTenantId(ctx.tenantId());
        m.setCreatedBy(ctx.userId());
        m.setUpdatedBy(ctx.userId());

        // Update lot's current location for TRANSFER / OUT / IN
        if (r.type() == StockMovement.Type.TRANSFER || r.type() == StockMovement.Type.IN) {
            if (r.toLocationId() != null) {
                lot.setCurrentLocationId(r.toLocationId());
                lot.setUpdatedBy(ctx.userId());
                lotRepo.save(lot);
            }
        }
        return MovementResponse.from(movRepo.save(m));
    }
}
