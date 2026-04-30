package com.nexus.laser.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "laser_machines", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LaserMachine extends BaseEntity {
    @Column(name = "code", nullable = false, length = 30) private String code;
    @Column(name = "name", nullable = false, length = 120) private String name;
    @Column(name = "branch_id", nullable = false) private UUID branchId;
    @Column(name = "model", length = 60) private String model;        // e.g. Fiber 30W
    @Column(name = "max_power_w") private Integer maxPowerW;
    @Column(name = "active", nullable = false) @Builder.Default private boolean active = true;
}
