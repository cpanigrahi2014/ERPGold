package com.nexus.inventory.application.dto;

import com.nexus.inventory.domain.model.Lot;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record LotResponse(
    UUID id, String lotNumber, UUID branchId, UUID customerId,
    UUID currentLocationId, Lot.Metal metal, String purityLabel,
    BigDecimal declaredFineness, BigDecimal assayedFineness,
    BigDecimal grossWeight, BigDecimal netWeight, BigDecimal fineWeight,
    LocalDate receivedDate, Lot.Status status, UUID parentLotId, String remarks
) {
    public static LotResponse from(Lot l) {
        return new LotResponse(l.getId(), l.getLotNumber(), l.getBranchId(), l.getCustomerId(),
            l.getCurrentLocationId(), l.getMetal(), l.getPurityLabel(),
            l.getDeclaredFineness(), l.getAssayedFineness(),
            l.getGrossWeight(), l.getNetWeight(), l.getFineWeight(),
            l.getReceivedDate(), l.getStatus(), l.getParentLotId(), l.getRemarks());
    }
}
