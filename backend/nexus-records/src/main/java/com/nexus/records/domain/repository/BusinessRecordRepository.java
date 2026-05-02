package com.nexus.records.domain.repository;

import com.nexus.records.domain.model.BusinessRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BusinessRecordRepository extends JpaRepository<BusinessRecord, UUID> {
    List<BusinessRecord> findByTenantIdOrderByYearDescMonthDescCreatedAtDesc(UUID tenantId);
    Optional<BusinessRecord> findByTenantIdAndBranchRefAndMonthAndYear(UUID tenantId, String branchRef, int month, int year);
}
