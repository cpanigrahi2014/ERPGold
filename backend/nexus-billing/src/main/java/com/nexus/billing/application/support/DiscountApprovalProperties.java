package com.nexus.billing.application.support;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "nexus.billing.discount.approval")
@Getter
@Setter
public class DiscountApprovalProperties {
    private BigDecimal defaultThreshold = new BigDecimal("500");
    private Map<String, BigDecimal> branchThresholds = new HashMap<>();
}
