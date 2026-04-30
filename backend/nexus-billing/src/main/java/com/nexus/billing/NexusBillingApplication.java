package com.nexus.billing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.billing", "com.nexus.common"})
@EntityScan({"com.nexus.billing.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusBillingApplication {
    public static void main(String[] args) { SpringApplication.run(NexusBillingApplication.class, args); }
}
