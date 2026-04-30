-- Laser marking module schema
CREATE TABLE laser_machines (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    code          VARCHAR(30) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    branch_id     UUID NOT NULL,
    model         VARCHAR(60),
    max_power_w   INT,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_lzm_code UNIQUE (tenant_id, code)
);

CREATE TABLE laser_jobs (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    job_number      VARCHAR(40) NOT NULL,
    branch_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    lot_id          UUID,
    machine_id      UUID,
    received_date   DATE NOT NULL,
    due_date        DATE,
    completed_date  DATE,
    piece_count     INT NOT NULL DEFAULT 1,
    marking_text    VARCHAR(200),
    font            VARCHAR(40),
    depth_mm        NUMERIC(6,3),
    power_pct       INT,
    speed_mmps      INT,
    status          VARCHAR(30) NOT NULL DEFAULT 'ORDER',
    rate_per_piece  NUMERIC(14,2),
    remarks         VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_lz_job_no UNIQUE (tenant_id, job_number)
);
CREATE INDEX ix_lz_status   ON laser_jobs(tenant_id, status);
CREATE INDEX ix_lz_customer ON laser_jobs(tenant_id, customer_id);

CREATE TABLE laser_marks (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    job_id        UUID NOT NULL,
    piece_no      INT NOT NULL,
    engraved_text VARCHAR(200),
    piece_weight  NUMERIC(14,4),
    operator_name VARCHAR(120),
    marked_at     TIMESTAMP NOT NULL,
    result        VARCHAR(20) NOT NULL DEFAULT 'OK',
    remarks       VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_lmark_job ON laser_marks(job_id, piece_no);
