package com.nexus.inventory.web;

import com.nexus.inventory.application.dto.MovementRequest;
import com.nexus.inventory.application.dto.MovementResponse;
import com.nexus.inventory.application.service.StockMovementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory/movements")
@RequiredArgsConstructor
public class StockMovementController {

    private final StockMovementService service;

    @GetMapping
    public List<MovementResponse> list(@RequestParam UUID lotId) {
        return service.ledger(lotId);
    }

    @PostMapping
    public ResponseEntity<MovementResponse> create(@Valid @RequestBody MovementRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }
}
