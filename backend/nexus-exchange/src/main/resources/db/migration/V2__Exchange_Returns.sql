-- Exchange returns raised against completed transactions
CREATE TABLE exchange_returns (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    txn_id        UUID NOT NULL,
    reason        VARCHAR(500) NOT NULL,
    status        VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_exr_tenant_status ON exchange_returns(tenant_id, status);
CREATE INDEX ix_exr_tenant_txn ON exchange_returns(tenant_id, txn_id);
