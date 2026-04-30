package com.nexus.admin.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "service_types", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ServiceType extends BaseEntity {

    @Column(name = "code", nullable = false, length = 30)
    private String code;            // HUID, XRF, FIRE_ASSAY, TITRATION, NON_HUID, REFINERY, EXCHANGE

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private Category category;

    @Column(name = "hsn_code", length = 20)
    private String hsnCode;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    public enum Category {
        HALLMARKING, TESTING, REFINERY, EXCHANGE, MISCELLANEOUS
    }
}
