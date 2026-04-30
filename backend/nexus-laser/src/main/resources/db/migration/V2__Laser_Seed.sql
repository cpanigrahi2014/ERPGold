-- Seed: 2 laser machines on default HQ branch
INSERT INTO laser_machines (id, tenant_id, code, name, branch_id, model, max_power_w, active,
                            created_at, updated_at, created_by, updated_by, version, is_deleted)
VALUES
('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','LZ-01','Fiber Laser Bay 1','00000000-0000-0000-0000-0000000000b1','Raycus Fiber 30W',30,TRUE,
 NOW(), NOW(),'00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a0',0,FALSE),
('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000001','LZ-02','Fiber Laser Bay 2','00000000-0000-0000-0000-0000000000b1','Raycus Fiber 50W',50,TRUE,
 NOW(), NOW(),'00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a0',0,FALSE);
