-- Hallmarking standalone module schema
CREATE TABLE hm_jobs (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    job_number        VARCHAR(40) NOT NULL,
    branch_id         UUID NOT NULL,
    jeweller_id       UUID NOT NULL,
    lot_id            UUID,
    kind              VARCHAR(20) NOT NULL,
    received_date     DATE NOT NULL,
    marked_date       DATE,
    dispatched_date   DATE,
    purity_label      VARCHAR(20),
    declared_fineness NUMERIC(7,3),
    assayed_fineness  NUMERIC(7,3),
    piece_count       INT NOT NULL DEFAULT 1,
    gross_weight      NUMERIC(14,4),
    huid_required     BOOLEAN NOT NULL DEFAULT TRUE,
    status            VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
    rate_per_piece    NUMERIC(14,2),
    remarks           VARCHAR(500),
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL,
    created_by        UUID NOT NULL,
    updated_by        UUID NOT NULL,
    version           BIGINT,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    custom_fields     JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_hm_job_no UNIQUE (tenant_id, job_number)
);
CREATE INDEX ix_hm_job_status   ON hm_jobs(tenant_id, status);
CREATE INDEX ix_hm_job_jeweller ON hm_jobs(tenant_id, jeweller_id);

CREATE TABLE hm_marks (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    job_id          UUID NOT NULL,
    piece_no        INT  NOT NULL,
    huid_code       VARCHAR(20),
    marked_purity   VARCHAR(20),
    piece_weight    NUMERIC(14,4),
    marked_at       TIMESTAMP NOT NULL,
    marked_by_name  VARCHAR(120),
    result          VARCHAR(20) NOT NULL DEFAULT 'PASSED',
    remarks         VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_hm_huid UNIQUE (tenant_id, huid_code)
);
CREATE INDEX ix_hm_marks_job ON hm_marks(job_id, piece_no);

CREATE TABLE hm_dispatches (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    dispatch_no       VARCHAR(40) NOT NULL,
    job_id            UUID NOT NULL,
    dispatched_on     DATE NOT NULL,
    received_by_name  VARCHAR(120),
    piece_count       INT NOT NULL,
    gross_weight      NUMERIC(14,4),
    remarks           VARCHAR(500),
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL,
    created_by        UUID NOT NULL,
    updated_by        UUID NOT NULL,
    version           BIGINT,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    custom_fields     JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_hm_dispatch_no UNIQUE (tenant_id, dispatch_no),
    CONSTRAINT uk_hm_dispatch_job UNIQUE (tenant_id, job_id)
);
