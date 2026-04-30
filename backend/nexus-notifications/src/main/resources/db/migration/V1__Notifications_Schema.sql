-- Notifications module schema
CREATE TABLE notification_templates (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    code          VARCHAR(60) NOT NULL,
    name          VARCHAR(200) NOT NULL,
    channel       VARCHAR(20) NOT NULL,
    subject_tpl   VARCHAR(300),
    body_tpl      TEXT NOT NULL,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    description   VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID NOT NULL,
    updated_by    UUID NOT NULL,
    version       BIGINT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uk_tpl_code UNIQUE (tenant_id, code)
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    template_id     UUID,
    template_code   VARCHAR(60),
    channel         VARCHAR(20) NOT NULL,
    recipient       VARCHAR(300) NOT NULL,
    recipient_name  VARCHAR(200),
    subject         VARCHAR(300),
    body            TEXT NOT NULL,
    context_json    TEXT,
    source_module   VARCHAR(30),
    source_ref      VARCHAR(60),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts        INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    last_error      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL,
    updated_by      UUID NOT NULL,
    version         BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_n_status  ON notifications(tenant_id, status);
CREATE INDEX ix_n_created ON notifications(tenant_id, created_at);

CREATE TABLE delivery_attempts (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL,
    notification_id  UUID NOT NULL,
    attempt_no       INT NOT NULL,
    attempted_at     TIMESTAMPTZ NOT NULL,
    result           VARCHAR(20) NOT NULL,
    provider         VARCHAR(60),
    provider_ref     VARCHAR(200),
    response_message VARCHAR(500),
    duration_ms      BIGINT,
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL,
    created_by       UUID NOT NULL,
    updated_by       UUID NOT NULL,
    version          BIGINT,
    is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at       TIMESTAMPTZ,
    custom_fields    JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ix_da_notif ON delivery_attempts(notification_id);
