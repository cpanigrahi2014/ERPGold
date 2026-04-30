package com.nexus.inventory.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "lots", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "lot_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Lot extends BaseEntity {

    @Column(name = "lot_number", nullable = false, length = 40)
    private String lotNumber;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "current_location_id")
    private UUID currentLocationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "metal", nullable = false, length = 20)
    private Metal metal;

    @Column(name = "purity_label", length = 20)
    private String purityLabel;

    @Column(name = "declared_fineness", precision = 7, scale = 3)
    private BigDecimal declaredFineness;

    @Column(name = "assayed_fineness", precision = 7, scale = 3)
    private BigDecimal assayedFineness;

    @Column(name = "gross_weight", nullable = false, precision = 14, scale = 4)
    private BigDecimal grossWeight;

    @Column(name = "net_weight", precision = 14, scale = 4)
    private BigDecimal netWeight;

    @Column(name = "fine_weight", precision = 14, scale = 4)
    private BigDecimal fineWeight;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private Status status = Status.RECEIVED;

    @Column(name = "parent_lot_id")
    private UUID parentLotId;

    @Column(name = "remarks", length = 500)
    private String remarks;

    public enum Metal { GOLD, SILVER, PLATINUM, OTHER }
    public enum Status { RECEIVED, IN_TESTING, IN_REFINERY, IN_LASER, READY, RETURNED, EXCHANGED, SCRAPPED, CLOSED }
}
