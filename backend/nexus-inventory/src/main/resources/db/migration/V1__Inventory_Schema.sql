-- nexus-inventory V1 schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE stock_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    branch_id       UUID NOT NULL,
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    kind            VARCHAR(30) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_loc_code UNIQUE (tenant_id, branch_id, code)
);

CREATE TABLE lots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    lot_number          VARCHAR(40) NOT NULL,
    branch_id           UUID NOT NULL,
    customer_id         UUID,
    current_location_id UUID REFERENCES stock_locations(id),
    metal               VARCHAR(20) NOT NULL,
    purity_label        VARCHAR(20),
    declared_fineness   NUMERIC(7,3),
    assayed_fineness    NUMERIC(7,3),
    gross_weight        NUMERIC(14,4) NOT NULL,
    net_weight          NUMERIC(14,4),
    fine_weight         NUMERIC(14,4),
    received_date       DATE,
    status              VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
    parent_lot_id       UUID REFERENCES lots(id),
    remarks             VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID NOT NULL,
    updated_by          UUID NOT NULL,
    version             BIGINT NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    custom_fields       JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_lot_number UNIQUE (tenant_id, lot_number)
);
CREATE INDEX ix_lot_status ON lots(tenant_id, status);
CREATE INDEX ix_lot_customer ON lots(tenant_id, customer_id);

CREATE TABLE stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    lot_id          UUID NOT NULL REFERENCES lots(id),
    type            VARCHAR(20) NOT NULL,
    from_location_id UUID REFERENCES stock_locations(id),
    to_location_id  UUID REFERENCES stock_locations(id),
    quantity        NUMERIC(14,4) NOT NULL,
    occurred_at     TIMESTAMP NOT NULL DEFAULT now(),
    reference_type  VARCHAR(40),
    reference_id    UUID,
    remarks         VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_mov_lot ON stock_movements(lot_id, occurred_at);
CREATE INDEX ix_mov_loc ON stock_movements(to_location_id, occurred_at);

CREATE TABLE lot_reservations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    lot_id              UUID NOT NULL REFERENCES lots(id),
    reserved_for_type   VARCHAR(30) NOT NULL,
    reserved_for_id     UUID NOT NULL,
    quantity            NUMERIC(14,4) NOT NULL,
    reserved_at         TIMESTAMP NOT NULL DEFAULT now(),
    released_at         TIMESTAMP,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID NOT NULL,
    updated_by          UUID NOT NULL,
    version             BIGINT NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    custom_fields       JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_resv_lot ON lot_reservations(lot_id, status);
