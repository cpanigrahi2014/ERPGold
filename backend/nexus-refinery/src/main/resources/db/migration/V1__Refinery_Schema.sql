-- Refinery module schema
CREATE TABLE refinery_batches (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    batch_number      VARCHAR(40) NOT NULL,
    branch_id         UUID NOT NULL,
    customer_id       UUID,
    metal             VARCHAR(20) NOT NULL DEFAULT 'GOLD',
    method            VARCHAR(30) NOT NULL DEFAULT 'AQUA_REGIA',
    start_date        DATE NOT NULL,
    completed_date    DATE,
    input_gross       NUMERIC(14,4),
    input_pure        NUMERIC(14,4),
    output_gross      NUMERIC(14,4),
    output_pure       NUMERIC(14,4),
    loss_gross        NUMERIC(14,4),
    loss_pct          NUMERIC(7,4),
    expected_fineness NUMERIC(7,3),
    actual_fineness   NUMERIC(7,3),
    status            VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    remarks           VARCHAR(500),
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL,
    created_by        UUID NOT NULL,
    updated_by        UUID NOT NULL,
    version           BIGINT,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    custom_fields     JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_rf_batch_no UNIQUE (tenant_id, batch_number)
);
CREATE INDEX ix_rf_status ON refinery_batches(tenant_id, status);

CREATE TABLE refinery_batch_inputs (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    batch_id      UUID NOT NULL,
    lot_id        UUID,
    source_label  VARCHAR(120),
    gross_weight  NUMERIC(14,4) NOT NULL,
    fineness      NUMERIC(7,3),
    pure_weight   NUMERIC(14,4),
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
CREATE INDEX ix_rbi_batch ON refinery_batch_inputs(batch_id);

CREATE TABLE refinery_batch_outputs (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    batch_id      UUID NOT NULL,
    bar_no        VARCHAR(40),
    form          VARCHAR(30),
    gross_weight  NUMERIC(14,4) NOT NULL,
    fineness      NUMERIC(7,3),
    pure_weight   NUMERIC(14,4),
    to_lot_id     UUID,
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
CREATE INDEX ix_rbo_batch ON refinery_batch_outputs(batch_id);

CREATE TABLE refinery_process_steps (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    batch_id      UUID NOT NULL,
    step_no       INT NOT NULL,
    step_name     VARCHAR(80) NOT NULL,
    operator_name VARCHAR(120),
    started_at    TIMESTAMP,
    completed_at  TIMESTAMP,
    notes         VARCHAR(1000),
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_rps_batch ON refinery_process_steps(batch_id, step_no);
