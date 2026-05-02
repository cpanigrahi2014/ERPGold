package com.nexus.exchange.web;

import com.nexus.exchange.application.dto.ExchangeDtos.*;
import com.nexus.exchange.application.service.ExchangeService;
import com.nexus.exchange.domain.model.ExchangeTxn;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/exchange")
@RequiredArgsConstructor
public class ExchangeController {
    private final ExchangeService svc;

    @GetMapping("/txns")
    public List<TxnResponse> txns(@RequestParam(required = false) ExchangeTxn.Status status) { return svc.listTxns(status); }

    @PostMapping("/txns")
    public ResponseEntity<TxnResponse> createTxn(@Valid @RequestBody TxnRequest r) {
        return ResponseEntity.status(201).body(svc.createTxn(r));
    }

    @GetMapping("/txns/{id}")
    public TxnResponse getTxn(@PathVariable UUID id) { return svc.getTxn(id); }

    @PatchMapping("/txns/{id}")
    public TxnResponse updateTxn(@PathVariable UUID id, @RequestBody TxnUpdateRequest r) { return svc.updateTxn(id, r); }

    @PatchMapping("/txns/{id}/status")
    public TxnResponse setStatus(@PathVariable UUID id, @RequestParam ExchangeTxn.Status status) { return svc.updateStatus(id, status); }

    @GetMapping("/txns/{id}/items")
    public List<ItemResponse> items(@PathVariable UUID id) { return svc.listItems(id); }

    @PostMapping("/items")
    public ResponseEntity<ItemResponse> addItem(@Valid @RequestBody ItemRequest r) {
        return ResponseEntity.status(201).body(svc.addItem(r));
    }

    @GetMapping("/returns")
    public List<ReturnResponse> returns() { return svc.listReturns(); }

    @PostMapping("/returns")
    public ResponseEntity<ReturnResponse> createReturn(@Valid @RequestBody ReturnRequest r) {
        return ResponseEntity.status(201).body(svc.createReturn(r));
    }

    @PatchMapping("/returns/{id}/status")
    public ReturnResponse setReturnStatus(@PathVariable UUID id, @RequestBody ReturnStatusRequest r) {
        return svc.updateReturnStatus(id, r.status());
    }
}
