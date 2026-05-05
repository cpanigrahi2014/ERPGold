package com.nexus.records.application.dto;

import com.nexus.records.domain.model.DayBookEntry;
import com.nexus.records.domain.model.RegisterEntry;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public class RecordsDtos {

    public record DayBookRequest(
        LocalDate entryDate,
        @NotNull UUID branchId,
        @NotNull DayBookEntry.Module module,
        @NotNull DayBookEntry.TxnType txnType,
        String referenceNo, UUID referenceId,
        UUID partyId, String partyName, String narration,
        BigDecimal metalInG, BigDecimal metalOutG,
        BigDecimal amountIn, BigDecimal amountOut
    ) {}

    public record DayBookResponse(
        UUID id, LocalDate entryDate, UUID branchId,
        DayBookEntry.Module module, DayBookEntry.TxnType txnType,
        String referenceNo, UUID referenceId,
        UUID partyId, String partyName, String narration,
        BigDecimal metalInG, BigDecimal metalOutG,
        BigDecimal amountIn, BigDecimal amountOut
    ) {}

    public record DaySummary(
        LocalDate date,
        BigDecimal totalMetalInG, BigDecimal totalMetalOutG,
        BigDecimal totalAmountIn, BigDecimal totalAmountOut,
        long entryCount
    ) {}

    public record AuditRequest(
        OffsetDateTime occurredAt,
        @NotNull DayBookEntry.Module module,
        @NotNull String action,
        String entityType, UUID entityId,
        UUID actorId, String actorName, String ipAddress,
        String summary, String beforeJson, String afterJson
    ) {}

    public record AuditResponse(
        UUID id, OffsetDateTime occurredAt,
        DayBookEntry.Module module, String action,
        String entityType, UUID entityId,
        UUID actorId, String actorName, String ipAddress,
        String summary, String beforeJson, String afterJson
    ) {}

    public record RegisterRequest(
        @NotNull RegisterEntry.RegisterType registerType,
        LocalDate entryDate,
        UUID branchId, String metal, String purityLabel,
        String particulars, String voucherNo, String partyName,
        BigDecimal qtyIn, BigDecimal qtyOut,
        BigDecimal valueIn, BigDecimal valueOut
    ) {}

    public record RegisterResponse(
        UUID id, RegisterEntry.RegisterType registerType,
        LocalDate entryDate, long serialNo,
        UUID branchId, String metal, String purityLabel,
        String particulars, String voucherNo, String partyName,
        BigDecimal qtyIn, BigDecimal qtyOut, BigDecimal balance,
        BigDecimal valueIn, BigDecimal valueOut
    ) {}

    public record BusinessRecordCreateRequest(
        @NotBlank String branchRef,
        @NotBlank String branchCode,
        @NotBlank String branchName,
        @Min(1) @Max(12) int month,
        @Min(2000) int year,
        @NotBlank String name
    ) {}

    public record BusinessRecordUpdateRequest(
        String name,
        String cashRows,
        String expenseRows,
        String huidRows,
        String refineryRows,
        String bankRows,
        String marketDueRows,
        String corporateExpenseRows
    ) {}

    public record BusinessRecordResponse(
        UUID id,
        String branchRef,
        String branchCode,
        String branchName,
        int month,
        int year,
        String name,
        String cashRows,
        String expenseRows,
        String huidRows,
        String refineryRows,
        String bankRows,
        String marketDueRows,
        String corporateExpenseRows,
        String exportFileName,
        String exportContentType,
        Boolean hasExportAttachment,
        Instant exportGeneratedAt,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record BusinessRecordExportRequest(
        @NotBlank String branchCode,
        @NotNull LocalDate fromDate,
        @NotNull LocalDate toDate
    ) {}
}
