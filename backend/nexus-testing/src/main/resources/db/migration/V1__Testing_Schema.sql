-- Testing Module schema
CREATE TABLE testing_jobs (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    job_number      VARCHAR(40) NOT NULL,
    branch_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    lot_id          UUID,
    method          VARCHAR(20) NOT NULL,
    received_date   DATE NOT NULL,
    due_date        DATE,
    completed_date  DATE,
    sample_count    INT  NOT NULL DEFAULT 1,
    gross_weight    NUMERIC(14,4),
    status          VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
    rate            NUMERIC(14,2),
    remarks         VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_tjob_no UNIQUE (tenant_id, job_number)
);
CREATE INDEX ix_tjob_status   ON testing_jobs(tenant_id, status);
CREATE INDEX ix_tjob_customer ON testing_jobs(tenant_id, customer_id);

CREATE TABLE testing_results (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    job_id          UUID NOT NULL,
    sample_no       INT  NOT NULL,
    sample_weight   NUMERIC(14,4),
    au_pct          NUMERIC(7,4),
    ag_pct          NUMERIC(7,4),
    cu_pct          NUMERIC(7,4),
    zn_pct          NUMERIC(7,4),
    ni_pct          NUMERIC(7,4),
    pd_pct          NUMERIC(7,4),
    pt_pct          NUMERIC(7,4),
    other_pct       NUMERIC(7,4),
    fineness        NUMERIC(7,3),
    tested_at       TIMESTAMP NOT NULL,
    tested_by_name  VARCHAR(120),
    remarks         VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_result_job ON testing_results(job_id, sample_no);

CREATE TABLE testing_certificates (
    id                 UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL,
    certificate_no     VARCHAR(40) NOT NULL,
    job_id             UUID NOT NULL,
    issued_on          DATE NOT NULL,
    issued_by_name     VARCHAR(120),
    average_fineness   NUMERIC(7,3),
    remarks            VARCHAR(500),
    created_at         TIMESTAMPTZ NOT NULL,
    updated_at         TIMESTAMPTZ NOT NULL,
    created_by         UUID NOT NULL,
    updated_by         UUID NOT NULL,
    version            BIGINT,
    is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMPTZ,
    custom_fields      JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_cert_no UNIQUE (tenant_id, certificate_no),
    CONSTRAINT uk_cert_job UNIQUE (tenant_id, job_id)
);
