-- Refinery Orders table: tracks the intake → receipt → approval → batching workflow
CREATE TABLE refinery_orders (
    id                    UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL,
    order_number          VARCHAR(60) NOT NULL,
    branch_id             UUID NOT NULL,
    branch_code           VARCHAR(10),
    customer_id           UUID,
    customer_no           VARCHAR(30),
    customer_name         VARCHAR(120),
    work_type             VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    sent_gold_weight      NUMERIC(14,4) NOT NULL,
    declared_purity       VARCHAR(30)   NOT NULL,
    received_gold_weight  NUMERIC(14,4),
    observed_purity_pct   NUMERIC(7,3),
    melting_total_weight  NUMERIC(14,4),
    melting_sample_weight NUMERIC(14,4),
    batch_id              UUID,
    status                VARCHAR(30) NOT NULL DEFAULT 'RECEIPT',
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    created_by            UUID NOT NULL,
    updated_by            UUID NOT NULL,
    version               BIGINT,
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at            TIMESTAMPTZ,
    custom_fields         JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_rf_order_no UNIQUE (tenant_id, order_number)
);
CREATE INDEX ix_rfo_status ON refinery_orders(tenant_id, status);
CREATE INDEX ix_rfo_batch  ON refinery_orders(batch_id);
