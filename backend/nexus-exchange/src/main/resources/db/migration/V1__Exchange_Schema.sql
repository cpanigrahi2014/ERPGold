-- Exchange module schema
CREATE TABLE exchange_txns (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    txn_number      VARCHAR(40) NOT NULL,
    branch_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    exchange_date   DATE NOT NULL,
    posted_date     DATE,
    metal           VARCHAR(20) NOT NULL DEFAULT 'GOLD',
    valuation_rate  NUMERIC(14,2),
    old_gross       NUMERIC(14,4),
    old_pure        NUMERIC(14,4),
    old_value       NUMERIC(16,2),
    new_gross       NUMERIC(14,4),
    new_pure        NUMERIC(14,4),
    new_value       NUMERIC(16,2),
    making_charges  NUMERIC(16,2),
    balance_payable NUMERIC(16,2),
    settlement_type VARCHAR(20) DEFAULT 'CASH',
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    remarks         VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_ex_txn_no UNIQUE (tenant_id, txn_number)
);
CREATE INDEX ix_ex_status ON exchange_txns(tenant_id, status);
CREATE INDEX ix_ex_customer ON exchange_txns(tenant_id, customer_id);

CREATE TABLE exchange_items (
    id             UUID PRIMARY KEY,
    tenant_id      UUID NOT NULL,
    txn_id         UUID NOT NULL,
    side           VARCHAR(10) NOT NULL,
    item_desc      VARCHAR(200),
    hsn_code       VARCHAR(20),
    gross_weight   NUMERIC(14,4) NOT NULL,
    fineness       NUMERIC(7,3),
    pure_weight    NUMERIC(14,4),
    rate_per_gram  NUMERIC(14,2),
    making_charges NUMERIC(16,2),
    line_value     NUMERIC(16,2),
    lot_id         UUID,
    remarks        VARCHAR(500),
    created_at     TIMESTAMPTZ NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL,
    created_by     UUID NOT NULL,
    updated_by     UUID NOT NULL,
    version        BIGINT,
    is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMPTZ,
    custom_fields  JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_xi_txn ON exchange_items(txn_id);
CREATE INDEX ix_xi_side ON exchange_items(txn_id, side);
