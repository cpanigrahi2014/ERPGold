package com.nexus.testing.application.service;

import com.nexus.testing.application.dto.TestingDtos.*;
import com.nexus.testing.application.support.CurrentContext;
import com.nexus.testing.domain.model.*;
import com.nexus.testing.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class TestingService {

    private final TestingJobRepository jobs;
    private final TestingResultRepository results;
    private final TestingCertificateRepository certificates;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");

    // ---------- Jobs ----------
    @Transactional
    public JobResponse createJob(JobRequest r) {
        TestingJob j = TestingJob.builder()
            .jobNumber(r.jobNumber() == null || r.jobNumber().isBlank()
                ? "TJ-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.jobNumber())
            .branchId(r.branchId()).customerId(r.customerId()).lotId(r.lotId())
            .method(r.method())
            .receivedDate(r.receivedDate() == null ? LocalDate.now() : r.receivedDate())
            .dueDate(r.dueDate())
            .sampleCount(r.sampleCount() == null ? 1 : r.sampleCount())
            .grossWeight(r.grossWeight()).rate(r.rate())
            .status(TestingJob.Status.RECEIVED).remarks(r.remarks())
            .build();
        stamp(j);
        return toJob(jobs.save(j));
    }

    public List<JobResponse> listJobs(TestingJob.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? jobs.findByTenantIdOrderByReceivedDateDesc(t)
            : jobs.findByTenantIdAndStatusOrderByReceivedDateDesc(t, status);
        return list.stream().map(this::toJob).toList();
    }

    @Transactional
    public JobResponse updateStatus(UUID id, TestingJob.Status status) {
        TestingJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        j.setStatus(status);
        if (status == TestingJob.Status.COMPLETED) j.setCompletedDate(LocalDate.now());
        j.setUpdatedBy(ctx.userId());
        return toJob(jobs.save(j));
    }

    // ---------- Results ----------
    @Transactional
    public ResultResponse addResult(ResultRequest r) {
        TestingResult res = TestingResult.builder()
            .jobId(r.jobId()).sampleNo(r.sampleNo()).sampleWeight(r.sampleWeight())
            .auPct(r.auPct()).agPct(r.agPct()).cuPct(r.cuPct()).znPct(r.znPct())
            .niPct(r.niPct()).pdPct(r.pdPct()).ptPct(r.ptPct()).otherPct(r.otherPct())
            .fineness(r.fineness() == null && r.auPct() != null
                ? r.auPct().multiply(BigDecimal.TEN).setScale(3, RoundingMode.HALF_UP) // % → ppt
                : r.fineness())
            .testedByName(r.testedByName()).remarks(r.remarks())
            .build();
        stamp(res);
        TestingResult saved = results.save(res);
        // auto-bump job status to IN_PROGRESS on first result
        jobs.findById(r.jobId()).ifPresent(j -> {
            if (j.getStatus() == TestingJob.Status.RECEIVED) {
                j.setStatus(TestingJob.Status.IN_PROGRESS);
                j.setUpdatedBy(ctx.userId());
                jobs.save(j);
            }
        });
        return toResult(saved);
    }

    public List<ResultResponse> listResults(UUID jobId) {
        return results.findByJobIdOrderBySampleNoAsc(jobId).stream().map(this::toResult).toList();
    }

    // ---------- Certificate ----------
    @Transactional
    public CertificateResponse issueCertificate(CertificateRequest r) {
        TestingJob j = jobs.findById(r.jobId()).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        var resList = results.findByJobIdOrderBySampleNoAsc(r.jobId());
        if (resList.isEmpty()) throw new IllegalStateException("Cannot certify: no results for job");

        BigDecimal sum = BigDecimal.ZERO; int n = 0;
        for (var x : resList) if (x.getFineness() != null) { sum = sum.add(x.getFineness()); n++; }
        BigDecimal avg = n == 0 ? null : sum.divide(BigDecimal.valueOf(n), 3, RoundingMode.HALF_UP);

        TestingCertificate cert = certificates.findByJobId(r.jobId()).orElseGet(() -> {
            TestingCertificate c = TestingCertificate.builder()
                .certificateNo("CERT-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999))
                .jobId(r.jobId()).issuedOn(LocalDate.now())
                .issuedByName(r.issuedByName()).averageFineness(avg).remarks(r.remarks())
                .build();
            stamp(c);
            return c;
        });
        cert.setAverageFineness(avg);
        cert.setIssuedByName(r.issuedByName());
        cert.setRemarks(r.remarks());
        cert.setUpdatedBy(ctx.userId());
        TestingCertificate saved = certificates.save(cert);
        j.setStatus(TestingJob.Status.CERTIFIED);
        j.setCompletedDate(LocalDate.now());
        j.setUpdatedBy(ctx.userId());
        jobs.save(j);
        return toCert(saved);
    }

    public CertificateResponse getCertificate(UUID jobId) {
        return certificates.findByJobId(jobId).map(this::toCert).orElse(null);
    }

    // ---------- helpers ----------
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private JobResponse toJob(TestingJob j) {
        return new JobResponse(j.getId(), j.getJobNumber(), j.getBranchId(), j.getCustomerId(), j.getLotId(),
            j.getMethod(), j.getReceivedDate(), j.getDueDate(), j.getCompletedDate(),
            j.getSampleCount(), j.getGrossWeight(), j.getRate(), j.getStatus(), j.getRemarks());
    }
    private ResultResponse toResult(TestingResult x) {
        return new ResultResponse(x.getId(), x.getJobId(), x.getSampleNo(), x.getSampleWeight(),
            x.getAuPct(), x.getAgPct(), x.getCuPct(), x.getZnPct(),
            x.getNiPct(), x.getPdPct(), x.getPtPct(), x.getOtherPct(),
            x.getFineness(), x.getTestedByName(), x.getRemarks());
    }
    private CertificateResponse toCert(TestingCertificate c) {
        return new CertificateResponse(c.getId(), c.getCertificateNo(), c.getJobId(), c.getIssuedOn(),
            c.getIssuedByName(), c.getAverageFineness(), c.getRemarks());
    }
}
