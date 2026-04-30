package com.nexus.inventory.web;

import com.nexus.inventory.application.dto.LotRequest;
import com.nexus.inventory.application.dto.LotResponse;
import com.nexus.inventory.application.dto.SplitRequest;
import com.nexus.inventory.application.service.LotService;
import com.nexus.inventory.domain.model.Lot;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory/lots")
@RequiredArgsConstructor
public class LotController {

    private final LotService service;

    @GetMapping
    public List<LotResponse> list(@RequestParam(required = false) Lot.Status status) {
        return status != null ? service.listByStatus(status) : service.list();
    }

    @GetMapping("/{id}") public LotResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ResponseEntity<LotResponse> create(@Valid @RequestBody LotRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }

    @PatchMapping("/{id}/status")
    public LotResponse updateStatus(@PathVariable UUID id, @RequestParam Lot.Status status) {
        return service.updateStatus(id, status);
    }

    @PatchMapping("/{id}/assayed-fineness")
    public LotResponse setAssayedFineness(@PathVariable UUID id, @RequestParam BigDecimal value) {
        return service.setAssayedFineness(id, value);
    }

    @PostMapping("/split")
    public List<LotResponse> split(@Valid @RequestBody SplitRequest req) {
        return service.split(req);
    }
}
