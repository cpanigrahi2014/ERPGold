package com.nexus.hm.web;

import com.nexus.hm.application.dto.HmDtos.*;
import com.nexus.hm.application.service.HmService;
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
}
