-- V3__Admin_User_Approval.sql
-- Adds self-registration + admin-approval workflow for users.
--
-- New columns on app_users:
--   status            : PENDING | APPROVED | REJECTED | DISABLED
--   requested_role    : role the user asked for at registration (advisory; admin still chooses)
--   approved_by       : user id of approver
--   approved_at       : timestamp of approval/rejection
--   reject_reason     : optional reason on REJECTED / DISABLED

ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS status         VARCHAR(20)   NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN IF NOT EXISTS requested_role VARCHAR(50),
    ADD COLUMN IF NOT EXISTS approved_by    UUID,
    ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reject_reason  VARCHAR(500);

CREATE INDEX IF NOT EXISTS ix_app_users_status ON app_users(status) WHERE is_deleted = FALSE;

-- Backfill: existing seeded users (admin) are APPROVED. Default above already covers them.
UPDATE app_users SET status = 'APPROVED' WHERE status IS NULL;
