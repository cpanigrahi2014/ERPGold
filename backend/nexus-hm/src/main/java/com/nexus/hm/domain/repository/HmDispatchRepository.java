package com.nexus.hm.domain.repository;

import com.nexus.hm.domain.model.HmDispatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HmDispatchRepository extends JpaRepository<HmDispatch, UUID> {
    Optional<HmDispatch> findByJobId(UUID jobId);
}
