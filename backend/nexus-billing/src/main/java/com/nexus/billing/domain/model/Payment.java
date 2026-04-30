package com.nexus.billing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "invoice_payments", indexes = {
    @Index(name = "ix_ip_invoice", columnList = "invoice_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment extends BaseEntity {
    @Column(name = "invoice_id", nullable = false) private UUID invoiceId;
    @Column(name = "payment_date", nullable = false) private LocalDate paymentDate;
    @Column(name = "amount", nullable = false, precision = 16, scale = 2) private BigDecimal amount;

    @Enumerated(EnumType.STRING) @Column(name = "method", nullable = false, length = 20)
    @Builder.Default private Method method = Method.CASH;

    @Column(name = "reference_no", length = 80) private String referenceNo;
    @Column(name = "remarks", length = 300) private String remarks;

    public enum Method { CASH, CARD, UPI, BANK_TRANSFER, CHEQUE, ADJUSTMENT }
}
