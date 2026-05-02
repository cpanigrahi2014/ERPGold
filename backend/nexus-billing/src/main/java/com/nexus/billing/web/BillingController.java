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

    @GetMapping("/deposits")
    public List<DepositResponse> deposits() { return svc.listDeposits(); }

    @PostMapping("/deposits")
    public ResponseEntity<DepositResponse> createDeposit(@Valid @RequestBody DepositRequest r) {
        return ResponseEntity.status(201).body(svc.createDeposit(r));
    }

    @GetMapping("/exchange-records")
    public List<ExchangeResponse> exchanges() { return svc.listExchanges(); }

    @PostMapping("/exchange-records")
    public ResponseEntity<ExchangeResponse> createExchange(@Valid @RequestBody ExchangeRequest r) {
        return ResponseEntity.status(201).body(svc.createExchange(r));
    }

    @GetMapping("/payments-register")
    public List<PaymentRegisterResponse> paymentRegister() { return svc.listPaymentRegister(); }

    @PostMapping("/payments-register")
    public ResponseEntity<PaymentRegisterResponse> createPaymentRegister(@Valid @RequestBody PaymentRegisterRequest r) {
        return ResponseEntity.status(201).body(svc.createPaymentRegister(r));
    }

    @GetMapping("/scrap-log")
    public List<ScrapLogResponse> scrapLog() { return svc.listScrapLog(); }

    @GetMapping("/scrap-report")
    public ScrapReportResponse scrapReport() { return svc.scrapReport(); }

    @GetMapping("/discounts")
    public List<DiscountResponse> discounts() { return svc.listDiscounts(); }

    @PostMapping("/discounts")
    public ResponseEntity<DiscountResponse> createDiscount(@Valid @RequestBody DiscountRequest r) {
        return ResponseEntity.status(201).body(svc.createDiscount(r));
    }

    @PatchMapping("/discounts/{id}/submit")
    public DiscountResponse submitDiscount(@PathVariable UUID id) { return svc.submitDiscount(id); }

    @PatchMapping("/discounts/{id}/approve")
    public DiscountResponse approveDiscount(@PathVariable UUID id) { return svc.approveDiscount(id); }
}
