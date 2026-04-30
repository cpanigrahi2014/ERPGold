package com.nexus.records;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.records", "com.nexus.common"})
@EntityScan({"com.nexus.records.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusRecordsApplication {
    public static void main(String[] args) { SpringApplication.run(NexusRecordsApplication.class, args); }
}
