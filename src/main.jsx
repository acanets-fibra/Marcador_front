import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { jsPDF } from 'jspdf'
import { extractFaceDescriptor, findBestFaceMatch, loadFaceModels } from './faceRecognition'
import { AutomaticKiosk, FaceCaptureWithEmbedding } from './FaceRecognitionViews'
import { translatePage } from './i18n'
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ScanFace,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import './styles.css'

const seedEmployees = [
  { id: 1, name: 'Ana López', initials: 'AL', area: 'Operaciones', role: 'Coordinadora', schedule: '08:00 — 17:00', status: 'Activo', tone: 'lavender' },
  { id: 2, name: 'Carlos Pérez', initials: 'CP', area: 'Tecnología', role: 'Desarrollador', schedule: '08:00 — 17:00', status: 'Activo', tone: 'mint' },
  { id: 3, name: 'Eduardo Iraheta', initials: 'EI', area: 'Finanzas', role: 'Analista financiero', schedule: '08:00 — 17:00', status: 'Activo', tone: 'peach' },
  { id: 4, name: 'Pedro López', initials: 'PL', area: 'Ventas', role: 'Ejecutivo comercial', schedule: '08:00 — 17:00', status: 'Activo', tone: 'sky' },
  { id: 5, name: 'Sofía Morales', initials: 'SM', area: 'Recursos Humanos', role: 'Especialista RR. HH.', schedule: '08:00 — 17:00', status: 'Activo', tone: 'rose' },
  { id: 6, name: 'María Castillo', initials: 'MC', area: 'Operaciones', role: 'Supervisora', schedule: '07:30 — 16:30', status: 'Activo', tone: 'gold' },
]

const seedPunches = [
  { id: 1, employeeId: 1, type: 'ENTRADA', time: '07:52 AM', date: 'Hoy', confidence: 0.98, method: 'FACIAL', late: false },
  { id: 2, employeeId: 2, type: 'ENTRADA', time: '07:56 AM', date: 'Hoy', confidence: 0.97, method: 'FACIAL', late: false },
  { id: 3, employeeId: 3, type: 'ENTRADA', time: '07:58 AM', date: 'Hoy', confidence: 0.96, method: 'FACIAL', late: false },
  { id: 4, employeeId: 4, type: 'ENTRADA', time: '08:14 AM', date: 'Hoy', confidence: 0.94, method: 'FACIAL', late: true },
  { id: 5, employeeId: 6, type: 'ENTRADA', time: '07:31 AM', date: 'Hoy', confidence: 0.99, method: 'FACIAL', late: false },
  { id: 6, employeeId: 3, type: 'SALIDA', time: '12:08 PM', date: 'Ayer', confidence: 0.96, method: 'FACIAL', late: false },
]

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'employees', label: 'Empleados', icon: Users },
  { key: 'punches', label: 'Marcaciones', icon: Fingerprint },
  { key: 'schedules', label: 'Horarios', icon: CalendarDays },
  { key: 'attendance', label: 'Asistencia', icon: BarChart3 },
  { key: 'reports', label: 'Reportes', icon: FileText },
]

const defaultSettings = {
  companyName: 'Acánets',
  companyEmail: 'rrhh@acanets.com',
  timezone: 'America/Guatemala',
  language: 'Español',
  automaticPunch: true,
  requireLiveness: true,
  confidence: 90,
  cooldown: 30,
  emailAlerts: true,
  darkMode: false,
}

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('marcador-session')) || null } catch { return null }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function punchDateKey(punch) {
  if (punch.dateKey) return punch.dateKey
  if (punch.date === 'Hoy') return localDateKey()
  if (punch.date === 'Ayer') return localDateKey(new Date(Date.now() - 86400000))
  return ''
}

function formatDateKey(dateKey) {
  if (!dateKey) return 'Seleccionar fecha'
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function reportFileName(title, extension) {
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-${localDateKey()}.${extension}`
}

function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function parsePunchMinutes(time) {
  const match = String(time || '').match(/(\d{1,2}):(\d{2})\s*([ap])(?:\.?\s*m\.?)?/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (match[3].toLowerCase() === 'p' && hour < 12) hour += 12
  if (match[3].toLowerCase() === 'a' && hour === 12) hour = 0
  return hour * 60 + minute
}

function workedTime(entry, exit) {
  if (!entry) return '—'
  if (!exit) return 'En curso'
  const start = parsePunchMinutes(entry.time)
  const end = parsePunchMinutes(exit.time)
  if (start == null || end == null || end < start) return '—'
  const minutes = end - start
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function AttendanceFunctional({ stats, employees, punches, onToast }) {
  const today = localDateKey()
  const dateLabel = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rows = employees.map((employee) => {
    const employeePunches = punches.filter((punch) => punch.employeeId === employee.id && punchDateKey(punch) === today)
    const entry = employeePunches.filter((punch) => punch.type === 'ENTRADA').sort((a, b) => Number(b.id) - Number(a.id))[0]
    const exit = employeePunches.filter((punch) => punch.type === 'SALIDA').sort((a, b) => Number(b.id) - Number(a.id))[0]
    return { employee, entry, exit }
  })

  const downloadAttendanceReport = () => {
    const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    document.setTextColor(35, 43, 66)
    document.setFont('helvetica', 'bold')
    document.setFontSize(18)
    document.text('Marcador · Asistencia de hoy', 14, 18)
    document.setFont('helvetica', 'normal')
    document.setFontSize(9)
    document.setTextColor(105, 114, 134)
    document.text(`${dateLabel} · ${rows.length} empleados`, 14, 25)
    document.setFillColor(68, 83, 160)
    document.rect(12, 35, 273, 8, 'F')
    document.setTextColor(255, 255, 255)
    document.setFontSize(8)
    ;[['Empleado', 14], ['Entrada', 92], ['Estado', 145], ['Horas trabajadas', 220]].forEach(([label, x]) => document.text(label, x, 40))
    let y = 50
    rows.forEach(({ employee, entry }) => {
      if (y > 190) { document.addPage(); y = 20; document.setFillColor(68, 83, 160); document.rect(12, 15, 273, 8, 'F'); document.setTextColor(255, 255, 255); document.text('Empleado', 14, 20); document.text('Entrada', 92, 20); document.text('Estado', 145, 20); document.text('Horas trabajadas', 220, 20); y = 30 }
      const status = entry ? (entry.late ? 'Llegó tarde' : 'Presente') : 'Ausente'
      const worked = workedTime(entry, rows.find((row) => row.employee.id === employee.id)?.exit)
      document.setDrawColor(225, 229, 237)
      document.setTextColor(35, 43, 66)
      document.line(12, y + 3, 285, y + 3)
      document.setFontSize(8)
      document.text(employee.name, 14, y)
      document.text(entry?.time || 'Sin registro', 92, y)
      document.text(status, 145, y)
      document.text(worked, 220, y)
      y += 9
    })
    document.save(reportFileName('asistencia-de-hoy', 'pdf'))
    onToast({ kind: 'success', title: 'Reporte descargado', message: 'El PDF de asistencia de hoy se guardó correctamente.' })
  }

  return <><PageHeading eyebrow="Resumen operativo" title="Asistencia de hoy" description="Estado de presencia y puntualidad del equipo." action={<button className="secondary-button" onClick={downloadAttendanceReport}><Download size={16} /> Descargar reporte</button>} /><div className="metric-grid compact"><MetricCard label="Presentes" value={stats.present} detail="marcaron entrada" icon={<Check />} tone="green" /><MetricCard label="Tarde" value={stats.late} detail="requieren seguimiento" icon={<Clock3 />} tone="orange" /><MetricCard label="Ausentes" value={stats.absent} detail="sin registro hoy" icon={<UserRound />} tone="blue" /><MetricCard label="Puntualidad" value={`${stats.punctuality}%`} detail="del personal presente" icon={<BarChart3 />} tone="violet" /></div><div className="card table-card attendance-table"><div className="card-header"><div><h2>Detalle por empleado</h2><p>{dateLabel}</p></div><span className="live-label"><i className="live-dot" /> En vivo</span></div><div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Entrada</th><th>Estado</th><th>Horas trabajadas</th><th /></tr></thead><tbody>{rows.map(({ employee, entry, exit }) => <tr key={employee.id}><td><div className="table-person"><div className={`avatar ${employee.tone}`}>{employee.initials}</div><div><strong>{employee.name}</strong><span>{employee.area}</span></div></div></td><td>{entry ? <strong>{entry.time}</strong> : <span className="muted-text">Sin registro</span>}</td><td>{entry ? <span className={`attendance-status ${entry.late ? 'late' : 'present'}`}><i />{entry.late ? 'Llegó tarde' : 'Presente'}</span> : <span className="attendance-status absent"><i />Ausente</span>}</td><td>{workedTime(entry, exit)}</td><td><MoreHorizontal size={18} className="muted-icon" /></td></tr>)}</tbody></table></div></div></>
}

function ReportsDownloadable({ employees, punches, onToast }) {
  const rows = punches.map((punch) => {
    const employee = employees.find((item) => item.id === punch.employeeId)
    return {
      Empleado: employee?.name || 'Empleado eliminado',
      Código: employee ? `EMP-${String(employee.id).padStart(4, '0')}` : '—',
      Área: employee?.area || 'Sin área',
      Tipo: punch.type,
      Fecha: punch.dateKey ? formatDateKey(punch.dateKey) : punch.date,
      Hora: punch.time,
      Método: punch.method === 'MANUAL' ? 'Manual' : 'Facial',
      Confianza: `${Math.round((punch.confidence ?? 0) * 100)}%`,
    }
  })
  const todayRows = rows.filter((row, index) => punchDateKey(punches[index]) === localDateKey())
  const currentMonth = localDateKey().slice(0, 7)
  const monthlyRows = rows.filter((_row, index) => punchDateKey(punches[index]).startsWith(currentMonth))
  const lateRows = rows.filter((_row, index) => Boolean(punches[index].late))
  const definitions = [
    { title: 'Reporte diario', description: 'Resumen de entradas, salidas y tardanzas del día.', period: 'Hoy', Icon: BarChart3, tone: 'violet', data: todayRows },
    { title: 'Asistencia mensual', description: 'Detalle de marcaciones del mes actual.', period: 'Mes actual', Icon: CalendarDays, tone: 'green', data: monthlyRows },
    { title: 'Tardanzas', description: 'Identifica las marcaciones que llegaron fuera de horario.', period: `${lateRows.length} registros`, Icon: Clock3, tone: 'orange', data: lateRows },
    { title: 'Por empleado', description: 'Historial completo agrupado por colaborador.', period: `${employees.length} empleados`, Icon: UserRound, tone: 'blue', data: rows },
  ]
  const headers = ['Empleado', 'Código', 'Área', 'Tipo', 'Fecha', 'Hora', 'Método', 'Confianza']

  const downloadCsv = (title, data = rows) => {
    const content = [headers, ...data.map((row) => headers.map((header) => row[header]))].map((line) => line.map(csvValue).join(',')).join('\r\n')
    downloadBlob(`\ufeff${content}`, reportFileName(title, 'csv'), 'text/csv;charset=utf-8')
    onToast({ kind: 'success', title: 'CSV descargado', message: `${title} contiene ${data.length} registros.` })
  }

  const downloadPdf = (title, data = rows) => {
    const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const columns = ['Empleado', 'Área', 'Tipo', 'Fecha', 'Hora', 'Método', 'Confianza']
    const xPositions = [14, 70, 135, 165, 195, 225, 260]
    const drawTableHeader = () => {
      document.setFillColor(68, 83, 160)
      document.rect(12, 35, 273, 8, 'F')
      document.setTextColor(255, 255, 255)
      document.setFontSize(8)
      columns.forEach((column, index) => document.text(column, xPositions[index], 40))
      document.setTextColor(35, 43, 66)
    }
    document.setTextColor(35, 43, 66)
    document.setFont('helvetica', 'bold')
    document.setFontSize(18)
    document.text(`Marcador · ${title}`, 14, 18)
    document.setFont('helvetica', 'normal')
    document.setFontSize(9)
    document.setTextColor(105, 114, 134)
    document.text(`Generado el ${formatDateKey(localDateKey())} · ${data.length} registros`, 14, 25)
    drawTableHeader()
    let y = 50
    data.forEach((row) => {
      if (y > 190) {
        document.addPage()
        y = 20
        drawTableHeader()
        y = 50
      }
      document.setDrawColor(225, 229, 237)
      document.line(12, y + 3, 285, y + 3)
      document.setFontSize(8)
      const values = [row.Empleado, row.Área, row.Tipo, row.Fecha, row.Hora, row.Método, row.Confianza]
      values.forEach((value, index) => document.text(String(value), xPositions[index], y))
      y += 9
    })
    if (data.length === 0) {
      document.setTextColor(120, 128, 145)
      document.text('No hay registros para este reporte.', 14, 55)
    }
    document.save(reportFileName(title, 'pdf'))
    onToast({ kind: 'success', title: 'PDF descargado', message: `${title} está listo para revisar.` })
  }

  return <><PageHeading eyebrow="Análisis y exportación" title="Reportes" description="Genera y descarga información clara para tus decisiones de personal." /><div className="report-grid">{definitions.map(({ title, description, period, Icon, tone, data }) => <div className="card report-card" key={title}><div className={`report-icon ${tone}`}><Icon size={20} /></div><h2>{title}</h2><p>{description}</p><span className="report-period">{period} · {data.length} filas</span><button className="report-action" onClick={() => downloadPdf(title, data)}>Descargar PDF <Download size={15} /></button></div>)}</div><div className="card export-card"><div><div className="eyebrow">Exportación rápida</div><h2>Descarga tus datos</h2><p>Exporta las {punches.length} marcaciones y {employees.length} empleados registrados.</p></div><div className="export-actions"><button className="secondary-button" onClick={() => downloadCsv('marcaciones-completas')}><Download size={16} /> CSV</button><button className="primary-button" onClick={() => downloadPdf('marcaciones-completas')}><FileText size={16} /> PDF</button></div></div></>
}

function App() {
  const [mode, setMode] = useState('admin')
  const [authUser, setAuthUser] = useState(readSession)
  const [loginError, setLoginError] = useState('')
  const [section, setSection] = useState('dashboard')
  const [employees, setEmployees] = useState(() => readStore('marcador-employees', seedEmployees))
  const [punches, setPunches] = useState(() => readStore('marcador-punches', seedPunches))
  const [faceRecords, setFaceRecords] = useState(() => readStore('marcador-face-records', {}))
  const [settings, setSettings] = useState(() => readStore('marcador-settings', defaultSettings))
  const [search, setSearch] = useState('')
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [deletingEmployee, setDeletingEmployee] = useState(null)
  const [faceEmployee, setFaceEmployee] = useState(null)
  const [toast, setToast] = useState(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)

  const handleLogin = (credentials) => {
    const valid = (credentials.email === 'admin@acanets.com' || credentials.email === 'admin') && credentials.password === 'admin123'
    if (!valid) {
      setLoginError('Usuario o contraseña incorrectos.')
      return false
    }
    const user = { name: 'Eduardo R.', role: 'Administrador', email: 'admin@acanets.com' }
    sessionStorage.setItem('marcador-session', JSON.stringify(user))
    setAuthUser(user)
    setLoginError('')
    return true
  }

  const handleLogout = () => {
    sessionStorage.removeItem('marcador-session')
    setAuthUser(null)
    setMode('admin')
    setSection('dashboard')
  }

  useEffect(() => localStorage.setItem('marcador-employees', JSON.stringify(employees)), [employees])
  useEffect(() => localStorage.setItem('marcador-punches', JSON.stringify(punches)), [punches])
  useEffect(() => localStorage.setItem('marcador-face-records', JSON.stringify(faceRecords)), [faceRecords])
  useEffect(() => localStorage.setItem('marcador-settings', JSON.stringify(settings)), [settings])
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', Boolean(settings.darkMode))
  }, [settings.darkMode])
  useEffect(() => {
    translatePage(settings.language)
  }, [settings.language])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  const todayEntries = punches.filter((punch) => punchDateKey(punch) === localDateKey() && punch.type === 'ENTRADA')
  const presentIds = new Set(todayEntries.map((punch) => punch.employeeId))
  const lateIds = new Set(todayEntries.filter((punch) => punch.late).map((punch) => punch.employeeId))
  const stats = { employees: employees.length, present: presentIds.size, late: lateIds.size, absent: Math.max(employees.length - presentIds.size, 0), punctuality: presentIds.size ? Math.max(0, Math.round(((presentIds.size - lateIds.size) / presentIds.size) * 100)) : 0 }
  const recentPunches = punches.slice(0, 5)

  const addEmployee = (data) => {
    const usedIds = new Set(employees.map((employee) => employee.id))
    let employeeId = Date.now()
    while (usedIds.has(employeeId)) employeeId += 1
    const newEmployee = { ...data, role: data.role.trim() || 'Empleado', id: employeeId, initials: data.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), status: 'Activo', tone: 'sky' }
    setEmployees((current) => [newEmployee, ...current])
    setShowEmployeeForm(false)
    setFaceEmployee(newEmployee)
    setToast({ kind: 'success', title: 'Empleado agregado', message: 'Ahora registra sus tres muestras faciales.' })
  }

  const saveFaceRecord = (employeeId, record) => {
    const employeeKey = String(employeeId)
    const nextFaceRecords = { ...faceRecords, [employeeKey]: record }
    setFaceRecords(nextFaceRecords)
    // Guardado inmediato y por clave de empleado: nunca reemplaza los rostros anteriores.
    localStorage.setItem('marcador-face-records', JSON.stringify(nextFaceRecords))
    setFaceEmployee(null)
    setToast({ kind: 'success', title: 'Rostro registrado', message: 'Las tres posiciones faciales quedaron guardadas para este empleado.' })
  }

  const updateEmployee = (data) => {
    setEmployees((current) => current.map((employee) => employee.id === editingEmployee.id ? { ...employee, ...data, name: data.name.trim(), role: data.role.trim() || 'Empleado', initials: data.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() } : employee))
    setEditingEmployee(null)
    setToast({ kind: 'success', title: 'Empleado actualizado', message: 'Los cambios se guardaron sin modificar su registro facial.' })
  }

  const removeEmployee = () => {
    if (!deletingEmployee) return
    const employeeId = deletingEmployee.id
    setEmployees((current) => current.filter((employee) => employee.id !== employeeId))
    setPunches((current) => current.filter((punch) => punch.employeeId !== employeeId))
    setFaceRecords((current) => {
      const next = { ...current }
      delete next[employeeId]
      return next
    })
    setDeletingEmployee(null)
    setToast({ kind: 'success', title: 'Empleado eliminado', message: `${deletingEmployee.name} y sus datos asociados fueron eliminados.` })
  }

  const registerPunch = (employee, type = null) => {
    const lastToday = punches.find((punch) => punch.employeeId === employee.id && punchDateKey(punch) === localDateKey())
    const nextType = type || (lastToday?.type === 'ENTRADA' ? 'SALIDA' : 'ENTRADA')
    const now = new Date()
    const time = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })
    const punch = { id: Date.now(), employeeId: employee.id, type: nextType, time, date: 'Hoy', dateKey: localDateKey(now), confidence: 0.96, method: 'FACIAL', late: nextType === 'ENTRADA' && now.getHours() >= 8 && now.getMinutes() > 5 }
    setPunches((current) => [punch, ...current])
    setToast({ kind: 'success', title: `${nextType === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada`, message: `${employee.name} · ${time}` })
    return punch
  }

  if (mode === 'kiosk') return <AutomaticKiosk employees={employees} punches={punches} faceRecords={faceRecords} onBack={() => setMode('admin')} onPunch={registerPunch} />
  if (!authUser) return <Login onLogin={handleLogin} error={loginError} onKiosk={() => setMode('kiosk')} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Fingerprint size={19} /></div><span>marcador<span className="brand-dot">.</span></span></div>
        <WorkspaceSwitcher open={workspaceOpen} onToggle={() => setWorkspaceOpen((current) => !current)} onSettings={() => { setSection('settings'); setWorkspaceOpen(false) }} />
        <div className="nav-label">GESTIÓN</div>
        <nav>{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={`nav-item ${section === key ? 'active' : ''}`} onClick={() => setSection(key)}><Icon size={18} /><span>{label}</span>{key === 'punches' && <span className="nav-badge">5</span>}</button>)}</nav>
        <div className="sidebar-spacer" />
        <button className={`nav-item ${section === 'settings' ? 'active' : ''}`} onClick={() => setSection('settings')}><Settings2 size={18} /><span>Configuración</span></button>
         <div className="sidebar-footer"><div className="avatar avatar-small lavender">ER</div><div><strong>{authUser.name}</strong><span>{authUser.role}</span></div><button className="logout-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}><LogOut size={16} /></button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Acánets</span><span>/</span><strong>{navItems.find((item) => item.key === section)?.label || (section === 'settings' ? 'Configuración' : 'Dashboard')}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={() => setToast({ kind: 'info', title: 'Todo al día', message: 'No tienes nuevas notificaciones.' })}><Bell size={18} /><i /></button><button className="mode-button" onClick={() => setMode('kiosk')}><Camera size={16} /> Abrir modo marcador</button><div className="topbar-avatar">ER</div></div></header>
        <div className="page-body">
          {section === 'dashboard' && <Dashboard stats={stats} employees={employees} punches={recentPunches} onKiosk={() => setMode('kiosk')} onSection={setSection} />}
          {section === 'employees' && <Employees employees={employees} faceRecords={faceRecords} search={search} setSearch={setSearch} onNew={() => setShowEmployeeForm(true)} onEdit={(employee) => setEditingEmployee(employee)} onDelete={(employee) => setDeletingEmployee(employee)} onFace={(employee) => setFaceEmployee(employee)} />}
          {section === 'punches' && <PunchesByDate punches={punches} employees={employees} search={search} setSearch={setSearch} onToast={setToast} />}
          {section === 'schedules' && <Schedules employees={employees} />}
          {section === 'attendance' && <AttendanceFunctional stats={stats} employees={employees} punches={punches} onToast={setToast} />}
          {section === 'reports' && <ReportsDownloadable employees={employees} punches={punches} onToast={setToast} />}
          {section === 'settings' && <SettingsView settings={settings} onSave={setSettings} onToast={setToast} />}
        </div>
      </main>
      {showEmployeeForm && <EmployeeForm onClose={() => setShowEmployeeForm(false)} onSave={addEmployee} />}
      {editingEmployee && <EmployeeForm employee={editingEmployee} isEditing onClose={() => setEditingEmployee(null)} onSave={updateEmployee} />}
      {deletingEmployee && <DeleteEmployeeModal employee={deletingEmployee} onClose={() => setDeletingEmployee(null)} onConfirm={removeEmployee} />}
      {faceEmployee && <FaceCaptureWithEmbedding employee={faceEmployee} initialRecord={faceRecords[faceEmployee.id]} onClose={() => setFaceEmployee(null)} onSave={(record) => saveFaceRecord(faceEmployee.id, record)} />}
      {toast && <div className={`toast ${toast.kind}`}><div className="toast-icon">{toast.kind === 'success' ? <Check size={17} /> : <Sparkles size={17} />}</div><div><strong>{toast.title}</strong><span>{toast.message}</span></div><button onClick={() => setToast(null)}><X size={16} /></button></div>}
    </div>
  )
}

function Login({ onLogin, error, onKiosk }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const submit = (event) => { event.preventDefault(); onLogin(form) }
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="login-shell"><div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" /><div className="login-card"><div className="login-brand"><div className="brand-mark"><Fingerprint size={20} /></div><span>marcador<span className="brand-dot">.</span></span></div><div className="login-heading"><div className="eyebrow">Panel administrativo</div><h1>Bienvenido de nuevo</h1><p>Ingresa tus credenciales para administrar la asistencia de tu equipo.</p></div><form className="login-form" onSubmit={submit}><label>Correo electrónico<div className="login-input"><Mail size={17} /><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="admin@acanets.com" autoComplete="username" required /></div></label><label>Contraseña<div className="login-input"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="••••••••" autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Ver'}</button></div></label>{error && <div className="login-error"><X size={15} />{error}</div>}<button className="primary-button login-submit" type="submit"><LogIn size={17} /> Iniciar sesión</button></form><div className="demo-access"><span>Acceso de demostración</span><strong>admin@acanets.com</strong><small>Contraseña: admin123</small></div><div className="login-divider"><span>o</span></div><button className="kiosk-login-button" onClick={onKiosk}><Camera size={16} /> Abrir modo marcador</button><div className="login-security"><ShieldCheck size={15} /> Acceso protegido · Acánets</div></div></div>
}

function WorkspaceSwitcher({ open, onToggle, onSettings }) {
  return <div className={`workspace-switcher-wrap ${open ? 'open' : ''}`}>
    <button type="button" className="workspace-switcher" onClick={onToggle} aria-expanded={open} aria-label="Seleccionar espacio de trabajo">
      <div className="workspace-avatar">AC</div><div><strong>Acánets</strong><span>Control de asistencia</span></div><ChevronDown size={15} />
    </button>
    {open && <div className="workspace-menu">
      <div className="workspace-menu-label">ESPACIO ACTIVO</div>
      <button type="button" className="workspace-option active" onClick={onToggle}><div className="workspace-avatar">AC</div><div><strong>Acánets</strong><span>Control de asistencia</span></div><Check size={15} /></button>
      <div className="workspace-menu-divider" />
      <button type="button" className="workspace-menu-action" onClick={onSettings}><Settings2 size={15} /><span>Configurar espacio</span><ArrowUpRight size={14} /></button>
    </div>}
  </div>
}

function SettingsView({ settings, onSave, onToast }) {
  const [draft, setDraft] = useState(() => ({ ...defaultSettings, ...settings }))
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', Boolean(draft.darkMode))
  }, [draft.darkMode])
  useEffect(() => {
    translatePage(draft.language)
  }, [draft.language])
  const save = () => {
    onSave(draft)
    onToast({ kind: 'success', title: 'Configuración guardada', message: 'Las preferencias del marcador se actualizaron correctamente.' })
  }

  return <>
    <PageHeading
      eyebrow="Administración del sistema"
      title="Configuración"
      description="Personaliza tu organización, el marcador y las reglas de reconocimiento facial."
      action={<button className="primary-button" onClick={save}><Save size={16} /> Guardar cambios</button>}
    />
    <div className="settings-layout">
      <aside className="card settings-menu">
        <div className="settings-menu-title">CONFIGURACIÓN</div>
        <div className="settings-menu-item active"><Settings2 size={16} /><span>General</span></div>
        <div className="settings-menu-item"><ScanFace size={16} /><span>Reconocimiento facial</span></div>
        <div className="settings-menu-item"><ShieldCheck size={16} /><span>Seguridad</span></div>
        <div className="settings-menu-item"><Bell size={16} /><span>Notificaciones</span></div>
        <div className="settings-menu-help"><ShieldCheck size={16} /><div><strong>Datos protegidos</strong><span>La información biométrica se guarda asociada a cada empleado.</span></div></div>
      </aside>
      <div className="settings-content">
        <section className="card settings-card">
          <div className="settings-card-heading"><div className="settings-icon violet"><Settings2 size={18} /></div><div><h2>Información general</h2><p>Datos básicos que aparecerán en el panel y el marcador.</p></div></div>
          <div className="settings-form-grid">
            <label>Nombre de la organización<input value={draft.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="Nombre de la empresa" /></label>
            <label>Correo de contacto<input type="email" value={draft.companyEmail} onChange={(event) => update('companyEmail', event.target.value)} placeholder="correo@empresa.com" /></label>
            <label>Zona horaria<select value={draft.timezone} onChange={(event) => update('timezone', event.target.value)}><option value="America/Guatemala">Guatemala (UTC-06:00)</option><option value="America/Mexico_City">Ciudad de México (UTC-06:00)</option><option value="America/El_Salvador">El Salvador (UTC-06:00)</option><option value="America/Costa_Rica">Costa Rica (UTC-06:00)</option></select></label>
            <label>Idioma del sistema<select value={draft.language} onChange={(event) => update('language', event.target.value)}><option>Español</option><option>English</option></select></label>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-heading"><div className="settings-icon blue"><ScanFace size={18} /></div><div><h2>Reconocimiento facial</h2><p>Define cómo se valida la identidad en el modo marcador.</p></div></div>
          <div className="settings-options">
            <SettingToggle icon={<Camera size={17} />} title="Marcación automática" description="Registra la entrada o salida al reconocer un rostro, sin seleccionar empleado." checked={draft.automaticPunch} onChange={(value) => update('automaticPunch', value)} />
            <SettingToggle icon={<ShieldCheck size={17} />} title="Comprobar detección de vida" description="Solicita una persona real frente a la cámara para reducir intentos con fotografías." checked={draft.requireLiveness} onChange={(value) => update('requireLiveness', value)} />
          </div>
          <div className="settings-range-row"><div><strong>Confianza mínima</strong><span>Solo acepta coincidencias iguales o superiores a este porcentaje.</span></div><div className="range-control"><input type="range" min="70" max="99" value={draft.confidence} onChange={(event) => update('confidence', Number(event.target.value))} /><b>{draft.confidence}%</b></div></div>
          <div className="settings-form-grid settings-small-grid"><label>Tiempo entre marcaciones<select value={draft.cooldown} onChange={(event) => update('cooldown', Number(event.target.value))}><option value="15">15 segundos</option><option value="30">30 segundos</option><option value="60">1 minuto</option><option value="120">2 minutos</option></select></label></div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-heading"><div className="settings-icon green"><Bell size={18} /></div><div><h2>Notificaciones</h2><p>Controla los avisos que recibirá el administrador.</p></div></div>
          <SettingToggle icon={<Mail size={17} />} title="Alertas por correo" description="Recibir avisos cuando el sistema detecte un problema con una marcación." checked={draft.emailAlerts} onChange={(value) => update('emailAlerts', value)} />
        </section>

        <section className="card settings-card">
          <div className="settings-card-heading"><div className="settings-icon violet"><Moon size={18} /></div><div><h2>Apariencia</h2><p>Elige cómo quieres ver el panel administrativo.</p></div></div>
          <SettingToggle icon={<Moon size={17} />} title="Modo oscuro" description="Reduce el brillo de la interfaz y aplica un tema oscuro en todo el panel." checked={draft.darkMode} onChange={(value) => update('darkMode', value)} />
        </section>

        <div className="settings-footer-note"><ShieldCheck size={15} /><span>Los cambios se guardan en este dispositivo y se aplican al recargar el sistema.</span><button className="secondary-button" onClick={() => { setDraft({ ...defaultSettings }); onToast({ kind: 'info', title: 'Valores restaurados', message: 'Revisa los valores y guarda para aplicarlos.' }) }}><RotateCcw size={14} /> Restaurar</button></div>
      </div>
    </div>
  </>
}

function SettingToggle({ icon, title, description, checked, onChange }) {
  return <div className="settings-toggle-row"><div className="settings-toggle-icon">{icon}</div><div className="settings-toggle-copy"><strong>{title}</strong><span>{description}</span></div><button className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}><i /></button></div>
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Dashboard({ stats, employees, punches, onKiosk, onSection }) {
  return <>
    <PageHeading eyebrow="Viernes, 14 de agosto de 2026" title="Buenos días, Eduardo" description="Este es el resumen de asistencia de tu equipo para hoy." action={<button className="primary-button" onClick={onKiosk}><Camera size={17} /> Abrir marcador</button>} />
    <div className="metric-grid"><MetricCard label="Empleados" value={stats.employees} detail="total registrados" icon={<Users />} tone="violet" /><MetricCard label="Presentes hoy" value={stats.present} detail={`${Math.round((stats.present / Math.max(stats.employees, 1)) * 100)}% del equipo`} icon={<Check />} tone="green" trend="+8.2%" /><MetricCard label="Llegadas tarde" value={stats.late} detail="después de las 08:05" icon={<Clock3 />} tone="orange" trend="-2.4%" /><MetricCard label="Ausentes" value={stats.absent} detail="sin marcación de entrada" icon={<UserRound />} tone="blue" /></div>
    <div className="dashboard-grid"><section className="card recent-card"><div className="card-header"><div><h2>Marcaciones recientes</h2><p>Actividad del marcador en tiempo real</p></div><button className="text-button" onClick={() => onSection('punches')}>Ver historial <ArrowUpRight size={15} /></button></div><div className="punch-list">{punches.map((punch) => <PunchRow key={punch.id} punch={punch} employee={employees.find((e) => e.id === punch.employeeId)} />)}</div></section><section className="card attendance-card"><div className="card-header"><div><h2>Estado del equipo</h2><p>Distribución de hoy</p></div><MoreHorizontal size={18} className="muted-icon" /></div><div className="donut-wrap"><div className="donut" style={{ '--present': `${(stats.present / Math.max(stats.employees, 1)) * 100}%` }}><div><strong>{Math.round((stats.present / Math.max(stats.employees, 1)) * 100)}%</strong><span>presentes</span></div></div><div className="legend"><LegendDot color="green" label="Presentes" value={stats.present} /><LegendDot color="orange" label="Tardanzas" value={stats.late} /><LegendDot color="blue" label="Ausentes" value={stats.absent} /></div></div><div className="card-divider" /><div className="mini-foot"><span><i className="live-dot" /> Actualizado hace un momento</span><button onClick={() => onSection('attendance')}>Ver detalle <ArrowUpRight size={14} /></button></div></section></div>
    <section className="card quick-card"><div className="quick-icon"><Camera size={20} /></div><div><h3>El marcador está listo</h3><p>Los empleados pueden registrar su entrada y salida usando reconocimiento facial.</p></div><button className="secondary-button" onClick={onKiosk}>Ir al kiosco <ArrowUpRight size={15} /></button></section>
  </>
}

function MetricCard({ label, value, detail, icon, tone, trend }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-main"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>{trend && <span className={`trend ${trend.startsWith('+') ? 'positive' : 'negative'}`}>{trend}</span>}</div> }
function LegendDot({ color, label, value }) { return <div className="legend-row"><i className={`legend-dot ${color}`} /><span>{label}</span><strong>{value}</strong></div> }
function PunchRow({ punch, employee }) { return <div className="punch-row"><div className={`avatar ${employee?.tone || 'sky'}`}>{employee?.initials}</div><div className="punch-person"><strong>{employee?.name || 'Empleado'}</strong><span>{employee?.area || '—'}</span></div><span className={`punch-type ${punch.type === 'ENTRADA' ? 'entry' : 'exit'}`}><i />{punch.type === 'ENTRADA' ? 'Entrada' : 'Salida'}</span><span className="punch-time">{punch.time}</span>{punch.late && <span className="late-chip">Tarde</span>}</div> }

function Employees({ employees, faceRecords, search, setSearch, onNew, onEdit, onDelete, onFace }) {
  const filtered = employees.filter((employee) => employee.name.toLowerCase().includes(search.toLowerCase()) || employee.area.toLowerCase().includes(search.toLowerCase()))
  return <>
    <PageHeading eyebrow="Gestión del equipo" title="Empleados" description="Administra las personas registradas y sus credenciales faciales." action={<button className="primary-button" onClick={onNew}><Plus size={17} /> Nuevo empleado</button>} />
    <div className="card table-card"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o área..." /></div><button className="filter-button">Todos los estados <ChevronDown size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Área / cargo</th><th>Horario asignado</th><th>Rostro</th><th>Estado</th><th /></tr></thead><tbody>{filtered.map((employee) => { const ready = (faceRecords[employee.id]?.samples?.length || 0) >= 3; return <tr key={employee.id}><td><div className="table-person"><div className={`avatar ${employee.tone}`}>{employee.initials}</div><div><strong>{employee.name}</strong><span>EMP-{String(employee.id).padStart(4, '0')}</span></div></div></td><td><strong className="cell-main">{employee.area}</strong><span className="cell-sub">{employee.role}</span></td><td>{employee.schedule}</td><td><button className={`face-status face-action ${ready ? 'ready' : 'pending'}`} onClick={() => onFace(employee)}>{ready ? <Check size={13} /> : <ScanFace size={13} />}{ready ? 'Registrado' : 'Registrar rostro'}</button></td><td><span className="status-pill"><i />{employee.status}</span></td><td><div className="row-actions"><button className="more-button" title={`Editar ${employee.name}`} aria-label={`Editar ${employee.name}`} onClick={() => onEdit(employee)}><Pencil size={16} /></button><button className="more-button delete-action" title={`Eliminar ${employee.name}`} aria-label={`Eliminar ${employee.name}`} onClick={() => onDelete(employee)}><Trash2 size={16} /></button></div></td></tr> })}</tbody></table>{filtered.length === 0 && <div className="empty-state">No encontramos empleados con “{search}”.</div>}</div><div className="table-footer"><span>Mostrando <strong>{filtered.length}</strong> de <strong>{employees.length}</strong> empleados</span><div className="pagination"><button disabled>‹</button><button className="current">1</button><button disabled>›</button></div></div></div>
  </>
}

function Punches({ punches, employees, search, setSearch }) {
  const filtered = punches.filter((punch) => employees.find((e) => e.id === punch.employeeId)?.name.toLowerCase().includes(search.toLowerCase()))
  return <><PageHeading eyebrow="Control de actividad" title="Marcaciones" description="Consulta las entradas y salidas registradas por el sistema." action={<button className="secondary-button"><Download size={16} /> Exportar</button>} /><div className="card table-card"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empleado..." /></div><button className="filter-button"><CalendarDays size={15} /> Hoy <ChevronDown size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Tipo</th><th>Fecha</th><th>Hora</th><th>Método</th><th>Confianza</th></tr></thead><tbody>{filtered.map((punch) => { const employee = employees.find((e) => e.id === punch.employeeId); return <tr key={punch.id}><td><div className="table-person"><div className={`avatar ${employee?.tone}`}>{employee?.initials}</div><div><strong>{employee?.name}</strong><span>{employee?.area}</span></div></div></td><td><span className={`punch-type ${punch.type === 'ENTRADA' ? 'entry' : 'exit'}`}><i />{punch.type}</span></td><td>{punch.date}</td><td><strong>{punch.time}</strong></td><td><span className="method-chip"><Fingerprint size={13} /> Facial</span></td><td><span className="confidence"><i />{Math.round(punch.confidence * 100)}%</span></td></tr> })}</tbody></table></div><div className="table-footer"><span><strong>{filtered.length}</strong> marcaciones encontradas</span></div></div></>
}

function PunchesByDate({ punches, employees, search, setSearch, onToast }) {
  const [selectedDate, setSelectedDate] = useState(localDateKey())
  const filtered = punches.filter((punch) => {
    const employee = employees.find((item) => item.id === punch.employeeId)
    const matchesSearch = employee?.name?.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && punchDateKey(punch) === selectedDate
  })
  const dateLabel = selectedDate === localDateKey() ? 'Hoy' : formatDateKey(selectedDate)
  const exportFiltered = () => {
    const headers = ['Empleado', 'Código', 'Área', 'Tipo', 'Fecha', 'Hora', 'Método', 'Confianza']
    const lines = filtered.map((punch) => {
      const employee = employees.find((item) => item.id === punch.employeeId)
      return [employee?.name || 'Empleado eliminado', employee ? `EMP-${String(employee.id).padStart(4, '0')}` : '—', employee?.area || 'Sin área', punch.type, punch.dateKey ? formatDateKey(punch.dateKey) : punch.date, punch.time, punch.method === 'MANUAL' ? 'Manual' : 'Facial', `${Math.round((punch.confidence ?? 0) * 100)}%`]
    })
    const content = [headers, ...lines].map((line) => line.map(csvValue).join(',')).join('\r\n')
    downloadBlob(`\ufeff${content}`, reportFileName(`marcaciones-${selectedDate}`, 'csv'), 'text/csv;charset=utf-8')
    onToast({ kind: 'success', title: 'Exportación completada', message: `Se descargaron ${filtered.length} marcaciones de ${dateLabel.toLowerCase()}.` })
  }

  return <>
    <PageHeading eyebrow="Control de actividad" title="Marcaciones" description="Consulta las entradas y salidas registradas por el sistema." action={<button className="secondary-button" onClick={exportFiltered}><Download size={16} /> Exportar CSV</button>} />
    <div className="card table-card">
      <div className="table-toolbar">
        <div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empleado..." aria-label="Buscar empleado" /></div>
        <label className="date-picker" title="Filtrar marcaciones por fecha"><CalendarDays size={16} /><span>{dateLabel}</span><input type="date" aria-label="Filtrar por fecha" value={selectedDate} onInput={(event) => setSelectedDate(event.currentTarget.value)} onChange={(event) => setSelectedDate(event.target.value)} /><ChevronDown size={14} /></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Tipo</th><th>Fecha</th><th>Hora</th><th>Método</th><th>Confianza</th></tr></thead><tbody>{filtered.map((punch) => { const employee = employees.find((e) => e.id === punch.employeeId); return <tr key={punch.id}><td><div className="table-person"><div className={`avatar ${employee?.tone}`}>{employee?.initials}</div><div><strong>{employee?.name || 'Empleado eliminado'}</strong><span>{employee?.area || 'Sin área'}</span></div></div></td><td><span className={`punch-type ${punch.type === 'ENTRADA' ? 'entry' : 'exit'}`}><i />{punch.type}</span></td><td>{punch.dateKey ? formatDateKey(punch.dateKey) : punch.date}</td><td><strong>{punch.time}</strong></td><td><span className="method-chip"><Fingerprint size={13} /> {punch.method === 'MANUAL' ? 'Manual' : 'Facial'}</span></td><td><span className="confidence"><i />{Math.round((punch.confidence ?? 0) * 100)}%</span></td></tr> })}</tbody></table>{filtered.length === 0 && <div className="empty-state">No hay marcaciones para {dateLabel.toLowerCase()}.</div>}</div>
      <div className="table-footer"><span><strong>{filtered.length}</strong> marcaciones encontradas</span><span className="date-result-label">{dateLabel}</span></div>
    </div>
  </>
}

function Schedules({ employees }) { return <><PageHeading eyebrow="Organización" title="Horarios" description="Define los turnos y tolerancias de tu equipo." action={<button className="primary-button"><Plus size={17} /> Nuevo horario</button>} /><div className="schedule-layout"><div className="card schedule-card"><div className="card-header"><div><h2>Horarios activos</h2><p>Turnos disponibles para asignar</p></div></div>{[['Horario administrativo','08:00 — 17:00','Lunes a viernes','4 empleados','violet'],['Turno operativo','07:30 — 16:30','Lunes a sábado','1 empleado','green'],['Horario flexible','09:00 — 18:00','Lunes a viernes','0 empleados','orange']].map(([name,time,days,count,tone]) => <div className="schedule-row" key={name}><div className={`schedule-icon ${tone}`}><Clock3 size={18} /></div><div><strong>{name}</strong><span>{days}</span></div><b>{time}</b><small>{count}</small><MoreHorizontal size={17} className="muted-icon" /></div>)}</div><div className="card assigned-card"><div className="card-header"><div><h2>Asignaciones</h2><p>Empleados por horario</p></div></div><div className="assigned-total"><strong>{employees.length}</strong><span>empleados asignados</span></div><div className="progress-line"><span style={{ width: '83%' }} /></div><div className="assign-foot"><span>5 de 6 con horario</span><span>83%</span></div></div></div></> }

function Attendance({ stats, employees, punches }) { const rows = employees.map((employee) => { const entry = punches.find((p) => p.employeeId === employee.id && p.date === 'Hoy' && p.type === 'ENTRADA'); return { employee, entry } }); return <><PageHeading eyebrow="Resumen operativo" title="Asistencia de hoy" description="Estado de presencia y puntualidad del equipo." action={<button className="secondary-button"><Download size={16} /> Descargar reporte</button>} /><div className="metric-grid compact"><MetricCard label="Presentes" value={stats.present} detail="marcaron entrada" icon={<Check />} tone="green" /><MetricCard label="Tarde" value={stats.late} detail="requieren seguimiento" icon={<Clock3 />} tone="orange" /><MetricCard label="Ausentes" value={stats.absent} detail="sin registro hoy" icon={<UserRound />} tone="blue" /><MetricCard label="Puntualidad" value={`${Math.round(((stats.present - stats.late) / Math.max(stats.present, 1)) * 100)}%`} detail="del personal presente" icon={<BarChart3 />} tone="violet" /></div><div className="card table-card attendance-table"><div className="card-header"><div><h2>Detalle por empleado</h2><p>Viernes, 14 de agosto de 2026</p></div><span className="live-label"><i className="live-dot" /> En vivo</span></div><div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Entrada</th><th>Estado</th><th>Horas trabajadas</th><th /></tr></thead><tbody>{rows.map(({ employee, entry }) => <tr key={employee.id}><td><div className="table-person"><div className={`avatar ${employee.tone}`}>{employee.initials}</div><div><strong>{employee.name}</strong><span>{employee.area}</span></div></div></td><td>{entry ? <strong>{entry.time}</strong> : <span className="muted-text">Sin registro</span>}</td><td>{entry ? <span className={`attendance-status ${entry.late ? 'late' : 'present'}`}><i />{entry.late ? 'Llegó tarde' : 'Presente'}</span> : <span className="attendance-status absent"><i />Ausente</span>}</td><td>{entry ? '—' : '—'}</td><td><MoreHorizontal size={18} className="muted-icon" /></td></tr>)}</tbody></table></div></div></> }

function Reports({ employees, punches, onToast }) { return <><PageHeading eyebrow="Análisis y exportación" title="Reportes" description="Genera información clara para tus decisiones de personal." /><div className="report-grid">{[['Reporte diario','Resumen de entradas, salidas y tardanzas del día.','Hoy',BarChart3,'violet'],['Asistencia mensual','Detalle de horas trabajadas por empleado.','Agosto 2026',CalendarDays,'green'],['Tardanzas','Identifica patrones de llegada tarde.','Últimos 30 días',Clock3,'orange'],['Por empleado','Historial completo de un colaborador.','Seleccionar empleado',UserRound,'blue']].map(([title,desc,period,Icon,tone]) => <div className="card report-card" key={title}><div className={`report-icon ${tone}`}><Icon size={20} /></div><h2>{title}</h2><p>{desc}</p><button className="report-action" onClick={() => onToast({ kind: 'success', title: 'Reporte preparado', message: `${title} listo para descargar en la próxima versión.` })}>{period}<ArrowUpRight size={15} /></button></div>)}</div><div className="card export-card"><div><div className="eyebrow">Exportación rápida</div><h2>Descarga tus datos</h2><p>Exporta las {punches.length} marcaciones y {employees.length} empleados registrados.</p></div><div className="export-actions"><button className="secondary-button" onClick={() => onToast({ kind: 'success', title: 'Exportación CSV', message: 'El archivo se generará al conectar el backend.' })}><Download size={16} /> CSV</button><button className="primary-button" onClick={() => onToast({ kind: 'success', title: 'Exportación PDF', message: 'El PDF se generará al conectar el backend.' })}><FileText size={16} /> PDF</button></div></div></> }

function EmployeeForm({ onClose, onSave, employee = null, isEditing = false }) { const [form, setForm] = useState(() => employee ? { name: employee.name, area: employee.area, role: employee.role, schedule: employee.schedule } : { name: '', area: 'Operaciones', role: '', schedule: '08:00 — 17:00' }); const update = (key, value) => setForm((current) => ({ ...current, [key]: value })); return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><div className="eyebrow">{isEditing ? 'Editar registro' : 'Nuevo registro'}</div><h2>{isEditing ? 'Editar empleado' : 'Agregar empleado'}</h2><p>{isEditing ? 'Actualiza los datos sin perder su registro facial.' : 'Escribe el nombre para continuar con el rostro.'}</p></div><button className="close-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label>Nombre completo<input autoFocus value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ej. Juan Pérez" /></label><label>Área<select value={form.area} onChange={(e) => update('area', e.target.value)}><option>Operaciones</option><option>Tecnología</option><option>Finanzas</option><option>Ventas</option><option>Recursos Humanos</option></select></label><label>Cargo<input value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="Opcional · Ej. Analista" /></label><label>Horario<select value={form.schedule} onChange={(e) => update('schedule', e.target.value)}><option>08:00 — 17:00</option><option>07:30 — 16:30</option><option>09:00 — 18:00</option></select></label></div><div className="face-capture-box"><div className="face-capture-icon">{isEditing ? <Pencil size={19} /> : <Camera size={19} />}</div><div><strong>{isEditing ? 'Registro facial conservado' : 'Registrar rostro en el siguiente paso'}</strong><span>{isEditing ? 'Los cambios de datos no afectan las muestras faciales guardadas.' : 'Al guardar, se abrirá automáticamente la captura frontal, izquierda y derecha.'}</span></div><ShieldCheck size={19} className="muted-icon" /></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!form.name.trim()} onClick={() => onSave(form)}>{isEditing ? <Pencil size={16} /> : <Check size={16} />} {isEditing ? 'Guardar cambios' : 'Guardar y registrar rostro'}</button></div></div></div> }

function DeleteEmployeeModal({ employee, onClose, onConfirm }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal delete-modal"><div className="delete-icon"><Trash2 size={22} /></div><div className="eyebrow">Acción irreversible</div><h2>¿Eliminar a {employee.name}?</h2><p>Se eliminarán sus datos personales, muestras faciales y marcaciones guardadas. Esta acción no se puede deshacer.</p><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="danger-button" onClick={onConfirm}><Trash2 size={16} /> Sí, eliminar empleado</button></div></div></div> }

function FaceCapture({ employee, initialRecord, onClose, onSave }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const [camera, setCamera] = useState(false)
  const [error, setError] = useState('')
  const [captures, setCaptures] = useState(() => initialRecord?.samples || [])
  const steps = [{ label: 'Mira al frente', hint: 'Rostro centrado' }, { label: 'Gira ligeramente a la izquierda', hint: 'Sin mover el cuerpo' }, { label: 'Gira ligeramente a la derecha', hint: 'Mantén los ojos abiertos' }]
  const currentStep = Math.min(captures.length, steps.length - 1)
  const complete = captures.length === steps.length

  useEffect(() => {
    if (camera && streamRef.current && videoRef.current) videoRef.current.srcObject = streamRef.current
  }, [camera])
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  const activateCamera = async () => {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no expone una cámara.')
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      setCamera(true)
    } catch {
      setError('No pudimos acceder a la cámara. Revisa el permiso del navegador y vuelve a intentarlo.')
    }
  }

  const captureSample = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      setError('Espera un momento a que aparezca la imagen de la cámara.')
      return
    }
    const canvas = canvasRef.current
    canvas.width = 640
    canvas.height = 480
    const context = canvas.getContext('2d')
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const sample = canvas.toDataURL('image/jpeg', 0.82)
    setCaptures((current) => [...current, sample].slice(0, steps.length))
    setError('')
  }

  const resetCapture = () => setCaptures([])
  const save = () => onSave({ samples: captures, capturedAt: new Date().toISOString(), embedding: null, liveness: { checked: true, method: 'multi-angle-capture' } })

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal face-modal"><div className="modal-head"><div><div className="eyebrow">Identidad biométrica</div><h2>Registrar rostro</h2><p>{employee.name} · captura segura de tres posiciones</p></div><button className="close-button" onClick={onClose}><X size={18} /></button></div><div className="face-progress">{steps.map((step, index) => <div className={`face-step ${index < captures.length ? 'done' : ''} ${index === currentStep && !complete ? 'current' : ''}`} key={step.label}><div>{index < captures.length ? <Check size={14} /> : index + 1}</div><span>{step.label}</span></div>)}</div><div className="face-camera-area">{camera ? <video ref={videoRef} autoPlay muted playsInline className="face-video" /> : <div className="face-camera-empty"><ScanFace size={37} /><strong>Prepara la cámara</strong><span>Usaremos tres capturas para mejorar la coincidencia.</span><button className="secondary-button" onClick={activateCamera}><Camera size={16} /> Activar cámara</button></div>}{camera && !complete && <div className="face-guide"><div className="face-guide-oval" /><span>{steps[currentStep].label}</span><small>{steps[currentStep].hint}</small></div>}{complete && <div className="face-complete"><div><Check size={21} /></div><strong>Las tres muestras están listas</strong><span>El rostro quedó asociado a {employee.name}.</span></div>}<div className="face-corners"><i /><i /><i /><i /></div></div><canvas ref={canvasRef} className="hidden-canvas" />{error && <div className="face-error"><X size={14} />{error}</div>}<div className="face-capture-foot"><div><ShieldCheck size={16} /><span>La cámara se apaga al cerrar este registro.</span></div>{captures.length > 0 && <button className="text-button" onClick={resetCapture}><RotateCcw size={14} /> Repetir capturas</button>}</div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button>{!camera && !complete ? <button className="primary-button" onClick={activateCamera}><Camera size={16} /> Activar cámara</button> : complete ? <button className="primary-button" onClick={save}><Check size={16} /> Guardar rostro</button> : <button className="primary-button" onClick={captureSample}><ScanFace size={16} /> Capturar posición {captures.length + 1} de 3</button>}</div></div></div>
}

function Kiosk({ employees, punches, faceRecords, onBack, onPunch }) { const eligibleEmployees = employees.filter((employee) => (faceRecords[employee.id]?.samples?.length || 0) >= 3); const videoRef = useRef(null); const streamRef = useRef(null); const [camera, setCamera] = useState(false); const [scanning, setScanning] = useState(false); const [result, setResult] = useState(null); const [selectedId, setSelectedId] = useState(eligibleEmployees[0]?.id || ''); const [now, setNow] = useState(new Date()); const selected = eligibleEmployees.find((employee) => employee.id === Number(selectedId)); useEffect(() => { const interval = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(interval) }, []); useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []); const activateCamera = async () => { try { const stream = await navigator.mediaDevices?.getUserMedia({ video: true }); if (stream && videoRef.current) { videoRef.current.srcObject = stream; streamRef.current = stream } setCamera(true) } catch { setCamera(true) } }; const scan = () => { if (!selected) return; setScanning(true); setResult(null); setTimeout(() => { const punch = onPunch(selected); setResult({ type: punch.type, time: punch.time, employee: selected }); setScanning(false) }, 1600) }; const last = punches.find((p) => p.employeeId === selected?.id && p.date === 'Hoy'); const nextAction = last?.type === 'ENTRADA' ? 'Registrar salida' : 'Registrar entrada'; return <div className="kiosk-shell"><header className="kiosk-topbar"><div className="brand"><div className="brand-mark"><Fingerprint size={19} /></div><span>marcador<span className="brand-dot">.</span></span></div><div className="kiosk-status"><i className="live-dot" /> Sistema operativo <span>•</span> {now.toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' })}</div><button className="kiosk-admin-button" onClick={onBack}><LayoutDashboard size={16} /> Panel administrador</button></header><main className="kiosk-main"><div className="kiosk-intro"><div className="eyebrow">Control de asistencia</div><h1>Marca tu asistencia<br /><em>en segundos.</em></h1><p>Colócate frente a la cámara. Nosotros hacemos el resto.</p><div className="kiosk-time">{now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}<span>{now.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div><div className="privacy-note"><ShieldCheck size={17} /><span>Tu información biométrica está protegida y se utiliza únicamente para validar tu asistencia.</span></div></div><div className={`camera-card ${scanning ? 'is-scanning' : ''} ${result ? 'has-result' : ''}`}><div className="camera-frame">{camera && <video ref={videoRef} autoPlay muted playsInline />}{!camera && <div className="camera-placeholder"><div className="camera-placeholder-glow" /><Camera size={40} /><span>Cámara lista para iniciar</span></div>}{scanning && <div className="scan-overlay"><div className="scan-line" /><div className="scan-copy"><Sparkles size={19} /> Analizando rostro...</div></div>}{result && <div className="result-overlay"><div className="result-check"><Check size={27} /></div><span>Identidad confirmada</span><strong>{result.employee.name}</strong><small>{result.type === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada · {result.time}</small></div>}<div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" /></div><div className="camera-controls">{!camera ? <button className="primary-button wide" onClick={activateCamera}><Camera size={17} /> Activar cámara</button> : eligibleEmployees.length === 0 ? <div className="kiosk-empty"><ScanFace size={18} /><span>No hay rostros registrados todavía.</span><button className="text-button" onClick={onBack}>Registrar desde administración</button></div> : <><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={scanning || Boolean(result)}>{eligibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><button className="primary-button wide" onClick={scan} disabled={scanning || Boolean(result)}><Fingerprint size={17} /> {scanning ? 'Validando...' : result ? 'Marcación registrada' : nextAction}</button>{result && <button className="text-button reset-button" onClick={() => setResult(null)}>Nueva marcación</button>}</>}</div><div className="camera-foot"><span><i className="green-pulse" /> Detección de vida activa</span><span><ShieldCheck size={14} /> Confianza mínima 90%</span></div></div></main><footer className="kiosk-footer"><span><BriefcaseBusiness size={15} /> Acánets · Sistema de control interno</span><span>¿Necesitas ayuda? <strong>Contacta a RR. HH.</strong></span></footer></div> }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
