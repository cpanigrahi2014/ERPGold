package com.nexus.records.domain.repository;

import com.nexus.records.domain.model.DayBookEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface DayBookEntryRepository extends JpaRepository<DayBookEntry, UUID> {
    List<DayBookEntry> findByTenantIdAndEntryDateOrderByCreatedAtAsc(UUID tenantId, LocalDate entryDate);
    List<DayBookEntry> findByTenantIdAndEntryDateBetweenOrderByEntryDateDescCreatedAtDesc(UUID tenantId, LocalDate from, LocalDate to);
    List<DayBookEntry> findByTenantIdAndBranchIdAndEntryDateBetweenOrderByEntryDateDescCreatedAtDesc(UUID tenantId, UUID branchId, LocalDate from, LocalDate to);
    List<DayBookEntry> findByTenantIdAndModuleOrderByEntryDateDescCreatedAtDesc(UUID tenantId, DayBookEntry.Module module);
}
