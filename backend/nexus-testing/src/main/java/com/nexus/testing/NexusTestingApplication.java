package com.nexus.testing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.testing", "com.nexus.common"})
@EntityScan({"com.nexus.testing.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusTestingApplication {
    public static void main(String[] args) { SpringApplication.run(NexusTestingApplication.class, args); }
}
