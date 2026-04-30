package com.nexus.inventory.domain.repository;

import com.nexus.inventory.domain.model.Lot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LotRepository extends JpaRepository<Lot, UUID> {
    Optional<Lot> findByTenantIdAndLotNumber(UUID tenantId, String lotNumber);
    List<Lot> findByTenantIdAndStatusOrderByReceivedDateDesc(UUID tenantId, Lot.Status status);
    List<Lot> findByTenantIdAndCustomerId(UUID tenantId, UUID customerId);
}
