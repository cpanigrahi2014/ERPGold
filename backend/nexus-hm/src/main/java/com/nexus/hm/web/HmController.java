package com.nexus.hm.web;

import com.nexus.hm.application.dto.HmDtos.*;
import com.nexus.hm.application.service.HmService;
import com.nexus.hm.domain.model.HmDeliveryOrder;
import com.nexus.hm.domain.model.HmJob;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hm")
@RequiredArgsConstructor
public class HmController {
    private final HmService svc;

    @GetMapping("/jobs")
    public List<JobResponse> jobs(@RequestParam(required = false) HmJob.Status status) { return svc.listJobs(status); }
    @PostMapping("/jobs")
    public ResponseEntity<JobResponse> createJob(@Valid @RequestBody JobRequest r) {
        return ResponseEntity.status(201).body(svc.createJob(r));
    }
    @PatchMapping("/jobs/{id}/status")
    public JobResponse status(@PathVariable UUID id, @RequestParam HmJob.Status status) { return svc.updateStatus(id, status); }

    @PatchMapping("/jobs/{id}")
    public JobResponse updateJob(@PathVariable UUID id, @RequestBody JobUpdateRequest r) {
        return svc.updateJob(id, r);
    }

    @DeleteMapping("/jobs/{id}")
    public ResponseEntity<Void> deleteJob(@PathVariable UUID id) {
        svc.deleteJob(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/jobs/{jobId}/marks")
    public List<MarkResponse> marks(@PathVariable UUID jobId) { return svc.listMarks(jobId); }
    @PostMapping("/marks")
    public ResponseEntity<MarkResponse> mark(@Valid @RequestBody MarkRequest r) {
        return ResponseEntity.status(201).body(svc.addMark(r));
    }

    @GetMapping("/jobs/{jobId}/dispatch")
    public DispatchResponse getDispatch(@PathVariable UUID jobId) { return svc.getDispatch(jobId); }
    @PostMapping("/dispatches")
    public ResponseEntity<DispatchResponse> dispatch(@Valid @RequestBody DispatchRequest r) {
        return ResponseEntity.status(201).body(svc.dispatchJob(r));
    }

    // ── Delivery Orders ───────────────────────────────────────────────────────
    @GetMapping("/delivery-orders")
    public List<DeliveryOrderResponse> listDeliveryOrders(
            @RequestParam(required = false) HmDeliveryOrder.Status status) {
        return svc.listDeliveryOrders(status);
    }

    @PostMapping("/delivery-orders")
    public ResponseEntity<DeliveryOrderResponse> createDeliveryOrder(
            @Valid @RequestBody DeliveryOrderCreateRequest r) {
        return ResponseEntity.status(201).body(svc.createDeliveryOrder(r));
    }

    @PatchMapping("/delivery-orders/{id}/pickup")
    public DeliveryOrderResponse markPickedUp(
            @PathVariable UUID id, @RequestBody DeliveryOrderPickupRequest r) {
        return svc.markPickedUp(id, r);
    }

    @PatchMapping("/delivery-orders/{id}/receive")
    public DeliveryOrderResponse markReceived(
            @PathVariable UUID id, @Valid @RequestBody DeliveryOrderReceiveRequest r) {
        return svc.markReceived(id, r);
    }

    @PatchMapping("/delivery-orders/{id}/cancel")
    public DeliveryOrderResponse cancelDeliveryOrder(@PathVariable UUID id) {
        return svc.cancelDeliveryOrder(id);
    }

    // ── Delivery Returns ──────────────────────────────────────────────────────
    @GetMapping("/delivery-orders/returns")
    public List<DeliveryReturnResponse> listDeliveryReturns() {
        return svc.listDeliveryReturns();
    }

    @PostMapping("/delivery-orders/returns")
    public ResponseEntity<DeliveryReturnResponse> createDeliveryReturn(
            @Valid @RequestBody DeliveryReturnCreateRequest r) {
        return ResponseEntity.status(201).body(svc.createDeliveryReturn(r));
    }

    @PatchMapping("/delivery-orders/returns/{id}/deliver")
    public DeliveryReturnResponse markReturnDelivered(@PathVariable UUID id) {
        return svc.markReturnDelivered(id);
    }
}
