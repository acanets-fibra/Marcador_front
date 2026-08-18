# Marcador · Control de asistencia

MVP visual y funcional de un sistema de control de asistencia con reconocimiento facial.

## Ejecutar

```bash
npm install
npm run dev
```

Después abre la URL que muestra Vite.

## Backend PostgreSQL

El backend está en `server/` y se conecta a la base de datos PostgreSQL `marcador`.

1. Copia `.env.example` como `.env`.
2. Cambia `TU_PASSWORD` por la contraseña de tu usuario de PostgreSQL.
3. Inicia la API:

```bash
npm run server
```

Al iniciar, el servidor crea automáticamente las tablas y el usuario administrador inicial. La API queda disponible en `http://localhost:4000`.

También puedes ejecutar el esquema manualmente desde pgAdmin usando [server/schema.sql](server/schema.sql). El endpoint `GET /api/health` permite comprobar la conexión.

Credenciales iniciales configurables en `.env`:

- Usuario: `admin@acanets.com`
- Contraseña: `admin123`

El backend expone autenticación JWT, CRUD de empleados, registro de múltiples descriptores faciales por empleado, identificación facial, marcaciones automáticas y consultas de dashboard.

## Acceso demo

- Usuario: `admin@acanets.com`
- Contraseña: `admin123`

## Incluye

- Login administrativo con sesión, validación de credenciales y cierre de sesión.
- Dashboard administrativo con resumen de presentes, tardanzas, ausentes y actividad reciente.
- Gestión de empleados con búsqueda y formulario de alta.
- Edición y eliminación de empleados con confirmación.
- Registro facial desde administración con cámara y tres muestras: frente, izquierda y derecha.
- Las muestras faciales se guardan localmente por empleado y pueden repetirse/actualizarse.
- Historial de marcaciones.
- Vista de horarios, asistencia y reportes.
- Modo marcador/kiosco con reloj, cámara real vía `getUserMedia` y reconocimiento automático sin selector manual.
- Entrada/salida automática según la última marcación del día.

## Reconocimiento facial

El navegador genera descriptores con `@vladmandic/face-api` durante las tres capturas. El backend puede guardar esos descriptores y comparar el rostro de la cámara contra todos los empleados registrados, sin seleccionar manualmente a una persona.
