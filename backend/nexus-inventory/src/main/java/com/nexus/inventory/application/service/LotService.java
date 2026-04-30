package com.nexus.inventory.application.service;

import com.nexus.inventory.application.dto.LotRequest;
import com.nexus.inventory.application.dto.LotResponse;
import com.nexus.inventory.application.dto.SplitRequest;
import com.nexus.inventory.application.support.CurrentContext;
import com.nexus.inventory.domain.model.Lot;
import com.nexus.inventory.domain.model.StockMovement;
import com.nexus.inventory.domain.repository.LotRepository;
import com.nexus.inventory.domain.repository.StockMovementRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class LotService {

    private final LotRepository lotRepo;
    private final StockMovementRepository movRepo;
    private final CurrentContext ctx;

    private static final AtomicLong SEQ = new AtomicLong(System.currentTimeMillis() % 100000);

    public List<LotResponse> list() {
        return lotRepo.findAll().stream().map(LotResponse::from).toList();
    }

    public List<LotResponse> listByStatus(Lot.Status status) {
        return lotRepo.findByTenantIdAndStatusOrderByReceivedDateDesc(ctx.tenantId(), status)
            .stream().map(LotResponse::from).toList();
    }

    public LotResponse get(UUID id) {
        return lotRepo.findById(id).map(LotResponse::from)
            .orElseThrow(() -> new EntityNotFoundException("Lot not found: " + id));
    }

    @Transactional
    public LotResponse create(LotRequest r) {
        BigDecimal net = r.netWeight() != null ? r.netWeight() : r.grossWeight();
        BigDecimal fine = r.declaredFineness() != null
            ? net.multiply(r.declaredFineness()).divide(BigDecimal.valueOf(1000), 4, RoundingMode.HALF_UP)
            : null;

        Lot lot = Lot.builder()
            .lotNumber(r.lotNumber() != null ? r.lotNumber() : nextLotNumber())
            .branchId(r.branchId())
            .customerId(r.customerId())
            .currentLocationId(r.currentLocationId())
            .metal(r.metal())
            .purityLabel(r.purityLabel())
            .declaredFineness(r.declaredFineness())
            .grossWeight(r.grossWeight())
            .netWeight(net)
            .fineWeight(fine)
            .receivedDate(r.receivedDate() != null ? r.receivedDate() : LocalDate.now())
            .status(Lot.Status.RECEIVED)
            .remarks(r.remarks())
            .build();
        stamp(lot);
        Lot saved = lotRepo.save(lot);

        // Initial IN movement
        StockMovement m = StockMovement.builder()
            .lotId(saved.getId())
            .type(StockMovement.Type.IN)
            .toLocationId(r.currentLocationId())
            .quantity(r.grossWeight())
            .referenceType("RECEIPT")
            .referenceId(saved.getId())
            .remarks("Lot received")
            .build();
        stamp(m);
        movRepo.save(m);

        return LotResponse.from(saved);
    }

    @Transactional
    public LotResponse updateStatus(UUID id, Lot.Status status) {
        Lot l = lotRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Lot not found: " + id));
        l.setStatus(status);
        l.setUpdatedBy(ctx.userId());
        return LotResponse.from(lotRepo.save(l));
    }

    @Transactional
    public LotResponse setAssayedFineness(UUID id, BigDecimal fineness) {
        Lot l = lotRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Lot not found: " + id));
        l.setAssayedFineness(fineness);
        if (l.getNetWeight() != null) {
            l.setFineWeight(l.getNetWeight().multiply(fineness)
                .divide(BigDecimal.valueOf(1000), 4, RoundingMode.HALF_UP));
        }
        l.setUpdatedBy(ctx.userId());
        return LotResponse.from(lotRepo.save(l));
    }

    @Transactional
    public List<LotResponse> split(SplitRequest req) {
        Lot parent = lotRepo.findById(req.lotId())
            .orElseThrow(() -> new EntityNotFoundException("Lot not found: " + req.lotId()));
        BigDecimal totalChild = req.childWeights().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalChild.compareTo(parent.getGrossWeight()) > 0) {
            throw new IllegalArgumentException("Sum of child weights " + totalChild
                + " exceeds parent weight " + parent.getGrossWeight());
        }

        List<LotResponse> children = new ArrayList<>();
        for (BigDecimal w : req.childWeights()) {
            Lot child = Lot.builder()
                .lotNumber(parent.getLotNumber() + "-" + (children.size() + 1))
                .branchId(parent.getBranchId())
                .customerId(parent.getCustomerId())
                .currentLocationId(parent.getCurrentLocationId())
                .metal(parent.getMetal())
                .purityLabel(parent.getPurityLabel())
                .declaredFineness(parent.getDeclaredFineness())
                .assayedFineness(parent.getAssayedFineness())
                .grossWeight(w)
                .netWeight(w)
                .fineWeight(parent.getAssayedFineness() != null
                    ? w.multiply(parent.getAssayedFineness())
                        .divide(BigDecimal.valueOf(1000), 4, RoundingMode.HALF_UP)
                    : null)
                .receivedDate(LocalDate.now())
                .status(parent.getStatus())
                .parentLotId(parent.getId())
                .build();
            stamp(child);
            children.add(LotResponse.from(lotRepo.save(child)));

            StockMovement m = StockMovement.builder()
                .lotId(child.getId()).type(StockMovement.Type.SPLIT)
                .toLocationId(parent.getCurrentLocationId()).quantity(w)
                .referenceType("SPLIT").referenceId(parent.getId()).build();
            stamp(m);
            movRepo.save(m);
        }
        // close parent if fully split
        if (totalChild.compareTo(parent.getGrossWeight()) == 0) {
            parent.setStatus(Lot.Status.CLOSED);
            parent.setUpdatedBy(ctx.userId());
            lotRepo.save(parent);
        }
        return children;
    }

    private String nextLotNumber() {
        return "LOT-" + LocalDate.now().toString().replace("-", "") + "-"
            + String.format("%05d", SEQ.incrementAndGet() % 100000);
    }

    private void stamp(com.nexus.common.domain.BaseEntity e) {
        e.setTenantId(ctx.tenantId());
        e.setCreatedBy(ctx.userId());
        e.setUpdatedBy(ctx.userId());
    }
}
