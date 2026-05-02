package com.nexus.laser.domain.repository;

import com.nexus.laser.domain.model.LaserReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface LaserReportRepository extends JpaRepository<LaserReport, UUID> {
    List<LaserReport> findByTenantIdOrderByReportDateDesc(UUID tenantId);
    List<LaserReport> findByTenantIdAndReportDateOrderByCreatedAtDesc(UUID tenantId, LocalDate reportDate);
}
