package com.nexus.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.admin", "com.nexus.common"})
@EntityScan(basePackages = {"com.nexus.admin.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusAdminApplication {
    public static void main(String[] args) {
        SpringApplication.run(NexusAdminApplication.class, args);
    }
}
