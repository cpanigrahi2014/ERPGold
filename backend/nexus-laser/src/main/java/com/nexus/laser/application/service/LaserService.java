package com.nexus.laser.application.service;

import com.nexus.laser.application.dto.LaserDtos.*;
import com.nexus.laser.application.support.CurrentContext;
import com.nexus.laser.domain.model.*;
import com.nexus.laser.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class LaserService {

    private final LaserMachineRepository machines;
    private final LaserJobRepository jobs;
    private final LaserMarkRepository marks;
    private final LaserTransactionRepository transactions;
    private final LaserReportRepository reports;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");

    // ---------- Machines ----------
    @Transactional
    public MachineResponse createMachine(MachineRequest r) {
        LaserMachine m = LaserMachine.builder()
            .code(r.code()).name(r.name()).branchId(r.branchId())
            .model(r.model()).maxPowerW(r.maxPowerW())
            .active(r.active() == null ? true : r.active())
            .build();
        stamp(m);
        return toMachine(machines.save(m));
    }
    public List<MachineResponse> listMachines(boolean activeOnly) {
        UUID t = ctx.tenantId();
        var list = activeOnly ? machines.findByTenantIdAndActiveTrueOrderByCodeAsc(t)
                              : machines.findByTenantIdOrderByCodeAsc(t);
        return list.stream().map(this::toMachine).toList();
    }

    // ---------- Jobs ----------
    @Transactional
    public JobResponse createJob(JobRequest r) {
        LaserJob j = LaserJob.builder()
            .jobNumber(r.jobNumber() == null || r.jobNumber().isBlank()
                ? "LZ-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.jobNumber())
            .branchId(r.branchId()).customerId(r.customerId()).lotId(r.lotId()).machineId(r.machineId())
            .receivedDate(r.receivedDate() == null ? LocalDate.now() : r.receivedDate())
            .dueDate(r.dueDate())
            .pieceCount(r.pieceCount() == null ? 1 : r.pieceCount())
            .markingText(r.markingText()).font(r.font())
            .depthMm(r.depthMm()).powerPct(r.powerPct()).speedMmps(r.speedMmps())
            .status(r.machineId() == null ? LaserJob.Status.ORDER : LaserJob.Status.IN_QUEUE)
            .ratePerPiece(r.ratePerPiece()).remarks(r.remarks())
            .build();
        stamp(j);
        return toJob(jobs.save(j));
    }

    public List<JobResponse> listJobs(LaserJob.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? jobs.findByTenantIdOrderByReceivedDateDesc(t)
            : jobs.findByTenantIdAndStatusOrderByReceivedDateDesc(t, status);
        return list.stream().map(this::toJob).toList();
    }

    @Transactional
    public JobResponse updateStatus(UUID id, LaserJob.Status status) {
        LaserJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        j.setStatus(status);
        if (status == LaserJob.Status.COMPLETED || status == LaserJob.Status.DELIVERED) {
            if (j.getCompletedDate() == null) j.setCompletedDate(LocalDate.now());
        }
        j.setUpdatedBy(ctx.userId());
        return toJob(jobs.save(j));
    }

    @Transactional
    public JobResponse assignMachine(UUID id, UUID machineId) {
        LaserJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        j.setMachineId(machineId);
        if (j.getStatus() == LaserJob.Status.ORDER) j.setStatus(LaserJob.Status.IN_QUEUE);
        j.setUpdatedBy(ctx.userId());
        return toJob(jobs.save(j));
    }

    // ---------- Marks ----------
    @Transactional
    public MarkResponse addMark(MarkRequest r) {
        LaserJob j = jobs.findById(r.jobId()).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        LaserMark m = LaserMark.builder()
            .jobId(r.jobId()).pieceNo(r.pieceNo())
            .engravedText(r.engravedText() == null ? j.getMarkingText() : r.engravedText())
            .pieceWeight(r.pieceWeight()).operatorName(r.operatorName())
            .result(r.result() == null ? LaserMark.Result.OK : r.result())
            .remarks(r.remarks()).build();
        stamp(m);
        LaserMark saved = marks.save(m);

        if (j.getStatus() == LaserJob.Status.ORDER || j.getStatus() == LaserJob.Status.IN_QUEUE) {
            j.setStatus(LaserJob.Status.IN_PROGRESS);
        }
        long ok = marks.countByJobIdAndResult(r.jobId(), LaserMark.Result.OK);
        if (ok >= j.getPieceCount() && j.getStatus() != LaserJob.Status.DELIVERED) {
            j.setStatus(LaserJob.Status.COMPLETED);
            j.setCompletedDate(LocalDate.now());
        }
        j.setUpdatedBy(ctx.userId()); jobs.save(j);
        return toMark(saved);
    }

    public List<MarkResponse> listMarks(UUID jobId) {
        return marks.findByJobIdOrderByPieceNoAsc(jobId).stream().map(this::toMark).toList();
    }

    // ---------- Transactions ----------
    @Transactional
    public TransactionResponse createTransaction(TransactionRequest r) {
        LaserTransaction t = LaserTransaction.builder()
            .jobId(r.jobId()).orderId(r.orderId()).type(r.type())
            .nonHuidQty(r.nonHuidQty()).sealQty(r.sealQty())
            .totalMarkings(r.totalMarkings()).build();
        stamp(t);
        return toTransaction(transactions.save(t));
    }

    public List<TransactionResponse> listTransactions() {
        UUID t = ctx.tenantId();
        return transactions.findByTenantIdOrderByCreatedAtDesc(t).stream()
            .map(this::toTransaction).toList();
    }

    public List<TransactionResponse> listTransactionsByType(LaserTransaction.Type type) {
        UUID t = ctx.tenantId();
        return transactions.findByTenantIdAndTypeOrderByCreatedAtDesc(t, type).stream()
            .map(this::toTransaction).toList();
    }

    // ---------- Reports ----------
    @Transactional
    public ReportResponse createReport(ReportRequest r) {
        LaserReport rpt = LaserReport.builder()
            .fileName(r.fileName()).totalPartNum(r.totalPartNum())
            .currentPartNumber(r.currentPartNumber()).previousPartNumber(r.previousPartNumber())
            .difference(r.difference()).reportDate(r.reportDate()).build();
        stamp(rpt);
        return toReport(reports.save(rpt));
    }

    public List<ReportResponse> listReports() {
        UUID t = ctx.tenantId();
        return reports.findByTenantIdOrderByReportDateDesc(t).stream()
            .map(this::toReport).toList();
    }

    public List<ReportResponse> listReportsByDate(LocalDate date) {
        UUID t = ctx.tenantId();
        return reports.findByTenantIdAndReportDateOrderByCreatedAtDesc(t, date).stream()
            .map(this::toReport).toList();
    }
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private MachineResponse toMachine(LaserMachine m) {
        return new MachineResponse(m.getId(), m.getCode(), m.getName(), m.getBranchId(),
            m.getModel(), m.getMaxPowerW(), m.isActive());
    }
    private JobResponse toJob(LaserJob j) {
        return new JobResponse(j.getId(), j.getJobNumber(), j.getBranchId(), j.getCustomerId(),
            j.getLotId(), j.getMachineId(),
            j.getReceivedDate(), j.getDueDate(), j.getCompletedDate(),
            j.getPieceCount(), j.getMarkingText(), j.getFont(),
            j.getDepthMm(), j.getPowerPct(), j.getSpeedMmps(),
            j.getStatus(), j.getRatePerPiece(), j.getRemarks());
    }
    private MarkResponse toMark(LaserMark m) {
        return new MarkResponse(m.getId(), m.getJobId(), m.getPieceNo(), m.getEngravedText(),
            m.getPieceWeight(), m.getOperatorName(), m.getResult(), m.getRemarks());
    }
    private TransactionResponse toTransaction(LaserTransaction t) {
        return new TransactionResponse(t.getId(), t.getJobId(), t.getOrderId(), t.getType(),
            t.getNonHuidQty(), t.getSealQty(), t.getTotalMarkings());
    }
    private ReportResponse toReport(LaserReport r) {
        return new ReportResponse(r.getId(), r.getFileName(), r.getTotalPartNum(),
            r.getCurrentPartNumber(), r.getPreviousPartNumber(), r.getDifference(), r.getReportDate());
    }
}
