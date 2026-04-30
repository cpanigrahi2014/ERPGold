package com.nexus.hm.application.dto;

import com.nexus.hm.domain.model.HmJob;
import com.nexus.hm.domain.model.HmMark;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class HmDtos {

    public record JobRequest(
        String jobNumber,
        @NotNull UUID branchId,
        @NotNull UUID jewellerId,
        UUID lotId,
        @NotNull HmJob.Kind kind,
        LocalDate receivedDate,
        String purityLabel,
        BigDecimal declaredFineness,
        @Min(1) Integer pieceCount,
        BigDecimal grossWeight,
        Boolean huidRequired,
        BigDecimal ratePerPiece,
        String remarks
    ) {}

    public record JobResponse(
        UUID id, String jobNumber, UUID branchId, UUID jewellerId, UUID lotId,
        HmJob.Kind kind, LocalDate receivedDate, LocalDate markedDate, LocalDate dispatchedDate,
        String purityLabel, BigDecimal declaredFineness, BigDecimal assayedFineness,
        int pieceCount, BigDecimal grossWeight, boolean huidRequired,
        HmJob.Status status, BigDecimal ratePerPiece, String remarks
    ) {}

    public record MarkRequest(
        @NotNull UUID jobId,
        @Min(1) int pieceNo,
        String huidCode,         // optional — auto-generated if blank and HUID job
        String markedPurity,
        BigDecimal pieceWeight,
        String markedByName,
        HmMark.Result result,
        String remarks
    ) {}

    public record MarkResponse(
        UUID id, UUID jobId, int pieceNo, String huidCode, String markedPurity,
        BigDecimal pieceWeight, String markedByName, HmMark.Result result, String remarks
    ) {}

    public record DispatchRequest(
        @NotNull UUID jobId,
        @NotNull String receivedByName,
        @Min(1) int pieceCount,
        BigDecimal grossWeight,
        String remarks
    ) {}

    public record DispatchResponse(
        UUID id, String dispatchNo, UUID jobId, LocalDate dispatchedOn,
        String receivedByName, int pieceCount, BigDecimal grossWeight, String remarks
    ) {}
}
