package com.nexus.refinery.domain.repository;

import com.nexus.refinery.domain.model.BatchOutput;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BatchOutputRepository extends JpaRepository<BatchOutput, UUID> {
    List<BatchOutput> findByBatchIdOrderByCreatedAtAsc(UUID batchId);
}
