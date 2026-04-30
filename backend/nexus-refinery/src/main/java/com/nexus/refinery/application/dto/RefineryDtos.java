package com.nexus.refinery.application.dto;

import com.nexus.refinery.domain.model.RefineryBatch;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class RefineryDtos {

    public record BatchRequest(
        String batchNumber,
        @NotNull UUID branchId,
        UUID customerId,
        RefineryBatch.Metal metal,
        RefineryBatch.Method method,
        LocalDate startDate,
        BigDecimal expectedFineness,
        String remarks
    ) {}

    public record BatchResponse(
        UUID id, String batchNumber, UUID branchId, UUID customerId,
        RefineryBatch.Metal metal, RefineryBatch.Method method,
        LocalDate startDate, LocalDate completedDate,
        BigDecimal inputGross, BigDecimal inputPure,
        BigDecimal outputGross, BigDecimal outputPure,
        BigDecimal lossGross, BigDecimal lossPct,
        BigDecimal expectedFineness, BigDecimal actualFineness,
        RefineryBatch.Status status, String remarks
    ) {}

    public record InputRequest(
        @NotNull UUID batchId, UUID lotId, String sourceLabel,
        @NotNull @Positive BigDecimal grossWeight, BigDecimal fineness, String remarks
    ) {}
    public record InputResponse(
        UUID id, UUID batchId, UUID lotId, String sourceLabel,
        BigDecimal grossWeight, BigDecimal fineness, BigDecimal pureWeight, String remarks
    ) {}

    public record OutputRequest(
        @NotNull UUID batchId, String barNo, String form,
        @NotNull @Positive BigDecimal grossWeight, BigDecimal fineness, UUID toLotId, String remarks
    ) {}
    public record OutputResponse(
        UUID id, UUID batchId, String barNo, String form,
        BigDecimal grossWeight, BigDecimal fineness, BigDecimal pureWeight, UUID toLotId, String remarks
    ) {}

    public record StepRequest(
        @NotNull UUID batchId, Integer stepNo,
        @NotBlank String stepName, String operatorName,
        LocalDateTime startedAt, LocalDateTime completedAt, String notes
    ) {}
    public record StepResponse(
        UUID id, UUID batchId, int stepNo, String stepName, String operatorName,
        LocalDateTime startedAt, LocalDateTime completedAt, String notes
    ) {}
}
