-- Delivery orders and returns for Hallmarking module
CREATE TABLE hm_delivery_orders (
    id                    UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL,
    order_number          VARCHAR(40) NOT NULL,
    customer_id           UUID,
    customer_name         VARCHAR(200) NOT NULL,
    delivery_type         VARCHAR(20) NOT NULL,
    status                VARCHAR(30) NOT NULL DEFAULT 'AWAITING_PICKUP',
    customer_gross_weight NUMERIC(14,4),
    customer_net_weight   NUMERIC(14,4),
    phc_quantity          INT,
    phc_gross_weight      NUMERIC(14,4),
    declared_purity       VARCHAR(40),
    remarks               VARCHAR(500),
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    created_by            UUID NOT NULL,
    updated_by            UUID NOT NULL,
    version               BIGINT,
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at            TIMESTAMPTZ,
    custom_fields         JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_hm_delivery_order_no UNIQUE (tenant_id, order_number)
);
CREATE INDEX ix_hm_do_status ON hm_delivery_orders(tenant_id, status);

CREATE TABLE hm_delivery_returns (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL,
    return_number    VARCHAR(40) NOT NULL,
    order_id         UUID,
    order_number     VARCHAR(40),
    customer_id      UUID,
    customer_name    VARCHAR(200) NOT NULL,
    delivery_details VARCHAR(500),
    remarks          VARCHAR(500),
    status           VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    delivery_date    DATE,
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL,
    created_by       UUID NOT NULL,
    updated_by       UUID NOT NULL,
    version          BIGINT,
    is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at       TIMESTAMPTZ,
    custom_fields    JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_hm_return_no UNIQUE (tenant_id, return_number)
);
CREATE INDEX ix_hm_ret_status ON hm_delivery_returns(tenant_id, status);
