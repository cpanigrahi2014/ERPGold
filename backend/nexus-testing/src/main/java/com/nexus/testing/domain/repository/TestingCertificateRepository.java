package com.nexus.testing.domain.repository;

import com.nexus.testing.domain.model.TestingCertificate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TestingCertificateRepository extends JpaRepository<TestingCertificate, UUID> {
    Optional<TestingCertificate> findByJobId(UUID jobId);
}
