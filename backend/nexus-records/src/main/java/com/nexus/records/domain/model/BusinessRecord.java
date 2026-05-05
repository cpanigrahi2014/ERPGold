package com.nexus.records.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "business_records", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "branch_ref", "month_no", "year_no"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BusinessRecord extends BaseEntity {

    @Column(name = "branch_ref", nullable = false, length = 40) private String branchRef;
    @Column(name = "branch_code", nullable = false, length = 20) private String branchCode;
    @Column(name = "branch_name", nullable = false, length = 120) private String branchName;

    @Column(name = "month_no", nullable = false) private int month;
    @Column(name = "year_no", nullable = false) private int year;

    @Column(name = "record_name", nullable = false, length = 120) private String name;

    // JSON strings to keep schema and API simple for sheet rows.
    @Column(name = "cash_rows", columnDefinition = "TEXT") @Builder.Default private String cashRows = "[]";
    @Column(name = "expense_rows", columnDefinition = "TEXT") @Builder.Default private String expenseRows = "[]";
    @Column(name = "huid_rows", columnDefinition = "TEXT") @Builder.Default private String huidRows = "[]";
    @Column(name = "refinery_rows", columnDefinition = "TEXT") @Builder.Default private String refineryRows = "[]";
    @Column(name = "bank_rows", columnDefinition = "TEXT") @Builder.Default private String bankRows = "[]";
    @Column(name = "market_due_rows", columnDefinition = "TEXT") @Builder.Default private String marketDueRows = "[]";
    @Column(name = "corporate_expense_rows", columnDefinition = "TEXT") @Builder.Default private String corporateExpenseRows = "[]";

    @Column(name = "export_file_name", length = 200) private String exportFileName;
    @Column(name = "export_content_type", length = 120) private String exportContentType;
    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "export_attachment", columnDefinition = "bytea") private byte[] exportAttachment;
    @Column(name = "export_generated_at") private Instant exportGeneratedAt;
}
