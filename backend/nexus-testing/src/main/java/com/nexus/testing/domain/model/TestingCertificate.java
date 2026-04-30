package com.nexus.testing.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "testing_certificates", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "certificate_no"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestingCertificate extends BaseEntity {

    @Column(name = "certificate_no", nullable = false, length = 40) private String certificateNo;
    @Column(name = "job_id", nullable = false) private UUID jobId;
    @Column(name = "issued_on", nullable = false) private LocalDate issuedOn;
    @Column(name = "issued_by_name", length = 120) private String issuedByName;
    @Column(name = "average_fineness", precision = 7, scale = 3) private BigDecimal averageFineness;
    @Column(name = "remarks", length = 500) private String remarks;
}
