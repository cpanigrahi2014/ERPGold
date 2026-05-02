package com.nexus.hm.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "hm_delivery_returns", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "return_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HmDeliveryReturn extends BaseEntity {

    @Column(name = "return_number", nullable = false, length = 40) private String returnNumber;
    @Column(name = "order_id") private UUID orderId;
    @Column(name = "order_number", length = 40) private String orderNumber;
    @Column(name = "customer_id") private UUID customerId;
    @Column(name = "customer_name", nullable = false, length = 200) private String customerName;
    @Column(name = "delivery_details", length = 500) private String deliveryDetails;
    @Column(name = "remarks", length = 500) private String remarks;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20)
    @Builder.Default private Status status = Status.CREATED;

    @Column(name = "delivery_date") private LocalDate deliveryDate;

    public enum Status { CREATED, DELIVERED }
}
