package com.nexus.testing.web;

import com.nexus.testing.application.dto.TestingDtos.*;
import com.nexus.testing.application.service.TestingService;
import com.nexus.testing.domain.model.TestingJob;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/testing")
@RequiredArgsConstructor
public class TestingController {
    private final TestingService svc;

    // Jobs
    @GetMapping("/jobs")
    public List<JobResponse> listJobs(@RequestParam(required = false) TestingJob.Status status) {
        return svc.listJobs(status);
    }
    @PostMapping("/jobs")
    public ResponseEntity<JobResponse> createJob(@Valid @RequestBody JobRequest r) {
        return ResponseEntity.status(201).body(svc.createJob(r));
    }
    @PatchMapping("/jobs/{id}/status")
    public JobResponse updateStatus(@PathVariable UUID id, @RequestParam TestingJob.Status status) {
        return svc.updateStatus(id, status);
    }

    // Results
    @GetMapping("/jobs/{jobId}/results")
    public List<ResultResponse> results(@PathVariable UUID jobId) { return svc.listResults(jobId); }
    @PostMapping("/results")
    public ResponseEntity<ResultResponse> addResult(@Valid @RequestBody ResultRequest r) {
        return ResponseEntity.status(201).body(svc.addResult(r));
    }

    // Certificates
    @GetMapping("/jobs/{jobId}/certificate")
    public CertificateResponse certificate(@PathVariable UUID jobId) { return svc.getCertificate(jobId); }
    @PostMapping("/certificates")
    public ResponseEntity<CertificateResponse> issue(@Valid @RequestBody CertificateRequest r) {
        return ResponseEntity.status(201).body(svc.issueCertificate(r));
    }
}
