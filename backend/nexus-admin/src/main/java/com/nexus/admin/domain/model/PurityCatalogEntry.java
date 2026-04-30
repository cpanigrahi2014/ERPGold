package com.nexus.admin.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Purity catalog entry (e.g. "K22", "995", "91.9").
 * Drives Pass / Fail thresholds in Fire Assay & Titration:
 *   "K22"  -> 916.667 (22/24 * 1000)
 *   "995"  -> 995 (already in fineness scale)
 *   "91.9" -> 919 (percentage * 10)
 */
@Entity
@Table(name = "purity_catalog", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "label"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PurityCatalogEntry extends BaseEntity {

    @Column(name = "label", nullable = false, length = 20)
    private String label;                           // "K22", "995", "91.9"

    @Column(name = "fineness_threshold", nullable = false, precision = 8, scale = 3)
    private BigDecimal finenessThreshold;           // 916.667, 995, 919

    @Enumerated(EnumType.STRING)
    @Column(name = "metal", nullable = false, length = 20)
    @Builder.Default
    private Product.Metal metal = Product.Metal.GOLD;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    /** Convert any label to a fineness threshold using the documented rules. */
    public static BigDecimal computeThreshold(String label) {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("purity label is required");
        }
        String trimmed = label.trim();
        if (trimmed.startsWith("K") || trimmed.startsWith("k")) {
            int karat = Integer.parseInt(trimmed.substring(1));
            return BigDecimal.valueOf(karat)
                    .divide(BigDecimal.valueOf(24), 6, java.math.RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(1000));
        }
        BigDecimal num = new BigDecimal(trimmed);
        // values < 100 are percentages (91.9 -> 919); >=100 already in fineness scale
        if (num.compareTo(BigDecimal.valueOf(100)) < 0) {
            return num.multiply(BigDecimal.TEN);
        }
        return num;
    }
}
