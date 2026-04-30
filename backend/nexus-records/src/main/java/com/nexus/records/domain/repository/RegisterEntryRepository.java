package com.nexus.records.domain.repository;

import com.nexus.records.domain.model.RegisterEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RegisterEntryRepository extends JpaRepository<RegisterEntry, UUID> {
    List<RegisterEntry> findByTenantIdAndRegisterTypeAndEntryDateBetweenOrderBySerialNoAsc(
        UUID tenantId, RegisterEntry.RegisterType registerType, LocalDate from, LocalDate to);
    List<RegisterEntry> findByTenantIdAndRegisterTypeOrderBySerialNoAsc(UUID tenantId, RegisterEntry.RegisterType registerType);
    Optional<RegisterEntry> findTopByTenantIdAndRegisterTypeOrderBySerialNoDesc(UUID tenantId, RegisterEntry.RegisterType registerType);
}
