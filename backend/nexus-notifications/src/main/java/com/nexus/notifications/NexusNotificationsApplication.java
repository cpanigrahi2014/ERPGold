package com.nexus.notifications;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = {"com.nexus.notifications", "com.nexus.common"})
@EntityScan({"com.nexus.notifications.domain", "com.nexus.common.domain"})
@EnableJpaAuditing
@EnableScheduling
public class NexusNotificationsApplication {
    public static void main(String[] args) { SpringApplication.run(NexusNotificationsApplication.class, args); }
}
