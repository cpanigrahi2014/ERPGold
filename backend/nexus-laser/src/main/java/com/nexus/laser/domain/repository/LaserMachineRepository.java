package com.nexus.laser.domain.repository;

import com.nexus.laser.domain.model.LaserMachine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaserMachineRepository extends JpaRepository<LaserMachine, UUID> {
    List<LaserMachine> findByTenantIdAndActiveTrueOrderByCodeAsc(UUID tenantId);
    List<LaserMachine> findByTenantIdOrderByCodeAsc(UUID tenantId);
}
