package com.nexus.refinery.application.service;

import com.nexus.refinery.application.dto.RefineryDtos.*;
import com.nexus.refinery.application.support.CurrentContext;
import com.nexus.refinery.domain.model.*;
import com.nexus.refinery.domain.repository.*;
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
public class RefineryService {

    private final RefineryBatchRepository batches;
    private final BatchInputRepository    inputs;
    private final BatchOutputRepository   outputs;
    private final ProcessStepRepository   steps;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final BigDecimal HUNDRED  = new BigDecimal("100");
    private static final BigDecimal THOUSAND = new BigDecimal("1000");

    // ---------- Batches ----------
    @Transactional
    public BatchResponse createBatch(BatchRequest r) {
        RefineryBatch b = RefineryBatch.builder()
            .batchNumber(r.batchNumber() == null || r.batchNumber().isBlank()
                ? "RF-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.batchNumber())
            .branchId(r.branchId()).customerId(r.customerId())
            .metal(r.metal() == null ? RefineryBatch.Metal.GOLD : r.metal())
            .method(r.method() == null ? RefineryBatch.Method.AQUA_REGIA : r.method())
            .startDate(r.startDate() == null ? LocalDate.now() : r.startDate())
            .expectedFineness(r.expectedFineness())
            .remarks(r.remarks())
            .build();
        stamp(b);
        return toBatch(batches.save(b));
    }

    public List<BatchResponse> listBatches(RefineryBatch.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? batches.findByTenantIdOrderByStartDateDesc(t)
            : batches.findByTenantIdAndStatusOrderByStartDateDesc(t, status);
        return list.stream().map(this::toBatch).toList();
    }

    public BatchResponse getBatch(UUID id) {
        return toBatch(batches.findById(id).orElseThrow(() -> new EntityNotFoundException("Batch not found")));
    }

    @Transactional
    public BatchResponse updateStatus(UUID id, RefineryBatch.Status status) {
        RefineryBatch b = batches.findById(id).orElseThrow(() -> new EntityNotFoundException("Batch not found"));
        b.setStatus(status);
        if (status == RefineryBatch.Status.COMPLETED && b.getCompletedDate() == null) {
            b.setCompletedDate(LocalDate.now());
        }
        b.setUpdatedBy(ctx.userId());
        return toBatch(batches.save(b));
    }

    // ---------- Inputs ----------
    @Transactional
    public InputResponse addInput(InputRequest r) {
        RefineryBatch b = batches.findById(r.batchId()).orElseThrow(() -> new EntityNotFoundException("Batch not found"));
        BigDecimal pure = (r.fineness() != null) ? r.grossWeight().multiply(r.fineness()).divide(THOUSAND, 4, RoundingMode.HALF_UP) : null;
        BatchInput in = BatchInput.builder()
            .batchId(r.batchId()).lotId(r.lotId()).sourceLabel(r.sourceLabel())
            .grossWeight(r.grossWeight()).fineness(r.fineness()).pureWeight(pure)
            .remarks(r.remarks()).build();
        stamp(in);
        BatchInput saved = inputs.save(in);
        recompute(b);
        if (b.getStatus() == RefineryBatch.Status.OPEN) b.setStatus(RefineryBatch.Status.IN_PROCESS);
        b.setUpdatedBy(ctx.userId()); batches.save(b);
        return toInput(saved);
    }
    public List<InputResponse> listInputs(UUID batchId) {
        return inputs.findByBatchIdOrderByCreatedAtAsc(batchId).stream().map(this::toInput).toList();
    }

    // ---------- Outputs ----------
    @Transactional
    public OutputResponse addOutput(OutputRequest r) {
        RefineryBatch b = batches.findById(r.batchId()).orElseThrow(() -> new EntityNotFoundException("Batch not found"));
        BigDecimal pure = (r.fineness() != null) ? r.grossWeight().multiply(r.fineness()).divide(THOUSAND, 4, RoundingMode.HALF_UP) : null;
        BatchOutput out = BatchOutput.builder()
            .batchId(r.batchId()).barNo(r.barNo()).form(r.form() == null ? "BAR" : r.form())
            .grossWeight(r.grossWeight()).fineness(r.fineness()).pureWeight(pure)
            .toLotId(r.toLotId()).remarks(r.remarks()).build();
        stamp(out);
        BatchOutput saved = outputs.save(out);
        recompute(b);
        b.setUpdatedBy(ctx.userId()); batches.save(b);
        return toOutput(saved);
    }
    public List<OutputResponse> listOutputs(UUID batchId) {
        return outputs.findByBatchIdOrderByCreatedAtAsc(batchId).stream().map(this::toOutput).toList();
    }

    // ---------- Process steps ----------
    @Transactional
    public StepResponse addStep(StepRequest r) {
        batches.findById(r.batchId()).orElseThrow(() -> new EntityNotFoundException("Batch not found"));
        int next = (r.stepNo() != null) ? r.stepNo() : (steps.findByBatchIdOrderByStepNoAsc(r.batchId()).size() + 1);
        ProcessStep s = ProcessStep.builder()
            .batchId(r.batchId()).stepNo(next).stepName(r.stepName())
            .operatorName(r.operatorName()).startedAt(r.startedAt()).completedAt(r.completedAt()).notes(r.notes())
            .build();
        stamp(s);
        return toStep(steps.save(s));
    }
    public List<StepResponse> listSteps(UUID batchId) {
        return steps.findByBatchIdOrderByStepNoAsc(batchId).stream().map(this::toStep).toList();
    }

    // ---------- Recovery / loss recompute ----------
    private void recompute(RefineryBatch b) {
        var ins  = inputs.findByBatchIdOrderByCreatedAtAsc(b.getId());
        var outs = outputs.findByBatchIdOrderByCreatedAtAsc(b.getId());
        BigDecimal inGross = ins.stream().map(BatchInput::getGrossWeight).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal inPure  = ins.stream().map(BatchInput::getPureWeight).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outGross = outs.stream().map(BatchOutput::getGrossWeight).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outPure  = outs.stream().map(BatchOutput::getPureWeight).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        b.setInputGross(inGross); b.setInputPure(inPure);
        b.setOutputGross(outGross); b.setOutputPure(outPure);
        BigDecimal loss = inGross.subtract(outGross);
        b.setLossGross(loss);
        if (inGross.signum() > 0) {
            b.setLossPct(loss.multiply(HUNDRED).divide(inGross, 4, RoundingMode.HALF_UP));
        } else { b.setLossPct(null); }
        if (outGross.signum() > 0 && outPure.signum() > 0) {
            b.setActualFineness(outPure.multiply(THOUSAND).divide(outGross, 3, RoundingMode.HALF_UP));
        }
    }

    // ---------- helpers ----------
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private BatchResponse toBatch(RefineryBatch b) {
        return new BatchResponse(b.getId(), b.getBatchNumber(), b.getBranchId(), b.getCustomerId(),
            b.getMetal(), b.getMethod(), b.getStartDate(), b.getCompletedDate(),
            b.getInputGross(), b.getInputPure(), b.getOutputGross(), b.getOutputPure(),
            b.getLossGross(), b.getLossPct(), b.getExpectedFineness(), b.getActualFineness(),
            b.getStatus(), b.getRemarks());
    }
    private InputResponse toInput(BatchInput i) {
        return new InputResponse(i.getId(), i.getBatchId(), i.getLotId(), i.getSourceLabel(),
            i.getGrossWeight(), i.getFineness(), i.getPureWeight(), i.getRemarks());
    }
    private OutputResponse toOutput(BatchOutput o) {
        return new OutputResponse(o.getId(), o.getBatchId(), o.getBarNo(), o.getForm(),
            o.getGrossWeight(), o.getFineness(), o.getPureWeight(), o.getToLotId(), o.getRemarks());
    }
    private StepResponse toStep(ProcessStep s) {
        return new StepResponse(s.getId(), s.getBatchId(), s.getStepNo(), s.getStepName(),
            s.getOperatorName(), s.getStartedAt(), s.getCompletedAt(), s.getNotes());
    }
}
