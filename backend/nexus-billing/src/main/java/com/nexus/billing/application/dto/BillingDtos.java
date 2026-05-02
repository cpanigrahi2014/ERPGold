package com.nexus.billing.application.dto;

import com.nexus.billing.domain.model.Invoice;
import com.nexus.billing.domain.model.Payment;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class BillingDtos {

    public record InvoiceRequest(
        String invoiceNumber,
        @NotNull UUID branchId,
        @NotNull UUID customerId,
        LocalDate invoiceDate,
        LocalDate dueDate,
        Invoice.InvoiceType type,
        String placeOfSupply,
        Boolean interstate,
        String remarks
    ) {}

    public record InvoiceResponse(
        UUID id, String invoiceNumber, UUID branchId, UUID customerId,
        LocalDate invoiceDate, LocalDate dueDate,
        Invoice.InvoiceType type, String placeOfSupply, Boolean interstate,
        BigDecimal subtotal, BigDecimal makingTotal, BigDecimal discountTotal,
        BigDecimal taxableAmount, BigDecimal cgstAmount, BigDecimal sgstAmount, BigDecimal igstAmount,
        BigDecimal roundOff, BigDecimal grandTotal,
        BigDecimal paidAmount, BigDecimal balanceAmount,
        Invoice.Status status, String remarks
    ) {}

    public record LineRequest(
        @NotNull UUID invoiceId,
        Integer lineNo,
        String itemDesc, String hsnCode,
        UUID lotId, UUID productId,
        @NotNull @Positive BigDecimal grossWeight,
        BigDecimal fineness,
        BigDecimal ratePerGram,
        BigDecimal makingCharges,
        BigDecimal discount,
        BigDecimal taxRatePct
    ) {}

    public record LineResponse(
        UUID id, UUID invoiceId, int lineNo,
        String itemDesc, String hsnCode, UUID lotId, UUID productId,
        BigDecimal grossWeight, BigDecimal fineness, BigDecimal pureWeight,
        BigDecimal ratePerGram, BigDecimal metalValue,
        BigDecimal makingCharges, BigDecimal discount,
        BigDecimal taxableAmount, BigDecimal taxRatePct,
        BigDecimal cgstAmount, BigDecimal sgstAmount, BigDecimal igstAmount,
        BigDecimal lineTotal
    ) {}

    public record PaymentRequest(
        @NotNull UUID invoiceId,
        LocalDate paymentDate,
        @NotNull @Positive BigDecimal amount,
        Payment.Method method,
        String referenceNo, String remarks
    ) {}

    public record PaymentResponse(
        UUID id, UUID invoiceId, LocalDate paymentDate,
        BigDecimal amount, Payment.Method method,
        String referenceNo, String remarks
    ) {}

    public record DepositRequest(
        @NotBlank String customerId,
        @NotBlank String branchCode,
        @NotNull @Positive BigDecimal amount
    ) {}

    public record DepositResponse(
        UUID id, String customerId, String branchCode,
        BigDecimal amount, BigDecimal remaining, String createdAt
    ) {}

    public record ExchangeRequest(
        @NotBlank String customerId,
        @NotBlank String branchCode,
        @NotNull @Positive BigDecimal goldGrams,
        @NotNull @Positive BigDecimal purity,
        BigDecimal cashComponent
    ) {}

    public record ExchangeResponse(
        UUID id, String customerId, String branchCode,
        BigDecimal goldGrams, BigDecimal purity,
        BigDecimal cashComponent, BigDecimal grandTotal,
        String createdAt
    ) {}

    public record PaymentRegisterRequest(
        @NotBlank String customerId,
        @NotBlank String branchCode,
        @NotNull @Positive BigDecimal amount,
        @NotBlank String tender,
        BigDecimal goldGrams,
        BigDecimal purity
    ) {}

    public record PaymentRegisterResponse(
        UUID id, String customerId, String branchCode,
        BigDecimal amount, String tender,
        BigDecimal goldGrams, BigDecimal purity,
        String createdAt
    ) {}

    public record ScrapLogResponse(
        UUID id, UUID linkedPaymentId,
        String customerId, String branchCode,
        BigDecimal goldGrams, BigDecimal purity, BigDecimal pureGold,
        String createdAt
    ) {}

    public record DiscountRequest(
        @NotBlank String customerId,
        @NotBlank String branchCode,
        @NotNull @Positive BigDecimal discountAmount
    ) {}

    public record DiscountResponse(
        UUID id, String customerId, String branchCode,
        BigDecimal discountAmount, String status,
        Boolean customerLedgerPosted, Boolean branchLedgerPosted,
        String createdAt, String approvedAt
    ) {}

    public record ScrapReportResponse(
        BigDecimal expectedPureGold,
        BigDecimal actualPureGold,
        BigDecimal variance,
        BigDecimal wtAvgPurityExpected,
        BigDecimal wtAvgPurityActual,
        String generatedAt
    ) {}
}
