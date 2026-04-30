package com.nexus.testing.application.dto;

import com.nexus.testing.domain.model.TestingJob;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class TestingDtos {

    public record JobRequest(
        String jobNumber,
        @NotNull UUID branchId,
        @NotNull UUID customerId,
        UUID lotId,
        @NotNull TestingJob.Method method,
        LocalDate receivedDate,
        LocalDate dueDate,
        @Min(1) Integer sampleCount,
        BigDecimal grossWeight,
        BigDecimal rate,
        String remarks
    ) {}

    public record JobResponse(
        UUID id, String jobNumber, UUID branchId, UUID customerId, UUID lotId,
        TestingJob.Method method, LocalDate receivedDate, LocalDate dueDate, LocalDate completedDate,
        int sampleCount, BigDecimal grossWeight, BigDecimal rate,
        TestingJob.Status status, String remarks
    ) {}

    public record ResultRequest(
        @NotNull UUID jobId,
        @Min(1) int sampleNo,
        BigDecimal sampleWeight,
        BigDecimal auPct, BigDecimal agPct, BigDecimal cuPct, BigDecimal znPct,
        BigDecimal niPct, BigDecimal pdPct, BigDecimal ptPct, BigDecimal otherPct,
        BigDecimal fineness,
        String testedByName, String remarks
    ) {}

    public record ResultResponse(
        UUID id, UUID jobId, int sampleNo, BigDecimal sampleWeight,
        BigDecimal auPct, BigDecimal agPct, BigDecimal cuPct, BigDecimal znPct,
        BigDecimal niPct, BigDecimal pdPct, BigDecimal ptPct, BigDecimal otherPct,
        BigDecimal fineness, String testedByName, String remarks
    ) {}

    public record CertificateRequest(
        @NotNull UUID jobId, String issuedByName, String remarks
    ) {}

    public record CertificateResponse(
        UUID id, String certificateNo, UUID jobId, LocalDate issuedOn,
        String issuedByName, BigDecimal averageFineness, String remarks
    ) {}
}
