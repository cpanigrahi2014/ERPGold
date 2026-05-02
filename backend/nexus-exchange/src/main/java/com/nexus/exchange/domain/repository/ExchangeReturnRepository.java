package com.nexus.exchange.domain.repository;

import com.nexus.exchange.domain.model.ExchangeReturn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExchangeReturnRepository extends JpaRepository<ExchangeReturn, UUID> {
    List<ExchangeReturn> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
