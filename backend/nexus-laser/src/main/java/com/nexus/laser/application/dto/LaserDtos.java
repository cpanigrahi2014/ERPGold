package com.nexus.laser.application.dto;

import com.nexus.laser.domain.model.LaserJob;
import com.nexus.laser.domain.model.LaserMark;
import com.nexus.laser.domain.model.LaserTransaction;
import com.nexus.laser.domain.model.LaserReport;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class LaserDtos {

    public record MachineRequest(
        @NotBlank String code, @NotBlank String name, @NotNull UUID branchId,
        String model, Integer maxPowerW, Boolean active
    ) {}
    public record MachineResponse(
        UUID id, String code, String name, UUID branchId, String model, Integer maxPowerW, boolean active
    ) {}

    public record JobRequest(
        String jobNumber,
        @NotNull UUID branchId,
        @NotNull UUID customerId,
        UUID lotId, UUID machineId,
        LocalDate receivedDate, LocalDate dueDate,
        @Min(1) Integer pieceCount,
        String markingText, String font,
        BigDecimal depthMm, Integer powerPct, Integer speedMmps,
        BigDecimal ratePerPiece, String remarks
    ) {}
    public record JobResponse(
        UUID id, String jobNumber, UUID branchId, UUID customerId, UUID lotId, UUID machineId,
        LocalDate receivedDate, LocalDate dueDate, LocalDate completedDate,
        int pieceCount, String markingText, String font,
        BigDecimal depthMm, Integer powerPct, Integer speedMmps,
        LaserJob.Status status, BigDecimal ratePerPiece, String remarks
    ) {}

    public record MarkRequest(
        @NotNull UUID jobId, @Min(1) int pieceNo,
        String engravedText, BigDecimal pieceWeight,
        String operatorName, LaserMark.Result result, String remarks
    ) {}
    public record MarkResponse(
        UUID id, UUID jobId, int pieceNo, String engravedText, BigDecimal pieceWeight,
        String operatorName, LaserMark.Result result, String remarks
    ) {}

    public record TransactionRequest(
        @NotNull UUID jobId, @NotBlank String orderId,
        @NotNull LaserTransaction.Type type,
        int nonHuidQty, int sealQty, @Min(1) int totalMarkings
    ) {}
    public record TransactionResponse(
        UUID id, UUID jobId, String orderId, LaserTransaction.Type type,
        int nonHuidQty, int sealQty, int totalMarkings
    ) {}

    public record ReportRequest(
        @NotBlank String fileName, @Min(0) long totalPartNum,
        long currentPartNumber, long previousPartNumber, long difference,
        @NotNull LocalDate reportDate
    ) {}
    public record ReportResponse(
        UUID id, String fileName, long totalPartNum,
        long currentPartNumber, long previousPartNumber, long difference, LocalDate reportDate
    ) {}
}
