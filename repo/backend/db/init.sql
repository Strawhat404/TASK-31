CREATE DATABASE IF NOT EXISTS roadsafe;
USE roadsafe;

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(200) NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt CHAR(32) NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  team_id VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token CHAR(96) NOT NULL UNIQUE,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_token (token),
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facilities_resources (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  resource_type ENUM('inspection_bay', 'equipment') NOT NULL,
  resource_name VARCHAR(150) NOT NULL,
  facility_code VARCHAR(32) NOT NULL,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  status ENUM('available', 'maintenance', 'retired') NOT NULL DEFAULT 'available',
  metadata JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resources_scope (location_code, department_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  coordinator_id BIGINT UNSIGNED NULL,
  inspector_id BIGINT UNSIGNED NULL,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  status ENUM('scheduled', 'checked_in', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_appointments_coordinator FOREIGN KEY (coordinator_id) REFERENCES users(id),
  CONSTRAINT fk_appointments_inspector FOREIGN KEY (inspector_id) REFERENCES users(id),
  INDEX idx_appointments_scope (location_code, department_code),
  INDEX idx_appointments_schedule (scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_records (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NULL,
  vin VARCHAR(64) NULL,
  plate_number VARCHAR(32) NOT NULL,
  brand VARCHAR(64) NOT NULL,
  model_name VARCHAR(64) NOT NULL,
  model_year INT NOT NULL,
  price_usd DECIMAL(12,2) NULL,
  energy_type ENUM('petrol', 'diesel', 'hybrid', 'electric', 'cng', 'other') NOT NULL DEFAULT 'other',
  transmission ENUM('manual', 'automatic', 'cvt', 'other') NOT NULL DEFAULT 'other',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicle_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  INDEX idx_vehicle_filters (brand, model_year, energy_type, transmission),
  INDEX idx_vehicle_price (price_usd)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS search_query_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  raw_query VARCHAR(255) NOT NULL,
  filters JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_search_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_search_time (created_at),
  INDEX idx_search_query (raw_query)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  message_type ENUM('appointment_confirmation', 'report_announcement', 'system_notice') NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body_encrypted TEXT NOT NULL,
  status ENUM('draft', 'queued', 'sent', 'read') NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id),
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  INDEX idx_messages_recipient (recipient_user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS manual_delivery_outbox (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('sms', 'email') NOT NULL,
  recipient_encrypted TEXT NOT NULL,
  payload_encrypted TEXT NOT NULL,
  export_status ENUM('pending', 'exported') NOT NULL DEFAULT 'pending',
  exported_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_outbox_message FOREIGN KEY (message_id) REFERENCES messages(id),
  INDEX idx_outbox_status (export_status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blocked_file_hashes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  checksum_sha256 CHAR(64) NOT NULL UNIQUE,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS files (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NULL,
  linked_table VARCHAR(120) NULL,
  linked_record_id BIGINT UNSIGNED NULL,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_files_scope (location_code, department_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS file_quarantine (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  file_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  matched_pattern VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quarantine_file FOREIGN KEY (file_id) REFERENCES files(id),
  INDEX idx_quarantine_file (file_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_closure_requests (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_by TIMESTAMP NOT NULL,
  processed_at TIMESTAMP NULL,
  status ENUM('pending', 'completed', 'expired') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_closure_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_closure_status (status, due_by)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS security_alerts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  alert_type VARCHAR(120) NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'high',
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_security_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS waiting_room_seats (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  seat_label VARCHAR(32) NOT NULL,
  x_pos INT NOT NULL DEFAULT 0,
  y_pos INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  occupied_by_appointment_id BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_waiting_seat (location_code, department_code, seat_label),
  CONSTRAINT fk_waiting_appointment FOREIGN KEY (occupied_by_appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bay_capacity_locks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  bay_resource_id BIGINT UNSIGNED NOT NULL,
  inspector_id BIGINT UNSIGNED NOT NULL,
  equipment_resource_id BIGINT UNSIGNED NOT NULL,
  slot_start TIMESTAMP NOT NULL,
  slot_end TIMESTAMP NOT NULL,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bay_slot (bay_resource_id, slot_start),
  UNIQUE KEY uq_inspector_slot (inspector_id, slot_start),
  UNIQUE KEY uq_equipment_slot (equipment_resource_id, slot_start),
  UNIQUE KEY uq_appointment_lock (appointment_id),
  CONSTRAINT fk_capacity_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_capacity_bay FOREIGN KEY (bay_resource_id) REFERENCES facilities_resources(id),
  CONSTRAINT fk_capacity_inspector FOREIGN KEY (inspector_id) REFERENCES users(id),
  CONSTRAINT fk_capacity_equipment FOREIGN KEY (equipment_resource_id) REFERENCES facilities_resources(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS equipment_usage_counters (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  equipment_resource_id BIGINT UNSIGNED NOT NULL UNIQUE,
  tests_since_recalibration INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usage_equipment FOREIGN KEY (equipment_resource_id) REFERENCES facilities_resources(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  equipment_resource_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(120) NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_equipment FOREIGN KEY (equipment_resource_id) REFERENCES facilities_resources(id),
  INDEX idx_maintenance_equipment_time (equipment_resource_id, starts_at, ends_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  submitted_by BIGINT UNSIGNED NOT NULL,
  source_system VARCHAR(120) NOT NULL,
  job_type VARCHAR(120) NOT NULL,
  status ENUM('queued', 'running', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  payload JSON NULL,
  error_message TEXT NULL,
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ingestion_submitter FOREIGN KEY (submitted_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ingestion_job_dependencies (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT UNSIGNED NOT NULL,
  depends_on_job_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_job_dependency (job_id, depends_on_job_id),
  CONSTRAINT fk_dep_job FOREIGN KEY (job_id) REFERENCES ingestion_jobs(id),
  CONSTRAINT fk_dep_depends FOREIGN KEY (depends_on_job_id) REFERENCES ingestion_jobs(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dataset_versions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ingestion_job_id BIGINT UNSIGNED NOT NULL,
  dataset_name VARCHAR(120) NOT NULL,
  version_no INT NOT NULL,
  records_written INT NOT NULL DEFAULT 0,
  missing_fields_rate DECIMAL(8,5) NOT NULL DEFAULT 0,
  duplicate_rate DECIMAL(8,5) NOT NULL DEFAULT 0,
  lineage JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dataset_job FOREIGN KEY (ingestion_job_id) REFERENCES ingestion_jobs(id),
  UNIQUE KEY uq_dataset_version (dataset_name, version_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ingestion_checkpoints (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ingestion_job_id BIGINT UNSIGNED NOT NULL,
  checkpoint_key VARCHAR(120) NOT NULL,
  checkpoint_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checkpoint (ingestion_job_id, checkpoint_key),
  CONSTRAINT fk_checkpoint_job FOREIGN KEY (ingestion_job_id) REFERENCES ingestion_jobs(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quality_alerts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ingestion_job_id BIGINT UNSIGNED NOT NULL,
  dataset_version_id BIGINT UNSIGNED NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  baseline_value DECIMAL(8,5) NOT NULL,
  current_value DECIMAL(8,5) NOT NULL,
  deviation_percent DECIMAL(8,5) NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quality_job FOREIGN KEY (ingestion_job_id) REFERENCES ingestion_jobs(id),
  CONSTRAINT fk_quality_dataset FOREIGN KEY (dataset_version_id) REFERENCES dataset_versions(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inspection_results (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  inspector_id BIGINT UNSIGNED NOT NULL,
  location_code VARCHAR(32) NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  outcome ENUM('pass', 'fail', 'recheck_required') NOT NULL,
  score DECIMAL(5,2) NULL,
  findings JSON NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_results_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_results_inspector FOREIGN KEY (inspector_id) REFERENCES users(id),
  INDEX idx_results_scope (location_code, department_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_tombstones (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  inspection_result_id BIGINT UNSIGNED NOT NULL,
  tombstone_ref VARCHAR(180) NOT NULL,
  tombstoned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retention_reason VARCHAR(255) NOT NULL,
  CONSTRAINT fk_tombstone_result FOREIGN KEY (inspection_result_id) REFERENCES inspection_results(id),
  UNIQUE KEY uq_tombstone_result (inspection_result_id)
) ENGINE=InnoDB;

SET @has_audit_logs := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'
);
SET @has_audit_events := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_events'
);
SET @rename_audit_stmt := IF(
  @has_audit_logs > 0 AND @has_audit_events = 0,
  'RENAME TABLE audit_logs TO audit_events',
  'SELECT 1'
);
PREPARE stmt_audit_rename FROM @rename_audit_stmt;
EXECUTE stmt_audit_rename;
DEALLOCATE PREPARE stmt_audit_rename;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(64) NULL,
  action VARCHAR(120) NOT NULL,
  target_table VARCHAR(120) NOT NULL,
  target_record_id VARCHAR(120) NULL,
  location_code VARCHAR(32) NULL,
  department_code VARCHAR(32) NULL,
  event_hash CHAR(64) NULL,
  details JSON NULL,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_audit_event_time (event_time),
  INDEX idx_audit_scope (location_code, department_code)
) ENGINE=InnoDB;

INSERT INTO roles (name, description)
VALUES
  ('Administrator', 'Platform administration with global rights'),
  ('Data Engineer', 'Data pipelines and ingestion governance'),
  ('Coordinator', 'Appointment and workflow coordination'),
  ('Inspector', 'Inspection execution and result entry'),
  ('Customer', 'Customer self-service and appointment visibility')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO users
(username, email, full_name, password_hash, password_salt, role_id, location_code, department_code, is_active)
SELECT
  'admin',
  'admin@roadsafe.internal',
  'RoadSafe Administrator',
  '$2b$12$rScX4rsROPygKCefhYxLoePP5qVsY0eVs/k40A0lP1XI5h8Rnqyde',
  NULL,
  r.id,
  'HQ',
  'OPS',
  1
FROM roles r
WHERE r.name = 'Administrator'
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  password_salt = VALUES(password_salt),
  role_id = VALUES(role_id),
  location_code = VALUES(location_code),
  department_code = VALUES(department_code),
  is_active = VALUES(is_active);

INSERT INTO facilities_resources
  (resource_type, resource_name, facility_code, location_code, department_code, status, metadata, is_active)
SELECT * FROM (
  SELECT 'inspection_bay', 'Bay 1', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('bayNumber', 1, 'supportsHeavyDuty', FALSE), 1
  UNION ALL SELECT 'inspection_bay', 'Bay 2', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('bayNumber', 2, 'supportsHeavyDuty', FALSE), 1
  UNION ALL SELECT 'inspection_bay', 'Bay 3', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('bayNumber', 3, 'supportsHeavyDuty', TRUE), 1
  UNION ALL SELECT 'inspection_bay', 'Bay 4', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('bayNumber', 4, 'supportsHeavyDuty', TRUE), 1
  UNION ALL SELECT 'inspection_bay', 'Bay 5', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('bayNumber', 5, 'supportsHeavyDuty', TRUE), 1
  UNION ALL SELECT 'inspection_bay', 'Bay 6', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('bayNumber', 6, 'supportsHeavyDuty', TRUE), 1
  UNION ALL SELECT 'equipment', 'Emissions Analyzer A', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('equipmentType', 'emissions_analyzer', 'setCode', 'ESET-A'), 1
  UNION ALL SELECT 'equipment', 'Emissions Analyzer B', 'HQ-F1', 'HQ', 'OPS', 'available', JSON_OBJECT('equipmentType', 'emissions_analyzer', 'setCode', 'ESET-B'), 1
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM facilities_resources fr
  WHERE fr.location_code = 'HQ' AND fr.department_code = 'OPS'
);

INSERT INTO equipment_usage_counters (equipment_resource_id, tests_since_recalibration)
SELECT id, 0
FROM facilities_resources
WHERE resource_type = 'equipment'
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.equipmentType')) = 'emissions_analyzer'
  AND NOT EXISTS (
    SELECT 1 FROM equipment_usage_counters euc WHERE euc.equipment_resource_id = facilities_resources.id
  );

INSERT INTO waiting_room_seats (location_code, department_code, seat_label, x_pos, y_pos, is_active)
SELECT 'HQ', 'OPS', CONCAT('S', n.n), ((n.n - 1) % 8) * 60, FLOOR((n.n - 1) / 8) * 60, 1
FROM (
  SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
  UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16
) n
WHERE NOT EXISTS (
  SELECT 1 FROM waiting_room_seats wrs WHERE wrs.location_code = 'HQ' AND wrs.department_code = 'OPS'
);

INSERT INTO vehicle_records
  (appointment_id, vin, plate_number, brand, model_name, model_year, price_usd, energy_type, transmission)
SELECT NULL, 'VIN001', 'KAA123A', 'Toyota', 'Corolla', 2022, 18000, 'petrol', 'automatic'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_records WHERE plate_number = 'KAA123A');

INSERT INTO vehicle_records
  (appointment_id, vin, plate_number, brand, model_name, model_year, price_usd, energy_type, transmission)
SELECT NULL, 'VIN002', 'KBB456B', 'Nissan', 'Leaf', 2021, 22000, 'electric', 'automatic'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_records WHERE plate_number = 'KBB456B');

DELIMITER $$

DROP TRIGGER IF EXISTS tr_audit_events_block_update $$
CREATE TRIGGER tr_audit_events_block_update
BEFORE UPDATE ON audit_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_events is append-only: updates are not permitted';
END $$

DROP TRIGGER IF EXISTS tr_audit_events_block_delete $$
CREATE TRIGGER tr_audit_events_block_delete
BEFORE DELETE ON audit_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_events is append-only: deletes are not permitted';
END $$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;
