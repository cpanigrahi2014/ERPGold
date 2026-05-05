CREATE SEQUENCE IF NOT EXISTS billing_discount_ref_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE billing_discounts
    ADD COLUMN IF NOT EXISTS reference_no VARCHAR(40),
    ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);

UPDATE billing_discounts
SET reference_no = 'DSC-' || to_char(created_at, 'YYYYMMDD') || '-' || lpad(nextval('billing_discount_ref_seq')::text, 6, '0')
WHERE reference_no IS NULL;

ALTER TABLE billing_discounts
    ALTER COLUMN reference_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_bdsc_tenant_ref
    ON billing_discounts(tenant_id, reference_no);
