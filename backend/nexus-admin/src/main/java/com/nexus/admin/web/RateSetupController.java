package com.nexus.admin.web;

import com.nexus.admin.application.dto.RateSetupRequest;
import com.nexus.admin.application.dto.RateSetupResponse;
import com.nexus.admin.application.service.RateSetupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/rates")
@RequiredArgsConstructor
public class RateSetupController {

    private final RateSetupService service;

    @GetMapping public List<RateSetupResponse> list() { return service.list(); }

    @PostMapping
    public ResponseEntity<RateSetupResponse> create(@Valid @RequestBody RateSetupRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Rate lookup endpoint used by Billing / other modules. */
    @GetMapping("/resolve")
    public Map<String, Object> resolve(
            @RequestParam UUID branchId,
            @RequestParam(required = false) UUID customerId,
            @RequestParam UUID serviceTypeId,
            @RequestParam(required = false) LocalDate asOf) {
        BigDecimal rate = service.resolveRate(branchId, customerId, serviceTypeId, asOf)
                .orElse(null);
        return Map.of("rate", rate == null ? "" : rate, "found", rate != null);
    }
}
