package com.nexus.exchange.application.dto;

import com.nexus.exchange.domain.model.ExchangeItem;
import com.nexus.exchange.domain.model.ExchangeTxn;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class ExchangeDtos {

    public record TxnRequest(
        String txnNumber,
        @NotNull UUID branchId,
        @NotNull UUID customerId,
        LocalDate exchangeDate,
        ExchangeTxn.Metal metal,
        BigDecimal valuationRate,
        ExchangeTxn.SettlementType settlementType,
        String remarks
    ) {}

    public record TxnResponse(
        UUID id, String txnNumber, UUID branchId, UUID customerId,
        LocalDate exchangeDate, LocalDate postedDate,
        ExchangeTxn.Metal metal, BigDecimal valuationRate,
        BigDecimal oldGross, BigDecimal oldPure, BigDecimal oldValue,
        BigDecimal newGross, BigDecimal newPure, BigDecimal newValue,
        BigDecimal makingCharges, BigDecimal balancePayable,
        ExchangeTxn.SettlementType settlementType, ExchangeTxn.Status status, String remarks
    ) {}

    public record ItemRequest(
        @NotNull UUID txnId,
        @NotNull ExchangeItem.Side side,
        String itemDesc, String hsnCode,
        @NotNull @Positive BigDecimal grossWeight,
        BigDecimal fineness,
        BigDecimal ratePerGram,
        BigDecimal makingCharges,
        UUID lotId,
        String remarks
    ) {}

    public record ItemResponse(
        UUID id, UUID txnId, ExchangeItem.Side side,
        String itemDesc, String hsnCode,
        BigDecimal grossWeight, BigDecimal fineness, BigDecimal pureWeight,
        BigDecimal ratePerGram, BigDecimal makingCharges, BigDecimal lineValue,
        UUID lotId, String remarks
    ) {}
}
