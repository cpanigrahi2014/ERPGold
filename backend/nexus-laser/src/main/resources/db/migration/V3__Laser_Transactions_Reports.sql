-- Laser marking transactions and reports tables
CREATE TABLE laser_transactions (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    job_id        UUID NOT NULL,
    order_id      VARCHAR(60) NOT NULL,
    txn_type      VARCHAR(30) NOT NULL,
    non_huid_qty  INT NOT NULL DEFAULT 0,
    seal_qty      INT NOT NULL DEFAULT 0,
    total_markings INT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_ltxn_date ON laser_transactions(created_at DESC);
CREATE INDEX ix_ltxn_type ON laser_transactions(txn_type);
CREATE INDEX ix_ltxn_tenant ON laser_transactions(tenant_id);

CREATE TABLE laser_reports (
    id                    UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL,
    file_name             VARCHAR(200) NOT NULL,
    total_part_num        BIGINT NOT NULL,
    current_part_number   BIGINT NOT NULL,
    previous_part_number  BIGINT NOT NULL,
    difference            BIGINT NOT NULL,
    report_date           DATE NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    created_by            UUID NOT NULL,
    updated_by            UUID NOT NULL,
    version               BIGINT,
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at            TIMESTAMPTZ,
    custom_fields         JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_lrpt_date ON laser_reports(report_date DESC);
CREATE INDEX ix_lrpt_tenant ON laser_reports(tenant_id);
