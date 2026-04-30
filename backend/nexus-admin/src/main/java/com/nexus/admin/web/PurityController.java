package com.nexus.admin.web;

import com.nexus.admin.application.dto.PurityRequest;
import com.nexus.admin.application.dto.PurityResponse;
import com.nexus.admin.application.service.PurityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/purity")
@RequiredArgsConstructor
public class PurityController {

    private final PurityService service;

    @GetMapping public List<PurityResponse> list() { return service.list(); }

    @PostMapping
    public ResponseEntity<PurityResponse> create(@Valid @RequestBody PurityRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
