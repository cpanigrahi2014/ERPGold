package com.nexus.laser.domain.repository;

import com.nexus.laser.domain.model.LaserMark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaserMarkRepository extends JpaRepository<LaserMark, UUID> {
    List<LaserMark> findByJobIdOrderByPieceNoAsc(UUID jobId);
    long countByJobIdAndResult(UUID jobId, LaserMark.Result result);
}
