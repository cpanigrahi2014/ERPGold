package com.nexus.admin.web;

import com.nexus.admin.application.dto.BranchRequest;
import com.nexus.admin.application.dto.BranchResponse;
import com.nexus.admin.application.service.BranchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/branches")
@RequiredArgsConstructor
public class BranchController {

    private final BranchService service;

    @GetMapping
    public List<BranchResponse> list() { return service.list(); }

    @GetMapping("/{id}")
    public BranchResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ResponseEntity<BranchResponse> create(@Valid @RequestBody BranchRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }

    @PutMapping("/{id}")
    public BranchResponse update(@PathVariable UUID id, @Valid @RequestBody BranchRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
