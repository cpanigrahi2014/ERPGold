package com.nexus.inventory.web;

import com.nexus.inventory.application.dto.StockLocationRequest;
import com.nexus.inventory.application.dto.StockLocationResponse;
import com.nexus.inventory.application.service.StockLocationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory/locations")
@RequiredArgsConstructor
public class StockLocationController {

    private final StockLocationService service;

    @GetMapping public List<StockLocationResponse> list() { return service.list(); }
    @GetMapping("/{id}") public StockLocationResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ResponseEntity<StockLocationResponse> create(@Valid @RequestBody StockLocationRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
