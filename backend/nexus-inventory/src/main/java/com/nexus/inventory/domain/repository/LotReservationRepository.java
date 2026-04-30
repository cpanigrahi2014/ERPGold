package com.nexus.inventory.domain.repository;

import com.nexus.inventory.domain.model.LotReservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LotReservationRepository extends JpaRepository<LotReservation, UUID> {
    List<LotReservation> findByLotIdAndStatus(UUID lotId, LotReservation.Status status);
}
