package com.nexus.hm.application.service;

import com.nexus.hm.application.dto.HmDtos.*;
import com.nexus.hm.application.support.CurrentContext;
import com.nexus.hm.domain.model.*;
import com.nexus.hm.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class HmService {

    private final HmJobRepository jobs;
    private final HmMarkRepository marks;
    private final HmDispatchRepository dispatches;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final char[] HUID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray(); // BIS-style alphanumeric, no I/O/0/1
    private static final SecureRandom RNG = new SecureRandom();

    // ---------- Jobs ----------
    @Transactional
    public JobResponse createJob(JobRequest r) {
        HmJob j = HmJob.builder()
            .jobNumber(r.jobNumber() == null || r.jobNumber().isBlank()
                ? "HM-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.jobNumber())
            .branchId(r.branchId()).jewellerId(r.jewellerId()).lotId(r.lotId()).kind(r.kind())
            .receivedDate(r.receivedDate() == null ? LocalDate.now() : r.receivedDate())
            .purityLabel(r.purityLabel()).declaredFineness(r.declaredFineness())
            .pieceCount(r.pieceCount() == null ? 1 : r.pieceCount())
            .grossWeight(r.grossWeight())
            .huidRequired(r.huidRequired() == null ? (r.kind() == HmJob.Kind.HUID) : r.huidRequired())
            .status(HmJob.Status.RECEIVED).ratePerPiece(r.ratePerPiece()).remarks(r.remarks())
            .build();
        stamp(j);
        return toJob(jobs.save(j));
    }

    public List<JobResponse> listJobs(HmJob.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? jobs.findByTenantIdOrderByReceivedDateDesc(t)
            : jobs.findByTenantIdAndStatusOrderByReceivedDateDesc(t, status);
        return list.stream().map(this::toJob).toList();
    }

    @Transactional
    public JobResponse updateStatus(UUID id, HmJob.Status status) {
        HmJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        j.setStatus(status);
        if (status == HmJob.Status.MARKED) j.setMarkedDate(LocalDate.now());
        if (status == HmJob.Status.DISPATCHED) j.setDispatchedDate(LocalDate.now());
        j.setUpdatedBy(ctx.userId());
        return toJob(jobs.save(j));
    }

    // ---------- Marks ----------
    @Transactional
    public MarkResponse addMark(MarkRequest r) {
        HmJob j = jobs.findById(r.jobId()).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        String huid = r.huidCode();
        if ((huid == null || huid.isBlank()) && j.isHuidRequired()) huid = generateHuid();

        HmMark m = HmMark.builder()
            .jobId(r.jobId()).pieceNo(r.pieceNo()).huidCode(huid)
            .markedPurity(r.markedPurity()).pieceWeight(r.pieceWeight())
            .markedByName(r.markedByName())
            .result(r.result() == null ? HmMark.Result.PASSED : r.result())
            .remarks(r.remarks()).build();
        stamp(m);
        HmMark saved = marks.save(m);

        // Auto-bump job status: SAMPLED → MARKED when all pieces marked successfully
        long passed = marks.countByJobIdAndResult(r.jobId(), HmMark.Result.PASSED);
        if (passed >= j.getPieceCount() && j.getStatus() != HmJob.Status.DISPATCHED) {
            j.setStatus(HmJob.Status.MARKED);
            j.setMarkedDate(LocalDate.now());
        } else if (j.getStatus() == HmJob.Status.RECEIVED) {
            j.setStatus(HmJob.Status.SAMPLED);
        }
        j.setUpdatedBy(ctx.userId()); jobs.save(j);
        return toMark(saved);
    }

    public List<MarkResponse> listMarks(UUID jobId) {
        return marks.findByJobIdOrderByPieceNoAsc(jobId).stream().map(this::toMark).toList();
    }

    // ---------- Dispatch ----------
    @Transactional
    public DispatchResponse dispatchJob(DispatchRequest r) {
        HmJob j = jobs.findById(r.jobId()).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        if (j.getStatus() != HmJob.Status.MARKED && j.getStatus() != HmJob.Status.TESTED) {
            throw new IllegalStateException("Job must be MARKED or TESTED before dispatch (current: " + j.getStatus() + ")");
        }
        HmDispatch d = dispatches.findByJobId(r.jobId()).orElseGet(() -> {
            HmDispatch x = HmDispatch.builder()
                .dispatchNo("DSP-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999))
                .jobId(r.jobId()).dispatchedOn(LocalDate.now())
                .receivedByName(r.receivedByName()).pieceCount(r.pieceCount())
                .grossWeight(r.grossWeight()).remarks(r.remarks()).build();
            stamp(x); return x;
        });
        d.setReceivedByName(r.receivedByName()); d.setPieceCount(r.pieceCount());
        d.setGrossWeight(r.grossWeight()); d.setRemarks(r.remarks());
        d.setUpdatedBy(ctx.userId());
        HmDispatch saved = dispatches.save(d);
        j.setStatus(HmJob.Status.DISPATCHED); j.setDispatchedDate(LocalDate.now());
        j.setUpdatedBy(ctx.userId()); jobs.save(j);
        return toDispatch(saved);
    }

    public DispatchResponse getDispatch(UUID jobId) {
        return dispatches.findByJobId(jobId).map(this::toDispatch).orElse(null);
    }

    // ---------- helpers ----------
    private String generateHuid() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) sb.append(HUID_CHARS[RNG.nextInt(HUID_CHARS.length)]);
        return sb.toString();
    }
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private JobResponse toJob(HmJob j) {
        return new JobResponse(j.getId(), j.getJobNumber(), j.getBranchId(), j.getJewellerId(), j.getLotId(),
            j.getKind(), j.getReceivedDate(), j.getMarkedDate(), j.getDispatchedDate(),
            j.getPurityLabel(), j.getDeclaredFineness(), j.getAssayedFineness(),
            j.getPieceCount(), j.getGrossWeight(), j.isHuidRequired(),
            j.getStatus(), j.getRatePerPiece(), j.getRemarks());
    }
    private MarkResponse toMark(HmMark m) {
        return new MarkResponse(m.getId(), m.getJobId(), m.getPieceNo(), m.getHuidCode(), m.getMarkedPurity(),
            m.getPieceWeight(), m.getMarkedByName(), m.getResult(), m.getRemarks());
    }
    private DispatchResponse toDispatch(HmDispatch d) {
        return new DispatchResponse(d.getId(), d.getDispatchNo(), d.getJobId(), d.getDispatchedOn(),
            d.getReceivedByName(), d.getPieceCount(), d.getGrossWeight(), d.getRemarks());
    }
}
