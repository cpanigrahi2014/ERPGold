package com.nexus.hm.domain.repository;

import com.nexus.hm.domain.model.HmMark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HmMarkRepository extends JpaRepository<HmMark, UUID> {
    List<HmMark> findByJobIdOrderByPieceNoAsc(UUID jobId);
    long countByJobIdAndResult(UUID jobId, HmMark.Result result);
}
