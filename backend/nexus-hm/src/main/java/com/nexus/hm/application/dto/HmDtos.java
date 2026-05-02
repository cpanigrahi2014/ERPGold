package com.nexus.hm.application.dto;

import com.nexus.hm.domain.model.HmDeliveryOrder;
import com.nexus.hm.domain.model.HmDeliveryReturn;
import com.nexus.hm.domain.model.HmJob;
import com.nexus.hm.domain.model.HmMark;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
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
        String remarks,
        String workflowData
    ) {}

    public record JobResponse(
        UUID id, String jobNumber, UUID branchId, UUID jewellerId, UUID lotId,
        HmJob.Kind kind, LocalDate receivedDate, LocalDate markedDate, LocalDate dispatchedDate,
        String purityLabel, BigDecimal declaredFineness, BigDecimal assayedFineness,
        int pieceCount, BigDecimal grossWeight, boolean huidRequired,
        HmJob.Status status, BigDecimal ratePerPiece, String remarks, String workflowData
    ) {}

    public record JobUpdateRequest(
        HmJob.Status status,
        String workflowData
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

    // ── Delivery Orders ──────────────────────────────────────────────────────

    public record DeliveryOrderCreateRequest(
        @NotBlank String customerName,
        UUID customerId,
        @NotNull HmDeliveryOrder.DeliveryType deliveryType,
        String remarks
    ) {}

    public record DeliveryOrderPickupRequest(
        BigDecimal customerGrossWeight,
        BigDecimal customerNetWeight
    ) {}

    public record DeliveryOrderReceiveRequest(
        @Min(1) int phcQuantity,
        BigDecimal phcGrossWeight,
        String declaredPurity
    ) {}

    public record DeliveryOrderResponse(
        UUID id, String orderNumber, UUID customerId, String customerName,
        HmDeliveryOrder.DeliveryType deliveryType, HmDeliveryOrder.Status status,
        BigDecimal customerGrossWeight, BigDecimal customerNetWeight,
        Integer phcQuantity, BigDecimal phcGrossWeight, String declaredPurity,
        String remarks, Instant createdAt
    ) {}

    // ── Delivery Returns ─────────────────────────────────────────────────────

    public record DeliveryReturnCreateRequest(
        @NotBlank String customerName,
        UUID customerId,
        UUID orderId,
        String orderNumber,
        String deliveryDetails,
        String remarks
    ) {}

    public record DeliveryReturnResponse(
        UUID id, String returnNumber, UUID orderId, String orderNumber,
        UUID customerId, String customerName,
        String deliveryDetails, String remarks,
        HmDeliveryReturn.Status status, LocalDate deliveryDate,
        Instant createdAt
    ) {}
}
