package com.nexus.admin.web;

import com.nexus.admin.application.dto.ProductRequest;
import com.nexus.admin.application.dto.ProductResponse;
import com.nexus.admin.application.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService service;

    @GetMapping public List<ProductResponse> list() { return service.list(); }
    @GetMapping("/{id}") public ProductResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest r) {
        return ResponseEntity.status(201).body(service.create(r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
