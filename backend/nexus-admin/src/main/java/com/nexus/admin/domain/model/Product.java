package com.nexus.admin.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * Item / Product catalog (e.g. "Ring", "Chain", "Bangle").
 */
@Entity
@Table(name = "products", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Product extends BaseEntity {

    @Column(name = "code", nullable = false, length = 30)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ItemCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_metal", length = 20)
    @Builder.Default
    private Metal defaultMetal = Metal.GOLD;

    @Column(name = "hsn_code", length = 20)
    private String hsnCode;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    public enum Metal { GOLD, SILVER, PLATINUM }
}
