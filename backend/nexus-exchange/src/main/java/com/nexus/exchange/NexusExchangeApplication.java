package com.nexus.exchange;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication(scanBasePackages = {"com.nexus.exchange", "com.nexus.common"})
@EntityScan({"com.nexus.exchange.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
public class NexusExchangeApplication {
    public static void main(String[] args) { SpringApplication.run(NexusExchangeApplication.class, args); }
}
