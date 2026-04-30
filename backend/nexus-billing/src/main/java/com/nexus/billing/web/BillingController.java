package com.nexus.billing.web;

import com.nexus.billing.application.dto.BillingDtos.*;
import com.nexus.billing.application.service.BillingService;
import com.nexus.billing.domain.model.Invoice;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
public class BillingController {
    private final BillingService svc;

    @GetMapping("/invoices")
    public List<InvoiceResponse> invoices(
            @RequestParam(required = false) Invoice.Status status,
            @RequestParam(required = false) UUID customerId) { return svc.listInvoices(status, customerId); }

    @PostMapping("/invoices")
    public ResponseEntity<InvoiceResponse> createInvoice(@Valid @RequestBody InvoiceRequest r) {
        return ResponseEntity.status(201).body(svc.createInvoice(r));
    }

    @GetMapping("/invoices/{id}")
    public InvoiceResponse getInvoice(@PathVariable UUID id) { return svc.getInvoice(id); }

    @PatchMapping("/invoices/{id}/status")
    public InvoiceResponse setStatus(@PathVariable UUID id, @RequestParam Invoice.Status status) { return svc.updateStatus(id, status); }

    @GetMapping("/invoices/{id}/lines")
    public List<LineResponse> lines(@PathVariable UUID id) { return svc.listLines(id); }

    @PostMapping("/lines")
    public ResponseEntity<LineResponse> addLine(@Valid @RequestBody LineRequest r) {
        return ResponseEntity.status(201).body(svc.addLine(r));
    }

    @GetMapping("/invoices/{id}/payments")
    public List<PaymentResponse> payments(@PathVariable UUID id) { return svc.listPayments(id); }

    @PostMapping("/payments")
    public ResponseEntity<PaymentResponse> addPayment(@Valid @RequestBody PaymentRequest r) {
        return ResponseEntity.status(201).body(svc.addPayment(r));
    }
}
