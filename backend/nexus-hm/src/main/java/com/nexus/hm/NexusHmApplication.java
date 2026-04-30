package com.nexus.hm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.hm", "com.nexus.common"})
@EntityScan({"com.nexus.hm.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusHmApplication {
    public static void main(String[] args) { SpringApplication.run(NexusHmApplication.class, args); }
}
