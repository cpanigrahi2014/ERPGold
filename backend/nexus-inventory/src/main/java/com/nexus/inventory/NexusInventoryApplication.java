package com.nexus.inventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.inventory", "com.nexus.common"})
@EntityScan({"com.nexus.inventory.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusInventoryApplication {
    public static void main(String[] args) {
        SpringApplication.run(NexusInventoryApplication.class, args);
    }
}
