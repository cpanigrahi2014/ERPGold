package com.nexus.refinery.domain.repository;

import com.nexus.refinery.domain.model.ProcessStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProcessStepRepository extends JpaRepository<ProcessStep, UUID> {
    List<ProcessStep> findByBatchIdOrderByStepNoAsc(UUID batchId);
}
