package com.nexus.laser;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.laser", "com.nexus.common"})
@EntityScan({"com.nexus.laser.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusLaserApplication {
    public static void main(String[] args) { SpringApplication.run(NexusLaserApplication.class, args); }
}
