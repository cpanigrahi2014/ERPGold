-- V1__Admin_Schema.sql
-- Foundational masters for NEXUS ERP: branches, customers, products, purity, rates, users.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- BRANCH
-- ============================================================
CREATE TABLE branches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID            NOT NULL,
    code                VARCHAR(20)     NOT NULL,
    name                VARCHAR(255)    NOT NULL,
    invoice_code        VARCHAR(10),
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(100),
    postal_code         VARCHAR(20),
    country             VARCHAR(3)      NOT NULL DEFAULT 'IN',
    gstin               VARCHAR(20),
    phone               VARCHAR(30),
    email               VARCHAR(255),
    hand_loss_pct       NUMERIC(6,3)    NOT NULL DEFAULT 0.500,
    gold_loss_pct       NUMERIC(6,3)    NOT NULL DEFAULT 0.200,
    acid_loss_pct       NUMERIC(6,3)    NOT NULL DEFAULT 5.000,
    market_value_pct    NUMERIC(6,3)    NOT NULL DEFAULT 99.500,
    fineness_tolerance  NUMERIC(4,2)    NOT NULL DEFAULT 0.50,
    active              BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields       JSONB           DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          UUID            NOT NULL,
    updated_by          UUID            NOT NULL,
    version             BIGINT          NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_branch_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX ix_branches_tenant ON branches(tenant_id) WHERE is_deleted = FALSE;

-- ============================================================
-- CUSTOMER
-- ============================================================
CREATE TABLE customers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID            NOT NULL,
    customer_number     VARCHAR(30)     NOT NULL,
    name                VARCHAR(255)    NOT NULL,
    company             VARCHAR(255),
    gstin               VARCHAR(20),
    bis_number          VARCHAR(50),
    pan                 VARCHAR(15),
    phone               VARCHAR(30),
    email               VARCHAR(255),
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(100),
    postal_code         VARCHAR(20),
    type                VARCHAR(30)     NOT NULL DEFAULT 'JEWELLER',
    active              BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields       JSONB           DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          UUID            NOT NULL,
    updated_by          UUID            NOT NULL,
    version             BIGINT          NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_customer_tenant_number UNIQUE (tenant_id, customer_number)
);
CREATE INDEX ix_customers_tenant ON customers(tenant_id) WHERE is_deleted = FALSE;

-- ============================================================
-- ITEM CATEGORY + PRODUCT
-- ============================================================
CREATE TABLE item_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID            NOT NULL,
    code            VARCHAR(30)     NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields   JSONB           DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      UUID            NOT NULL,
    updated_by      UUID            NOT NULL,
    version         BIGINT          NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_itemcat_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID            NOT NULL,
    code            VARCHAR(30)     NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    category_id     UUID            REFERENCES item_categories(id),
    default_metal   VARCHAR(20)     NOT NULL DEFAULT 'GOLD',
    hsn_code        VARCHAR(20),
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields   JSONB           DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      UUID            NOT NULL,
    updated_by      UUID            NOT NULL,
    version         BIGINT          NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_product_tenant_code UNIQUE (tenant_id, code)
);

-- ============================================================
-- PURITY CATALOG
-- ============================================================
CREATE TABLE purity_catalog (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID            NOT NULL,
    label               VARCHAR(20)     NOT NULL,
    fineness_threshold  NUMERIC(8,3)    NOT NULL,
    metal               VARCHAR(20)     NOT NULL DEFAULT 'GOLD',
    active              BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields       JSONB           DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          UUID            NOT NULL,
    updated_by          UUID            NOT NULL,
    version             BIGINT          NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_purity_tenant_label UNIQUE (tenant_id, label)
);

-- ============================================================
-- SERVICE TYPES
-- ============================================================
CREATE TABLE service_types (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID            NOT NULL,
    code            VARCHAR(30)     NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    category        VARCHAR(30)     NOT NULL,
    hsn_code        VARCHAR(20),
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields   JSONB           DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      UUID            NOT NULL,
    updated_by      UUID            NOT NULL,
    version         BIGINT          NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_servicetype_tenant_code UNIQUE (tenant_id, code)
);

-- ============================================================
-- RATE SETUP
-- ============================================================
CREATE TABLE rate_setups (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID            NOT NULL,
    branch_id           UUID            NOT NULL REFERENCES branches(id),
    customer_id         UUID            REFERENCES customers(id),
    service_type_id     UUID            NOT NULL REFERENCES service_types(id),
    rate                NUMERIC(12,2)   NOT NULL,
    rate_basis          VARCHAR(20)     NOT NULL DEFAULT 'PER_PIECE',
    effective_from      DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,
    active              BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields       JSONB           DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          UUID            NOT NULL,
    updated_by          UUID            NOT NULL,
    version             BIGINT          NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX ix_rate_lookup ON rate_setups(tenant_id, branch_id, customer_id, service_type_id, effective_from)
    WHERE is_deleted = FALSE AND active = TRUE;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE app_users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID            NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    full_name       VARCHAR(255)    NOT NULL,
    branch_id       UUID            REFERENCES branches(id),
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    custom_fields   JSONB           DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      UUID            NOT NULL,
    updated_by      UUID            NOT NULL,
    version         BIGINT          NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email)
);
CREATE UNIQUE INDEX uq_user_email_global ON app_users(email) WHERE is_deleted = FALSE;

CREATE TABLE app_user_roles (
    user_id     UUID    NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, role)
);
