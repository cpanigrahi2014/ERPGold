package com.nexus.laser.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "laser_reports", indexes = {
    @Index(name = "ix_lrpt_date", columnList = "report_date")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LaserReport extends BaseEntity {

    @Column(name = "file_name", nullable = false, length = 200) private String fileName;
    @Column(name = "total_part_num", nullable = false) private long totalPartNum;
    @Column(name = "current_part_number", nullable = false) private long currentPartNumber;
    @Column(name = "previous_part_number", nullable = false) private long previousPartNumber;
    @Column(name = "difference", nullable = false) private long difference;
    @Column(name = "report_date", nullable = false) private LocalDate reportDate;
}
