package com.nexus.testing.domain.repository;

import com.nexus.testing.domain.model.TestingResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TestingResultRepository extends JpaRepository<TestingResult, UUID> {
    List<TestingResult> findByJobIdOrderBySampleNoAsc(UUID jobId);
}
