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
}
