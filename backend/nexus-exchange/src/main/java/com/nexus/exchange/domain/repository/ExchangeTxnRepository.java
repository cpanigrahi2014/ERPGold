package com.nexus.exchange.domain.repository;

import com.nexus.exchange.domain.model.ExchangeTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExchangeTxnRepository extends JpaRepository<ExchangeTxn, UUID> {
    List<ExchangeTxn> findByTenantIdOrderByExchangeDateDesc(UUID tenantId);
    List<ExchangeTxn> findByTenantIdAndStatusOrderByExchangeDateDesc(UUID tenantId, ExchangeTxn.Status status);
}
