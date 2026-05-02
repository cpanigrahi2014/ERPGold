package com.nexus.refinery.web;

import com.nexus.refinery.application.dto.RefineryDtos.*;
import com.nexus.refinery.application.service.RefineryService;
import com.nexus.refinery.domain.model.RefineryBatch;
import com.nexus.refinery.domain.model.RefineryOrder;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/refinery")
@RequiredArgsConstructor
public class RefineryController {
    private final RefineryService svc;

    // ── Batches ──────────────────────────────────────────────────────────────
    @GetMapping("/batches")
    public List<BatchResponse> batches(@RequestParam(required = false) RefineryBatch.Status status) { return svc.listBatches(status); }

    @PostMapping("/batches")
    public ResponseEntity<BatchResponse> createBatch(@Valid @RequestBody BatchRequest r) {
        return ResponseEntity.status(201).body(svc.createBatch(r));
    }

    @GetMapping("/batches/{id}")
    public BatchResponse getBatch(@PathVariable UUID id) { return svc.getBatch(id); }

    @PatchMapping("/batches/{id}/status")
    public BatchResponse setStatus(@PathVariable UUID id, @RequestParam RefineryBatch.Status status) { return svc.updateStatus(id, status); }

    @PatchMapping("/batches/{id}")
    public BatchResponse updateBatch(@PathVariable UUID id, @RequestBody BatchUpdateRequest r) { return svc.updateBatch(id, r); }

    // ── Batch Inputs / Outputs / Steps ───────────────────────────────────────
    @GetMapping("/batches/{id}/inputs")
    public List<InputResponse>  inputs(@PathVariable UUID id) { return svc.listInputs(id); }
    @PostMapping("/inputs")
    public ResponseEntity<InputResponse> addInput(@Valid @RequestBody InputRequest r) {
        return ResponseEntity.status(201).body(svc.addInput(r));
    }

    @GetMapping("/batches/{id}/outputs")
    public List<OutputResponse> outputs(@PathVariable UUID id) { return svc.listOutputs(id); }
    @PostMapping("/outputs")
    public ResponseEntity<OutputResponse> addOutput(@Valid @RequestBody OutputRequest r) {
        return ResponseEntity.status(201).body(svc.addOutput(r));
    }

    @GetMapping("/batches/{id}/steps")
    public List<StepResponse>   steps(@PathVariable UUID id) { return svc.listSteps(id); }
    @PostMapping("/steps")
    public ResponseEntity<StepResponse> addStep(@Valid @RequestBody StepRequest r) {
        return ResponseEntity.status(201).body(svc.addStep(r));
    }

    // ── Orders ───────────────────────────────────────────────────────────────
    @GetMapping("/orders")
    public List<OrderResponse> listOrders(@RequestParam(required = false) RefineryOrder.Status status) { return svc.listOrders(status); }

    @PostMapping("/orders")
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody OrderRequest r) {
        return ResponseEntity.status(201).body(svc.createOrder(r));
    }

    @GetMapping("/orders/{id}")
    public OrderResponse getOrder(@PathVariable UUID id) { return svc.getOrder(id); }

    @PatchMapping("/orders/{id}")
    public OrderResponse updateOrder(@PathVariable UUID id, @RequestBody OrderUpdateRequest r) { return svc.updateOrder(id, r); }
}
