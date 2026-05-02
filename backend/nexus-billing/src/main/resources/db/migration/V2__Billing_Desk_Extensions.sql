-- Billing desk extension schema: deposits, exchange, payment register, discounts, scrap log
CREATE TABLE billing_deposits (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    customer_id            VARCHAR(80) NOT NULL,
    branch_code            VARCHAR(20) NOT NULL,
    amount                 NUMERIC(16,2) NOT NULL,
    remaining              NUMERIC(16,2) NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL,
    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    version                BIGINT,
    is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at             TIMESTAMPTZ,
    custom_fields          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_bd_tenant_created ON billing_deposits(tenant_id, created_at DESC);

CREATE TABLE billing_exchange_records (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    customer_id            VARCHAR(80) NOT NULL,
    branch_code            VARCHAR(20) NOT NULL,
    gold_grams             NUMERIC(14,3) NOT NULL,
    purity                 NUMERIC(7,3) NOT NULL,
    cash_component         NUMERIC(16,2) NOT NULL,
    grand_total            NUMERIC(16,2) NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL,
    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    version                BIGINT,
    is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at             TIMESTAMPTZ,
    custom_fields          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_ber_tenant_created ON billing_exchange_records(tenant_id, created_at DESC);

CREATE TABLE billing_payments_register (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    customer_id            VARCHAR(80) NOT NULL,
    branch_code            VARCHAR(20) NOT NULL,
    amount                 NUMERIC(16,2) NOT NULL,
    tender                 VARCHAR(30) NOT NULL,
    gold_grams             NUMERIC(14,3),
    purity                 NUMERIC(7,3),
    created_at             TIMESTAMPTZ NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL,
    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    version                BIGINT,
    is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at             TIMESTAMPTZ,
    custom_fields          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_bpr_tenant_created ON billing_payments_register(tenant_id, created_at DESC);

CREATE TABLE billing_scrap_log (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    linked_payment_id      UUID NOT NULL,
    customer_id            VARCHAR(80) NOT NULL,
    branch_code            VARCHAR(20) NOT NULL,
    gold_grams             NUMERIC(14,3) NOT NULL,
    purity                 NUMERIC(7,3) NOT NULL,
    pure_gold              NUMERIC(14,3) NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL,
    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    version                BIGINT,
    is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at             TIMESTAMPTZ,
    custom_fields          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_bsl_tenant_created ON billing_scrap_log(tenant_id, created_at DESC);

CREATE TABLE billing_discounts (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    customer_id            VARCHAR(80) NOT NULL,
    branch_code            VARCHAR(20) NOT NULL,
    discount_amount        NUMERIC(16,2) NOT NULL,
    status                 VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    customer_ledger_posted BOOLEAN NOT NULL DEFAULT FALSE,
    branch_ledger_posted   BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL,
    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    version                BIGINT,
    is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at             TIMESTAMPTZ,
    custom_fields          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_bdsc_tenant_created ON billing_discounts(tenant_id, created_at DESC);
