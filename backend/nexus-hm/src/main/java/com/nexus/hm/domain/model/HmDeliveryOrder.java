package com.nexus.hm.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "hm_delivery_orders", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "order_number"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HmDeliveryOrder extends BaseEntity {

    @Column(name = "order_number", nullable = false, length = 40) private String orderNumber;
    @Column(name = "customer_id") private UUID customerId;
    @Column(name = "customer_name", nullable = false, length = 200) private String customerName;

    @Enumerated(EnumType.STRING) @Column(name = "delivery_type", nullable = false, length = 20)
    private DeliveryType deliveryType;

    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 30)
    @Builder.Default private Status status = Status.AWAITING_PICKUP;

    @Column(name = "customer_gross_weight", precision = 14, scale = 4) private BigDecimal customerGrossWeight;
    @Column(name = "customer_net_weight", precision = 14, scale = 4) private BigDecimal customerNetWeight;
    @Column(name = "phc_quantity") private Integer phcQuantity;
    @Column(name = "phc_gross_weight", precision = 14, scale = 4) private BigDecimal phcGrossWeight;
    @Column(name = "declared_purity", length = 40) private String declaredPurity;
    @Column(name = "remarks", length = 500) private String remarks;

    public enum DeliveryType { PICKUP, DISPATCH }
    public enum Status { AWAITING_PICKUP, IN_TRANSIT, RECEIVED, CANCELLED }
}
