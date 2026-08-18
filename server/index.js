import 'dotenv/config';

import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { query, withTransaction } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
const faceDistanceThreshold = Number(process.env.FACE_DISTANCE_THRESHOLD || 0.5);

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
}));
app.use(express.json({ limit: '12mb' }));
app.use(morgan('dev'));

function sendError(res, status, message, details) {
  return res.status(status).json({ error: message, ...(details ? { details } : {}) });
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    jwtSecret,
    { expiresIn: '8h' },
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return sendError(res, 401, 'Debes iniciar sesión.');

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return sendError(res, 401, 'La sesión expiró o no es válida.');
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function serializeEmployee(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    area: row.area,
    jobTitle: row.job_title,
    schedule: row.schedule,
    status: row.status,
    faceRegistered: Boolean(row.face_registered),
    descriptorCount: Number(row.descriptor_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function euclideanDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return Infinity;
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = Number(left[index]) - Number(right[index]);
    if (!Number.isFinite(difference)) return Infinity;
    total += difference * difference;
  }
  return Math.sqrt(total);
}

async function findBestEmployee(descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length === 0) return null;

  const { rows } = await query(`
    SELECT e.*, fr.descriptors
    FROM employees e
    INNER JOIN face_records fr ON fr.employee_id = e.id
    WHERE e.status = 'Activo'
  `);

  let best = null;
  for (const row of rows) {
    const descriptors = asArray(row.descriptors);
    for (const savedDescriptor of descriptors) {
      const distance = euclideanDistance(descriptor, savedDescriptor);
      if (!best || distance < best.distance) best = { row, distance };
    }
  }

  if (!best || best.distance > faceDistanceThreshold) return null;
  return {
    employee: serializeEmployee({ ...best.row, face_registered: true, descriptor_count: 1 }),
    distance: best.distance,
    confidence: Math.max(0, Math.min(1, 1 - best.distance)),
  };
}

async function writeAudit(actorUserId, action, entity, entityId, metadata = {}) {
  await query(
    `INSERT INTO audit_log (actor_user_id, action, entity, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorUserId || null, action, entity || null, entityId || null, JSON.stringify(metadata)],
  );
}

app.get('/api/health', async (_req, res) => {
  try {
    const result = await query('SELECT NOW() AS server_time');
    return res.json({ ok: true, database: 'connected', serverTime: result.rows[0].server_time });
  } catch (error) {
    return sendError(res, 503, 'No se pudo conectar con PostgreSQL.', error.message);
  }
});

app.post('/api/auth/login', async (req, res) => {
  const identifier = String(req.body?.email || req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!identifier || !password) return sendError(res, 400, 'Correo y contraseña son obligatorios.');

  try {
    const { rows } = await query(
      `SELECT id, name, email, password_hash, role
       FROM admin_users
       WHERE active = TRUE
         AND (lower(email) = $1 OR ($1 = 'admin' AND lower(email) = 'admin@acanets.com'))
       LIMIT 1`,
      [identifier],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return sendError(res, 401, 'Credenciales incorrectas.');
    }

    return res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return sendError(res, 500, 'No se pudo iniciar sesión.', error.message);
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role FROM admin_users WHERE id = $1 AND active = TRUE',
      [req.user.sub],
    );
    if (!rows[0]) return sendError(res, 401, 'El usuario ya no está activo.');
    return res.json({ user: rows[0] });
  } catch (error) {
    return sendError(res, 500, 'No se pudo consultar la sesión.', error.message);
  }
});

app.get('/api/employees', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT e.*,
             (fr.id IS NOT NULL) AS face_registered,
             COALESCE(jsonb_array_length(fr.descriptors), 0) AS descriptor_count
      FROM employees e
      LEFT JOIN face_records fr ON fr.employee_id = e.id
      ORDER BY e.created_at DESC, e.id DESC
    `);
    return res.json({ employees: rows.map(serializeEmployee) });
  } catch (error) {
    return sendError(res, 500, 'No se pudieron consultar los empleados.', error.message);
  }
});

app.post('/api/employees', requireAuth, async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || body.fullName || '').trim();
  if (!name) return sendError(res, 400, 'El nombre del empleado es obligatorio.');

  const employeeCode = String(body.employeeCode || `EMP-${Date.now()}`).trim();
  const area = String(body.area || 'Operaciones').trim();
  const jobTitle = String(body.jobTitle || body.role || 'Empleado').trim();
  const schedule = String(body.schedule || '08:00 — 17:00').trim();
  const status = String(body.status || 'Activo').trim();

  try {
    const { rows } = await query(
      `INSERT INTO employees (employee_code, name, area, job_title, schedule, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [employeeCode, name, area, jobTitle, schedule, status],
    );
    await writeAudit(req.user.sub, 'CREATE', 'employee', rows[0].id, { employeeCode });
    return res.status(201).json({ employee: serializeEmployee({ ...rows[0], face_registered: false }) });
  } catch (error) {
    if (error.code === '23505') return sendError(res, 409, 'El código de empleado ya existe.');
    return sendError(res, 500, 'No se pudo crear el empleado.', error.message);
  }
});

app.put('/api/employees/:id', requireAuth, async (req, res) => {
  const body = req.body || {};
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return sendError(res, 400, 'Identificador de empleado inválido.');

  try {
    const { rows } = await query(
      `UPDATE employees
       SET employee_code = COALESCE(NULLIF($1, ''), employee_code),
           name = COALESCE(NULLIF($2, ''), name),
           area = COALESCE(NULLIF($3, ''), area),
           job_title = COALESCE(NULLIF($4, ''), job_title),
           schedule = COALESCE(NULLIF($5, ''), schedule),
           status = COALESCE(NULLIF($6, ''), status),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        body.employeeCode == null ? '' : String(body.employeeCode).trim(),
        body.name == null && body.fullName == null ? '' : String(body.name || body.fullName).trim(),
        body.area == null ? '' : String(body.area).trim(),
        body.jobTitle == null && body.role == null ? '' : String(body.jobTitle || body.role).trim(),
        body.schedule == null ? '' : String(body.schedule).trim(),
        body.status == null ? '' : String(body.status).trim(),
        id,
      ],
    );
    if (!rows[0]) return sendError(res, 404, 'Empleado no encontrado.');
    await writeAudit(req.user.sub, 'UPDATE', 'employee', id, body);
    return res.json({ employee: serializeEmployee(rows[0]) });
  } catch (error) {
    if (error.code === '23505') return sendError(res, 409, 'El código de empleado ya existe.');
    return sendError(res, 500, 'No se pudo actualizar el empleado.', error.message);
  }
});

app.delete('/api/employees/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return sendError(res, 400, 'Identificador de empleado inválido.');

  try {
    const result = await withTransaction(async (client) => {
      const deleted = await client.query(
        'DELETE FROM employees WHERE id = $1 RETURNING id, employee_code, name',
        [id],
      );
      if (!deleted.rows[0]) return null;
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, entity, entity_id, metadata)
         VALUES ($1, 'DELETE', 'employee', $2, $3::jsonb)`,
        [req.user.sub, id, JSON.stringify(deleted.rows[0])],
      );
      return deleted.rows[0];
    });
    if (!result) return sendError(res, 404, 'Empleado no encontrado.');
    return res.json({ ok: true, deleted: result });
  } catch (error) {
    return sendError(res, 500, 'No se pudo eliminar el empleado.', error.message);
  }
});

app.post('/api/employees/:id/face', requireAuth, async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId)) return sendError(res, 400, 'Identificador de empleado inválido.');

  const body = req.body || {};
  const samples = asArray(body.samples);
  const descriptors = asArray(body.descriptors).filter((item) => Array.isArray(item));
  const embedding = Array.isArray(body.embedding) ? body.embedding : null;
  if (descriptors.length === 0 && !embedding) {
    return sendError(res, 400, 'Debes enviar al menos un descriptor facial.');
  }

  try {
    const employee = await query('SELECT id FROM employees WHERE id = $1', [employeeId]);
    if (!employee.rows[0]) return sendError(res, 404, 'Empleado no encontrado.');

    const { rows } = await query(
      `INSERT INTO face_records (employee_id, samples, descriptors, embedding, liveness, captured_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, NOW())
       ON CONFLICT (employee_id) DO UPDATE SET
         samples = EXCLUDED.samples,
         descriptors = EXCLUDED.descriptors,
         embedding = EXCLUDED.embedding,
         liveness = EXCLUDED.liveness,
         captured_at = NOW(),
         updated_at = NOW()
       RETURNING id, employee_id, jsonb_array_length(descriptors) AS descriptor_count, captured_at`,
      [
        employeeId,
        JSON.stringify(samples),
        JSON.stringify(descriptors.length ? descriptors : [embedding]),
        embedding ? JSON.stringify(embedding) : null,
        JSON.stringify(body.liveness || {}),
      ],
    );
    await writeAudit(req.user.sub, 'UPSERT_FACE', 'employee', employeeId, {
      descriptorCount: Number(rows[0].descriptor_count),
    });
    return res.status(201).json({ face: rows[0] });
  } catch (error) {
    return sendError(res, 500, 'No se pudo guardar el rostro.', error.message);
  }
});

app.get('/api/employees/:id/face', requireAuth, async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId)) return sendError(res, 400, 'Identificador de empleado inválido.');
  try {
    const { rows } = await query(
      `SELECT employee_id, samples, descriptors, embedding, liveness, captured_at
       FROM face_records WHERE employee_id = $1`,
      [employeeId],
    );
    if (!rows[0]) return sendError(res, 404, 'Este empleado todavía no tiene rostro registrado.');
    return res.json({ face: rows[0] });
  } catch (error) {
    return sendError(res, 500, 'No se pudo consultar el rostro.', error.message);
  }
});

app.post('/api/recognition/identify', async (req, res) => {
  try {
    const match = await findBestEmployee(req.body?.descriptor);
    if (!match) return res.status(404).json({ match: false, message: 'Rostro no reconocido.' });
    return res.json({ match: true, ...match });
  } catch (error) {
    return sendError(res, 500, 'No se pudo realizar el reconocimiento.', error.message);
  }
});

app.post('/api/attendance/recognize', async (req, res) => {
  try {
    const match = await findBestEmployee(req.body?.descriptor);
    if (!match) return res.status(404).json({ match: false, message: 'Rostro no reconocido.' });

    const latest = await query(
      `SELECT punch_type FROM attendance_punches
       WHERE employee_id = $1 AND punched_at >= CURRENT_DATE
       ORDER BY punched_at DESC LIMIT 1`,
      [match.employee.id],
    );
    const punchType = latest.rows[0]?.punch_type === 'ENTRADA' ? 'SALIDA' : 'ENTRADA';
    const inserted = await query(
      `INSERT INTO attendance_punches (employee_id, punch_type, method, confidence, device_id)
       VALUES ($1, $2, 'FACIAL', $3, $4)
       RETURNING id, employee_id, punch_type, punched_at, method, confidence`,
      [match.employee.id, punchType, match.confidence, req.body?.deviceId || null],
    );
    return res.status(201).json({ match: true, employee: match.employee, punch: inserted.rows[0] });
  } catch (error) {
    return sendError(res, 500, 'No se pudo registrar la marcación facial.', error.message);
  }
});

app.post('/api/punches', requireAuth, async (req, res) => {
  const employeeId = Number(req.body?.employeeId);
  const punchType = String(req.body?.punchType || '').toUpperCase();
  if (!Number.isInteger(employeeId) || !['ENTRADA', 'SALIDA'].includes(punchType)) {
    return sendError(res, 400, 'Empleado y tipo de marcación son obligatorios.');
  }
  try {
    const { rows } = await query(
      `INSERT INTO attendance_punches (employee_id, punch_type, method, confidence, device_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employee_id, punch_type, punched_at, method, confidence`,
      [employeeId, punchType, req.body?.method || 'MANUAL', req.body?.confidence || null, req.body?.deviceId || null],
    );
    await writeAudit(req.user.sub, 'CREATE', 'attendance_punch', rows[0].id, { employeeId, punchType });
    return res.status(201).json({ punch: rows[0] });
  } catch (error) {
    if (error.code === '23503') return sendError(res, 404, 'Empleado no encontrado.');
    return sendError(res, 500, 'No se pudo registrar la marcación.', error.message);
  }
});

app.get('/api/punches', requireAuth, async (req, res) => {
  const date = String(req.query.date || '').trim();
  const employeeId = Number(req.query.employeeId);
  const conditions = [];
  const params = [];

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    params.push(date);
    conditions.push(`p.punched_at::date = $${params.length}`);
  }
  if (Number.isInteger(employeeId) && employeeId > 0) {
    params.push(employeeId);
    conditions.push(`p.employee_id = $${params.length}`);
  }

  try {
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT p.id, p.employee_id, e.employee_code, e.name, p.punch_type,
              p.punched_at, p.method, p.confidence, p.device_id
       FROM attendance_punches p
       INNER JOIN employees e ON e.id = p.employee_id
       ${where}
       ORDER BY p.punched_at DESC`,
      params,
    );
    return res.json({ punches: rows });
  } catch (error) {
    return sendError(res, 500, 'No se pudieron consultar las marcaciones.', error.message);
  }
});

app.get('/api/dashboard/today', requireAuth, async (_req, res) => {
  try {
    const [employees, registeredFaces, punches, entries, exits] = await Promise.all([
      query("SELECT COUNT(*)::int AS total FROM employees WHERE status = 'Activo'"),
      query('SELECT COUNT(*)::int AS total FROM face_records WHERE jsonb_array_length(descriptors) > 0'),
      query('SELECT COUNT(*)::int AS total FROM attendance_punches WHERE punched_at >= CURRENT_DATE'),
      query("SELECT COUNT(*)::int AS total FROM attendance_punches WHERE punched_at >= CURRENT_DATE AND punch_type = 'ENTRADA'"),
      query("SELECT COUNT(*)::int AS total FROM attendance_punches WHERE punched_at >= CURRENT_DATE AND punch_type = 'SALIDA'"),
    ]);
    return res.json({
      date: new Date().toISOString().slice(0, 10),
      employees: employees.rows[0].total,
      registeredFaces: registeredFaces.rows[0].total,
      punches: punches.rows[0].total,
      entries: entries.rows[0].total,
      exits: exits.rows[0].total,
    });
  } catch (error) {
    return sendError(res, 500, 'No se pudo consultar el dashboard.', error.message);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  return sendError(res, 500, 'Error interno del servidor.', error.message);
});

async function initializeDatabase() {
  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schema);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@acanets.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await query(
    `INSERT INTO admin_users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'ADMIN')
     ON CONFLICT (email) DO NOTHING`,
    [process.env.ADMIN_NAME || 'Administrador', adminEmail, passwordHash],
  );
}

async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL. Crea un archivo .env a partir de .env.example.');
  }
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`Backend de Marcador escuchando en http://localhost:${port}`);
    console.log(`Base de datos configurada: ${process.env.DATABASE_URL.replace(/:\/\/.*?:.*?@/, '://***:***@')}`);
  });
}

start().catch((error) => {
  console.error('No se pudo iniciar el backend:', error.message);
  process.exitCode = 1;
});
