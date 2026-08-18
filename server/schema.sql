-- Esquema del backend de Marcador.
-- Ejecuta este archivo conectado a la base de datos "marcador".

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'ADMIN',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  area VARCHAR(120) NOT NULL DEFAULT 'Operaciones',
  job_title VARCHAR(120) NOT NULL DEFAULT 'Empleado',
  schedule VARCHAR(80) NOT NULL DEFAULT '08:00 — 17:00',
  status VARCHAR(30) NOT NULL DEFAULT 'Activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS face_records (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  samples JSONB NOT NULL DEFAULT '[]'::JSONB,
  descriptors JSONB NOT NULL DEFAULT '[]'::JSONB,
  embedding JSONB,
  liveness JSONB,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_punches (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  punch_type VARCHAR(10) NOT NULL CHECK (punch_type IN ('ENTRADA', 'SALIDA')),
  punched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method VARCHAR(30) NOT NULL DEFAULT 'FACIAL',
  confidence NUMERIC(6,5),
  device_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80),
  entity_id BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date
  ON attendance_punches (employee_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON attendance_punches (punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_log (created_at DESC);
