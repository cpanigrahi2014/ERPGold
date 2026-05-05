package com.nexus.records.web;

import com.nexus.records.application.dto.RecordsDtos.*;
import com.nexus.records.application.service.RecordsService;
import com.nexus.records.domain.model.DayBookEntry;
import com.nexus.records.domain.model.RegisterEntry;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/records")
@RequiredArgsConstructor
public class RecordsController {
    private final RecordsService svc;

    // -------- Day Book --------
    @GetMapping("/daybook")
    public List<DayBookResponse> dayBook(
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required=false) UUID branchId,
            @RequestParam(required=false) DayBookEntry.Module module) {
        return svc.listDayBook(from, to, branchId, module);
    }

    @PostMapping("/daybook")
    public ResponseEntity<DayBookResponse> addDayBook(@Valid @RequestBody DayBookRequest r) {
        return ResponseEntity.status(201).body(svc.addDayBook(r));
    }

    @GetMapping("/daybook/summary")
    public DaySummary summary(@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date) {
        return svc.daySummary(date);
    }

    // -------- Audit --------
    @GetMapping("/audit")
    public List<AuditResponse> audit(
            @RequestParam(required=false) DayBookEntry.Module module,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required=false) String entityType,
            @RequestParam(required=false) UUID entityId) {
        return svc.listAudit(module, from, to, entityType, entityId);
    }

    @PostMapping("/audit")
    public ResponseEntity<AuditResponse> addAudit(@Valid @RequestBody AuditRequest r) {
        return ResponseEntity.status(201).body(svc.addAudit(r));
    }

    // -------- Registers --------
    @GetMapping("/registers/{type}")
    public List<RegisterResponse> register(
            @PathVariable RegisterEntry.RegisterType type,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to) {
        return svc.listRegister(type, from, to);
    }

    @PostMapping("/registers")
    public ResponseEntity<RegisterResponse> addRegister(@Valid @RequestBody RegisterRequest r) {
        return ResponseEntity.status(201).body(svc.addRegister(r));
    }

    // -------- Business Records --------
    @GetMapping("/business-records")
    public List<BusinessRecordResponse> businessRecords() {
        return svc.listBusinessRecords();
    }

    @PostMapping("/business-records")
    public ResponseEntity<BusinessRecordResponse> createBusinessRecord(@Valid @RequestBody BusinessRecordCreateRequest r) {
        return ResponseEntity.status(201).body(svc.createBusinessRecord(r));
    }

    @PatchMapping("/business-records/{id}")
    public BusinessRecordResponse updateBusinessRecord(@PathVariable UUID id, @RequestBody BusinessRecordUpdateRequest r) {
        return svc.updateBusinessRecord(id, r);
    }

    @PostMapping("/business-records/export")
    public ResponseEntity<byte[]> exportBusinessRecords(@Valid @RequestBody BusinessRecordExportRequest r) {
        RecordsService.ExportArtifact a = svc.exportBusinessRecords(r);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(a.contentType()));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.fileName() + "\"");
        headers.setCacheControl("no-store, no-cache, must-revalidate, max-age=0");
        if (a.recordId() != null) headers.set("X-Record-Id", a.recordId().toString());
        return ResponseEntity.ok().headers(headers).body(a.bytes());
    }

    @GetMapping("/business-records/{id}/export/download")
    public ResponseEntity<byte[]> downloadBusinessRecordExport(@PathVariable UUID id) {
        RecordsService.ExportArtifact a = svc.downloadBusinessRecordExport(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(a.contentType()));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.fileName() + "\"");
        return ResponseEntity.ok().headers(headers).body(a.bytes());
    }
}
