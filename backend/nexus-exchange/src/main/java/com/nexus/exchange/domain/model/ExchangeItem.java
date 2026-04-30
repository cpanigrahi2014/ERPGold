package com.nexus.exchange.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "exchange_items", indexes = {
    @Index(name = "ix_xi_txn", columnList = "txn_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExchangeItem extends BaseEntity {
    @Column(name = "txn_id", nullable = false) private UUID txnId;

    @Enumerated(EnumType.STRING) @Column(name = "side", nullable = false, length = 10)
    @Builder.Default private Side side = Side.OLD;

    @Column(name = "item_desc",  length = 200) private String itemDesc;
    @Column(name = "hsn_code",   length = 20)  private String hsnCode;
    @Column(name = "gross_weight", nullable = false, precision = 14, scale = 4) private BigDecimal grossWeight;
    @Column(name = "fineness",   precision = 7,  scale = 3) private BigDecimal fineness;
    @Column(name = "pure_weight",precision = 14, scale = 4) private BigDecimal pureWeight;
    @Column(name = "rate_per_gram",  precision = 14, scale = 2) private BigDecimal ratePerGram;
    @Column(name = "making_charges", precision = 16, scale = 2) private BigDecimal makingCharges;
    @Column(name = "line_value",     precision = 16, scale = 2) private BigDecimal lineValue;
    @Column(name = "lot_id") private UUID lotId;
    @Column(name = "remarks", length = 500) private String remarks;

    public enum Side { OLD, NEW }
}
