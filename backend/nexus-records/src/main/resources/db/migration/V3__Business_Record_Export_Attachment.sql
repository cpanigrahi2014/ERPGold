ALTER TABLE business_records
    ADD COLUMN IF NOT EXISTS export_file_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS export_content_type VARCHAR(120),
    ADD COLUMN IF NOT EXISTS export_attachment BYTEA,
    ADD COLUMN IF NOT EXISTS export_generated_at TIMESTAMPTZ;
