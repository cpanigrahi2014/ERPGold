-- Business Records module schema
CREATE TABLE day_book (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    entry_date    DATE NOT NULL,
    branch_id     UUID NOT NULL,
    module        VARCHAR(30) NOT NULL,
    txn_type      VARCHAR(30) NOT NULL,
    reference_no  VARCHAR(60),
    reference_id  UUID,
    party_id      UUID,
    party_name    VARCHAR(200),
    narration     VARCHAR(500),
    metal_in_g    NUMERIC(14,4),
    metal_out_g   NUMERIC(14,4),
    amount_in     NUMERIC(16,2),
    amount_out    NUMERIC(16,2),
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_db_date   ON day_book(tenant_id, entry_date);
CREATE INDEX ix_db_branch ON day_book(tenant_id, branch_id);
CREATE INDEX ix_db_module ON day_book(module);

CREATE TABLE audit_log (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL,
    module        VARCHAR(30) NOT NULL,
    action        VARCHAR(60) NOT NULL,
    entity_type   VARCHAR(60),
    entity_id     UUID,
    actor_id      UUID,
    actor_name    VARCHAR(200),
    ip_address    VARCHAR(60),
    summary       VARCHAR(500),
    before_json   TEXT,
    after_json    TEXT,
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_al_at     ON audit_log(tenant_id, occurred_at);
CREATE INDEX ix_al_actor  ON audit_log(tenant_id, actor_id);
CREATE INDEX ix_al_entity ON audit_log(tenant_id, entity_type, entity_id);

CREATE TABLE register_entries (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    register_type VARCHAR(30) NOT NULL,
    entry_date    DATE NOT NULL,
    serial_no     BIGINT NOT NULL,
    branch_id     UUID,
    metal         VARCHAR(20),
    purity_label  VARCHAR(20),
    particulars   VARCHAR(500),
    voucher_no    VARCHAR(60),
    party_name    VARCHAR(200),
    qty_in        NUMERIC(14,4),
    qty_out       NUMERIC(14,4),
    balance       NUMERIC(14,4),
    value_in      NUMERIC(16,2),
    value_out     NUMERIC(16,2),
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_re_register ON register_entries(tenant_id, register_type, entry_date);
CREATE INDEX ix_re_branch   ON register_entries(tenant_id, branch_id);
