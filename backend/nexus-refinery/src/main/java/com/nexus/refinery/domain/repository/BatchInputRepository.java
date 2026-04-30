package com.nexus.refinery.domain.repository;

import com.nexus.refinery.domain.model.BatchInput;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BatchInputRepository extends JpaRepository<BatchInput, UUID> {
    List<BatchInput> findByBatchIdOrderByCreatedAtAsc(UUID batchId);
}
