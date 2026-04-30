package com.nexus.admin.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * Customer master — the entity placing testing / hallmarking / refinery orders.
 */
@Entity
@Table(name = "customers", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "customer_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Customer extends BaseEntity {

    @Column(name = "customer_number", nullable = false, length = 30)
    private String customerNumber;          // e.g. "001"

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "company")
    private String company;

    @Column(name = "gstin", length = 20)
    private String gstin;

    @Column(name = "bis_number", length = 50)
    private String bisNumber;

    @Column(name = "pan", length = 15)
    private String pan;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "email")
    private String email;

    @Column(name = "address_line1")
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "state", length = 100)
    private String state;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    @Builder.Default
    private CustomerType type = CustomerType.JEWELLER;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    public enum CustomerType {
        JEWELLER, RETAIL, WHOLESALE, REFINERY, INTERNAL_BRANCH
    }
}
