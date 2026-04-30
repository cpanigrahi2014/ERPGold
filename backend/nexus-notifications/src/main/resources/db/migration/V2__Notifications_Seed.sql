-- Seed default notification templates
INSERT INTO notification_templates (id, tenant_id, code, name, channel, subject_tpl, body_tpl, active, description,
    created_at, updated_at, created_by, updated_by, version, is_deleted)
VALUES
('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001',
 'INVOICE_ISSUED', 'Invoice Issued (Email)', 'EMAIL',
 'Invoice {{invoiceNumber}} from NEXUS Jewellery',
 'Dear {{customerName}},

Your invoice {{invoiceNumber}} for Rs.{{grandTotal}} has been issued. Balance due Rs.{{balance}} by {{dueDate}}.

Thank you for your business.
NEXUS Jewellery',
 TRUE, 'Sent when an invoice is issued to a customer.',
 NOW(), NOW(), '00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a0', 0, FALSE),

('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000001',
 'PAYMENT_RECEIVED', 'Payment Received (SMS)', 'SMS',
 NULL,
 'NEXUS: Received Rs.{{amount}} for invoice {{invoiceNumber}}. Balance Rs.{{balance}}. Thank you.',
 TRUE, 'Sent on each payment receipt.',
 NOW(), NOW(), '00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a0', 0, FALSE),

('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000001',
 'HM_READY', 'Hallmarking Ready (SMS)', 'SMS',
 NULL,
 'NEXUS: Hallmarking job {{jobNumber}} is ready for pickup at {{branch}}.',
 TRUE, 'Sent when hallmarking job is completed.',
 NOW(), NOW(), '00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a0', 0, FALSE),

('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000001',
 'REFINERY_COMPLETE', 'Refinery Batch Complete (Email)', 'EMAIL',
 'Refinery batch {{batchNumber}} complete',
 'Dear {{customerName}},

Refinery batch {{batchNumber}} complete: input {{inputG}}g, recovered {{outputG}}g, fineness {{fineness}} permil.

NEXUS Jewellery',
 TRUE, 'Sent when refining batch completes.',
 NOW(), NOW(), '00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a0', 0, FALSE);
