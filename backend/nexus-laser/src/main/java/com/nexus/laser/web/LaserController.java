package com.nexus.laser.web;

import com.nexus.laser.application.dto.LaserDtos.*;
import com.nexus.laser.application.service.LaserService;
import com.nexus.laser.domain.model.LaserJob;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/laser")
@RequiredArgsConstructor
public class LaserController {
    private final LaserService svc;

    // Machines
    @GetMapping("/machines")
    public List<MachineResponse> machines(@RequestParam(defaultValue = "true") boolean activeOnly) {
        return svc.listMachines(activeOnly);
    }
    @PostMapping("/machines")
    public ResponseEntity<MachineResponse> createMachine(@Valid @RequestBody MachineRequest r) {
        return ResponseEntity.status(201).body(svc.createMachine(r));
    }

    // Jobs
    @GetMapping("/jobs")
    public List<JobResponse> jobs(@RequestParam(required = false) LaserJob.Status status) { return svc.listJobs(status); }
    @PostMapping("/jobs")
    public ResponseEntity<JobResponse> createJob(@Valid @RequestBody JobRequest r) {
        return ResponseEntity.status(201).body(svc.createJob(r));
    }
    @PatchMapping("/jobs/{id}/status")
    public JobResponse setStatus(@PathVariable UUID id, @RequestParam LaserJob.Status status) { return svc.updateStatus(id, status); }
    @PatchMapping("/jobs/{id}/machine")
    public JobResponse assign(@PathVariable UUID id, @RequestParam UUID machineId) { return svc.assignMachine(id, machineId); }

    // Marks
    @GetMapping("/jobs/{jobId}/marks")
    public List<MarkResponse> marks(@PathVariable UUID jobId) { return svc.listMarks(jobId); }
    @PostMapping("/marks")
    public ResponseEntity<MarkResponse> mark(@Valid @RequestBody MarkRequest r) {
        return ResponseEntity.status(201).body(svc.addMark(r));
    }
}
