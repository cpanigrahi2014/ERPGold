-- Add workflow state storage to hm_jobs for full request workflow persistence
ALTER TABLE hm_jobs ADD COLUMN IF NOT EXISTS workflow_data TEXT;
