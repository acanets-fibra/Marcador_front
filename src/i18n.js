const textNodes = new WeakMap()
const attributes = new WeakMap()
let observer

const dictionary = {
  'Panel administrativo': 'Administration panel',
  'Bienvenido de nuevo': 'Welcome back',
  'Ingresa tus credenciales para administrar la asistencia de tu equipo.': 'Enter your credentials to manage your team attendance.',
  'Correo electrónico': 'Email address',
  'Contraseña': 'Password',
  'Iniciar sesión': 'Sign in',
  'Acceso de demostración': 'Demo access',
  'Contraseña: admin123': 'Password: admin123',
  'Abrir modo marcador': 'Open attendance kiosk',
  'Acceso protegido · Acánets': 'Protected access · Acánets',
  'Control de asistencia': 'Attendance control',
  'GESTIÓN': 'MANAGEMENT',
  'CONFIGURACIÓN': 'SETTINGS',
  'General': 'General',
  'Seguridad': 'Security',
  'Dashboard': 'Dashboard',
  'Empleados': 'Employees',
  'GESTIÓN DEL EQUIPO': 'TEAM MANAGEMENT',
  'Administra las personas registradas y sus credenciales faciales.': 'Manage registered people and their facial credentials.',
  'Nuevo empleado': 'New employee',
  'Buscar por nombre o área...': 'Search by name or area...',
  'Todos los estados': 'All statuses',
  'Área / cargo': 'Area / job title',
  'Horario asignado': 'Assigned schedule',
  'Rostro': 'Face',
  'Mostrando': 'Showing',
  'de': 'of',
  'empleados': 'employees',
  'Marcaciones': 'Punches',
  'Horarios': 'Schedules',
  'Asistencia': 'Attendance',
  'Reportes': 'Reports',
  'Configuración': 'Settings',
  'Seleccionar espacio de trabajo': 'Select workspace',
  'ESPACIO ACTIVO': 'ACTIVE WORKSPACE',
  'Configurar espacio': 'Configure workspace',
  'Administración del sistema': 'System administration',
  'Personaliza tu organización, el marcador y las reglas de reconocimiento facial.': 'Customize your organization, kiosk and facial recognition rules.',
  'Guardar cambios': 'Save changes',
  'Información general': 'General information',
  'Datos básicos que aparecerán en el panel y el marcador.': 'Basic information shown in the panel and kiosk.',
  'Nombre de la organización': 'Organization name',
  'Correo de contacto': 'Contact email',
  'Zona horaria': 'Time zone',
  'Idioma del sistema': 'System language',
  'Español': 'Spanish',
  'Reconocimiento facial': 'Facial recognition',
  'Define cómo se valida la identidad en el modo marcador.': 'Define how identity is validated in kiosk mode.',
  'Marcación automática': 'Automatic punch',
  'Registra la entrada o salida al reconocer un rostro, sin seleccionar empleado.': 'Record entry or exit when a face is recognized, without selecting an employee.',
  'Comprobar detección de vida': 'Check liveness detection',
  'Solicita una persona real frente a la cámara para reducir intentos con fotografías.': 'Requires a real person in front of the camera to reduce photo spoofing.',
  'Confianza mínima': 'Minimum confidence',
  'Solo acepta coincidencias iguales o superiores a este porcentaje.': 'Only accepts matches equal to or above this percentage.',
  'Tiempo entre marcaciones': 'Time between punches',
  '15 segundos': '15 seconds',
  '30 segundos': '30 seconds',
  '1 minuto': '1 minute',
  '2 minutos': '2 minutes',
  'Nombre de la empresa': 'Company name',
  'correo@empresa.com': 'email@company.com',
  'Notificaciones': 'Notifications',
  'Controla los avisos que recibirá el administrador.': 'Control the alerts the administrator receives.',
  'Alertas por correo': 'Email alerts',
  'Recibir avisos cuando el sistema detecte un problema con una marcación.': 'Receive alerts when the system detects a punch issue.',
  'Apariencia': 'Appearance',
  'Elige cómo quieres ver el panel administrativo.': 'Choose how you want to view the administration panel.',
  'Modo oscuro': 'Dark mode',
  'Reduce el brillo de la interfaz y aplica un tema oscuro en todo el panel.': 'Reduce interface brightness and apply a dark theme throughout the panel.',
  'Datos protegidos': 'Protected data',
  'La información biométrica se guarda asociada a cada empleado.': 'Biometric information is stored linked to each employee.',
  'Los cambios se guardan en este dispositivo y se aplican al recargar el sistema.': 'Changes are saved on this device and apply when the system reloads.',
  'Restaurar': 'Restore',
  'Control de actividad': 'Activity control',
  'Consulta las entradas y salidas registradas por el sistema.': 'Review entries and exits recorded by the system.',
  'Exportar CSV': 'Export CSV',
  'Buscar empleado...': 'Search employee...',
  'Hoy': 'Today',
  'Ayer': 'Yesterday',
  'Filtrar por fecha': 'Filter by date',
  'Empleado': 'Employee',
  'Área': 'Area',
  'Tipo': 'Type',
  'Fecha': 'Date',
  'Hora': 'Time',
  'Método': 'Method',
  'Confianza': 'Confidence',
  'Entrada': 'Entry',
  'Salida': 'Exit',
  'Facial': 'Facial',
  'Manual': 'Manual',
  'No hay marcaciones para': 'There are no punches for',
  'marcaciones encontradas': 'punches found',
  'Análisis y exportación': 'Analysis and export',
  'Genera y descarga información clara para tus decisiones de personal.': 'Generate and download clear information for your staffing decisions.',
  'Reporte diario': 'Daily report',
  'Resumen de entradas, salidas y tardanzas del día.': 'Summary of daily entries, exits and late arrivals.',
  'Asistencia mensual': 'Monthly attendance',
  'Detalle de marcaciones del mes actual.': 'Details of punches for the current month.',
  'Mes actual': 'Current month',
  'Tardanzas': 'Late arrivals',
  'Identifica las marcaciones que llegaron fuera de horario.': 'Identify punches recorded outside the scheduled time.',
  'Por empleado': 'By employee',
  'Historial completo agrupado por colaborador.': 'Complete history grouped by employee.',
  'Descargar PDF': 'Download PDF',
  'Exportación rápida': 'Quick export',
  'Descarga tus datos': 'Download your data',
  'Exporta las': 'Export the',
  'marcaciones y': 'punches and',
  'registrados.': 'registered employees.',
  'Resumen operativo': 'Operations summary',
  'Asistencia de hoy': 'Today\'s attendance',
  'Estado de presencia y puntualidad del equipo.': 'Team presence and punctuality status.',
  'Descargar reporte': 'Download report',
  'Presentes': 'Present',
  'marcaron entrada': 'clocked in',
  'Tarde': 'Late',
  'requieren seguimiento': 'need follow-up',
  'Ausentes': 'Absent',
  'sin registro hoy': 'no record today',
  'Puntualidad': 'Punctuality',
  'del personal presente': 'of present staff',
  'Detalle por empleado': 'Details by employee',
  'En vivo': 'Live',
  'Estado': 'Status',
  'Horas trabajadas': 'Hours worked',
  'Presente': 'Present',
  'Llegó tarde': 'Late arrival',
  'Ausente': 'Absent',
  'Sin registro': 'No record',
  'En curso': 'In progress',
  'Viernes, 14 de agosto de 2026': 'Friday, August 14, 2026',
  'Organización': 'Organization',
  'Define los turnos y tolerancias de tu equipo.': 'Define your team shifts and tolerances.',
  'Horarios activos': 'Active schedules',
  'Turnos disponibles para asignar': 'Available shifts to assign',
  'Asignaciones': 'Assignments',
  'Empleados por horario': 'Employees by schedule',
  'empleados asignados': 'assigned employees',
  'Análisis': 'Analysis',
  'Genera información clara para tus decisiones de personal.': 'Generate clear information for your staffing decisions.',
  'Buenos días, Eduardo': 'Good morning, Eduardo',
  'Este es el resumen de asistencia de tu equipo para hoy.': 'Here is your team attendance summary for today.',
  'Presentes hoy': 'Present today',
  'total registrados': 'total registered',
  'Llegadas tarde': 'Late arrivals',
  'después de las 08:05': 'after 08:05',
  'Marcaciones recientes': 'Recent punches',
  'Actividad del marcador en tiempo real': 'Real-time kiosk activity',
  'Ver historial': 'View history',
  'Estado del equipo': 'Team status',
  'Distribución de hoy': 'Today\'s distribution',
  'Actualizado hace un momento': 'Updated moments ago',
  'Ver detalle': 'View details',
  'El marcador está listo': 'The kiosk is ready',
  'Los empleados pueden registrar su entrada y salida usando reconocimiento facial.': 'Employees can record entry and exit using facial recognition.',
  'Ir al kiosco': 'Go to kiosk',
  'Nuevo registro': 'New record',
  'Editar registro': 'Edit record',
  'Agregar empleado': 'Add employee',
  'Editar empleado': 'Edit employee',
  'Actualiza los datos sin perder su registro facial.': 'Update details without losing the facial record.',
  'Escribe el nombre para continuar con el rostro.': 'Enter the name to continue with face registration.',
  'Nombre completo': 'Full name',
  'Cargo': 'Job title',
  'Horario': 'Schedule',
  'Cancelar': 'Cancel',
  'Guardar y registrar rostro': 'Save and register face',
  'Registro facial conservado': 'Facial record preserved',
  'Registrar rostro en el siguiente paso': 'Register face in the next step',
  'Registrar rostro': 'Register face',
  'Registrado': 'Registered',
  'Activo': 'Active',
  'Eliminar empleado': 'Delete employee',
  'Empleado eliminado': 'Employee deleted',
  '¿Eliminar este empleado?': 'Delete this employee?',
  'Eliminar': 'Delete',
  'Cámara lista para iniciar': 'Camera ready to start',
  'Activar cámara': 'Activate camera',
  'Analizando rostro...': 'Analyzing face...',
  'Identidad confirmada': 'Identity confirmed',
  'Nueva marcación': 'New punch',
  'Detección de vida activa': 'Liveness detection active',
  'Confianza mínima 90%': 'Minimum confidence 90%',
  'Marca tu asistencia': 'Record your attendance',
  'en segundos.': 'in seconds.',
  'Colócate frente a la cámara. Nosotros hacemos el resto.': 'Stand in front of the camera. We will do the rest.',
  'Sistema operativo': 'System operational',
  'Panel administrador': 'Admin panel',
  'Tu información biométrica está protegida y se utiliza únicamente para validar tu asistencia.': 'Your biometric information is protected and used only to validate your attendance.',
  'No hay rostros registrados todavía.': 'No faces registered yet.',
  'Registrar desde administración': 'Register from administration',
  'Cerrar sesión': 'Sign out',
  'Ver': 'Show',
  'Ocultar': 'Hide',
  'Valores restaurados': 'Values restored',
  'Configuración guardada': 'Settings saved',
  'Rostro registrado': 'Face registered',
  'Empleado agregado': 'Employee added',
  'Empleado actualizado': 'Employee updated',
  'Las preferencias del marcador se actualizaron correctamente.': 'Kiosk preferences were updated successfully.',
  'Reporte descargado': 'Report downloaded',
  'Exportación completada': 'Export completed',
}

const replacements = [
  [/^(\d+) empleados$/, '$1 employees'],
  [/^(\d+) empleados asignados$/, '$1 assigned employees'],
  [/^(\d+) marcaciones encontradas$/, '$1 punches found'],
  [/^(\d+) registros$/, '$1 records'],
  [/^(\d+) filas$/, '$1 rows'],
  [/^Se descargaron (\d+) marcaciones de (.+)\.$/, 'Downloaded $1 punches from $2.'],
  [/^Editar (.+)$/, 'Edit $1'],
  [/^Eliminar (.+)$/, 'Delete $1'],
  [/^El PDF de asistencia de hoy se guardó correctamente\.$/, 'Today\'s attendance PDF was saved successfully.'],
  [/^Las tres posiciones faciales quedaron guardadas para este empleado\.$/, 'The three facial positions were saved for this employee.'],
]

function translateValue(value, language) {
  if (language !== 'English' || !value) return value
  const leading = value.match(/^\s*/)?.[0] || ''
  const trailing = value.match(/\s*$/)?.[0] || ''
  const core = value.trim()
  if (dictionary[core]) return `${leading}${dictionary[core]}${trailing}`
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(core)) return `${leading}${core.replace(pattern, replacement)}${trailing}`
  }
  return value
}

function translateTextNode(node, language) {
  const original = textNodes.get(node) ?? node.nodeValue
  textNodes.set(node, original)
  const translated = translateValue(original, language)
  if (node.nodeValue !== translated) node.nodeValue = translated
}

function translateElementAttributes(element, language) {
  const names = ['placeholder', 'aria-label', 'title']
  let original = attributes.get(element)
  if (!original) { original = {}; attributes.set(element, original) }
  names.forEach((name) => {
    if (!element.hasAttribute(name)) return
    if (original[name] == null) original[name] = element.getAttribute(name)
    const translated = translateValue(original[name], language)
    if (element.getAttribute(name) !== translated) element.setAttribute(name, translated)
  })
}

function translateNodeTree(root, language) {
  if (!root) return
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  translateElementAttributes(root, language)
  root.childNodes.forEach((child) => translateNodeTree(child, language))
}

export function translatePage(language = 'Español') {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language === 'English' ? 'en' : 'es'
  if (observer) observer.disconnect()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    if (!node.parentElement?.closest('script,style')) translateTextNode(node, language)
  }
  document.body.querySelectorAll('*').forEach((element) => translateElementAttributes(element, language))
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((added) => {
        translateNodeTree(added, language)
      })
      if (mutation.type === 'characterData') translateTextNode(mutation.target, language)
    })
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}
