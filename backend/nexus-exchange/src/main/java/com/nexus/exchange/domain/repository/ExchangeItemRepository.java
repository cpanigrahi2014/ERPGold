package com.nexus.exchange.domain.repository;

import com.nexus.exchange.domain.model.ExchangeItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExchangeItemRepository extends JpaRepository<ExchangeItem, UUID> {
    List<ExchangeItem> findByTxnIdOrderByCreatedAtAsc(UUID txnId);
    List<ExchangeItem> findByTxnIdAndSideOrderByCreatedAtAsc(UUID txnId, ExchangeItem.Side side);
}
