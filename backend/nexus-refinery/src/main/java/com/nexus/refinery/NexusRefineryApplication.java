package com.nexus.refinery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.refinery", "com.nexus.common"})
@EntityScan({"com.nexus.refinery.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusRefineryApplication {
    public static void main(String[] args) { SpringApplication.run(NexusRefineryApplication.class, args); }
}
