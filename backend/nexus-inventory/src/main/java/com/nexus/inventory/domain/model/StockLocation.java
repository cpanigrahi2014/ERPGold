package com.nexus.inventory.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "stock_locations", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "branch_id", "code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StockLocation extends BaseEntity {

    @Column(name = "branch_id", nullable = false)
    private java.util.UUID branchId;

    @Column(name = "code", nullable = false, length = 30)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 30)
    private Kind kind;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    public enum Kind { VAULT, WORKBENCH, REFINERY_FLOOR, TESTING_LAB, LASER_BAY, CUSTOMER_HOLD, SCRAP_BIN, OTHER }
}
