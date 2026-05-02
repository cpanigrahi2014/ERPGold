CREATE TABLE business_records (
    id                      UUID PRIMARY KEY,
    tenant_id               UUID NOT NULL,
    branch_ref              VARCHAR(40) NOT NULL,
    branch_code             VARCHAR(20) NOT NULL,
    branch_name             VARCHAR(120) NOT NULL,
    month_no                INT NOT NULL,
    year_no                 INT NOT NULL,
    record_name             VARCHAR(120) NOT NULL,
    cash_rows               TEXT,
    expense_rows            TEXT,
    huid_rows               TEXT,
    refinery_rows           TEXT,
    bank_rows               TEXT,
    market_due_rows         TEXT,
    corporate_expense_rows  TEXT,
    created_at              TIMESTAMPTZ NOT NULL,
    updated_at              TIMESTAMPTZ NOT NULL,
    created_by              UUID NOT NULL,
    updated_by              UUID NOT NULL,
    version                 BIGINT,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ,
    custom_fields           JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_br_unique UNIQUE (tenant_id, branch_ref, month_no, year_no)
);

CREATE INDEX ix_br_month ON business_records(tenant_id, year_no, month_no);
