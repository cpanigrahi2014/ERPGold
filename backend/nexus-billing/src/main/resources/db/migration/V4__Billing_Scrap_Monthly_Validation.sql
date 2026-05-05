CREATE TABLE IF NOT EXISTS billing_scrap_monthly_validation (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    report_year            INT NOT NULL,
    report_month           INT NOT NULL,
    expected_pure_gold     NUMERIC(14,3) NOT NULL,
    actual_pure_gold       NUMERIC(14,3) NOT NULL,
    variance               NUMERIC(14,3) NOT NULL,
    wt_avg_purity_expected NUMERIC(7,3) NOT NULL,
    wt_avg_purity_actual   NUMERIC(7,3) NOT NULL,
    discrepancy_flag       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL,
    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    version                BIGINT,
    is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at             TIMESTAMPTZ,
    custom_fields          JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_bsmv_tenant_month UNIQUE (tenant_id, report_year, report_month)
);

CREATE INDEX IF NOT EXISTS ix_bsmv_tenant_created
    ON billing_scrap_monthly_validation(tenant_id, created_at DESC);
