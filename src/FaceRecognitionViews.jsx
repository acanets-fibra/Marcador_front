import { useEffect, useMemo, useRef, useState } from 'react'
import { BriefcaseBusiness, Camera, Check, Fingerprint, LayoutDashboard, RotateCcw, ScanFace, ShieldCheck, Sparkles, X } from 'lucide-react'
import { extractFaceDescriptor, findBestFaceMatch, loadFaceModels } from './faceRecognition'

const captureSteps = [
  { label: 'Mira al frente', hint: 'Rostro centrado' },
  { label: 'Gira ligeramente a la izquierda', hint: 'Sin mover el cuerpo' },
  { label: 'Gira ligeramente a la derecha', hint: 'Mantén los ojos abiertos' },
]

export function FaceCaptureWithEmbedding({ employee, initialRecord, onClose, onSave }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const hasValidRecord = initialRecord?.samples?.length === 3 && initialRecord?.descriptors?.length === 3
  const [camera, setCamera] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [error, setError] = useState('')
  const [captures, setCaptures] = useState(() => hasValidRecord ? initialRecord.samples : [])
  const [descriptors, setDescriptors] = useState(() => hasValidRecord ? initialRecord.descriptors : [])
  const currentStep = Math.min(captures.length, captureSteps.length - 1)
  const complete = captures.length === captureSteps.length && descriptors.length === captureSteps.length

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
      setModelLoading(true)
      await loadFaceModels()
      setModelReady(true)
    } catch (cameraError) {
      setError(cameraError?.message?.includes('cámara') ? cameraError.message : 'No pudimos cargar el modelo facial o acceder a la cámara. Revisa los permisos e inténtalo de nuevo.')
    } finally {
      setModelLoading(false)
    }
  }

  const captureSample = async () => {
    if (!modelReady || !videoRef.current || videoRef.current.readyState < 2) {
      setError('Espera a que la cámara y el modelo facial estén listos.')
      return
    }
    setError('')
    try {
      const descriptor = await extractFaceDescriptor(videoRef.current)
      if (!descriptor) throw new Error('No se detectó un rostro. Colócate dentro del óvalo y vuelve a intentar.')
      const canvas = canvasRef.current
      canvas.width = 640
      canvas.height = 480
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const sample = canvas.toDataURL('image/jpeg', 0.82)
      setCaptures((current) => [...current, sample].slice(0, captureSteps.length))
      setDescriptors((current) => [...current, descriptor].slice(0, captureSteps.length))
    } catch (captureError) {
      setError(captureError.message || 'No pudimos analizar el rostro.')
    }
  }

  const resetCapture = () => { setCaptures([]); setDescriptors([]); setError('') }
  const save = () => {
    const embedding = descriptors[0].map((_, index) => descriptors.reduce((sum, descriptor) => sum + descriptor[index], 0) / descriptors.length)
    onSave({ samples: captures, descriptors, embedding, capturedAt: new Date().toISOString(), liveness: { checked: true, method: 'multi-angle-face-descriptor' } })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal face-modal"><div className="modal-head"><div><div className="eyebrow">Identidad biométrica</div><h2>Registrar rostro</h2><p>{employee.name} · el sistema generará su descriptor facial</p></div><button className="close-button" onClick={onClose}><X size={18} /></button></div><div className="face-progress">{captureSteps.map((step, index) => <div className={`face-step ${index < captures.length ? 'done' : ''} ${index === currentStep && !complete ? 'current' : ''}`} key={step.label}><div>{index < captures.length ? <Check size={14} /> : index + 1}</div><span>{step.label}</span></div>)}</div><div className="face-camera-area">{camera ? <video ref={videoRef} autoPlay muted playsInline className="face-video" /> : <div className="face-camera-empty"><ScanFace size={37} /><strong>Prepara la cámara</strong><span>El sistema generará un descriptor único para este empleado.</span><button className="secondary-button" onClick={activateCamera}><Camera size={16} /> Activar cámara</button></div>}{camera && modelLoading && <div className="face-model-loading"><Sparkles size={18} /> Cargando modelo facial local...</div>}{camera && modelReady && !complete && <div className="face-guide"><div className="face-guide-oval" /><span>{captureSteps[currentStep].label}</span><small>{captureSteps[currentStep].hint}</small></div>}{complete && <div className="face-complete"><div><Check size={21} /></div><strong>Descriptor facial listo</strong><span>Las tres muestras se asociarán a {employee.name}.</span></div>}<div className="face-corners"><i /><i /><i /><i /></div></div><canvas ref={canvasRef} className="hidden-canvas" />{error && <div className="face-error"><X size={14} />{error}</div>}<div className="face-capture-foot"><div><ShieldCheck size={16} /><span>El rostro se guarda como muestras y descriptor local.</span></div>{captures.length > 0 && <button className="text-button" onClick={resetCapture}><RotateCcw size={14} /> Repetir capturas</button>}</div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button>{!camera ? <button className="primary-button" onClick={activateCamera}><Camera size={16} /> Activar cámara</button> : complete ? <button className="primary-button" onClick={save}><Check size={16} /> Guardar descriptor</button> : <button className="primary-button" disabled={!modelReady || modelLoading} onClick={captureSample}><ScanFace size={16} /> Capturar posición {captures.length + 1} de 3</button>}</div></div></div>
}

export function AutomaticKiosk({ employees, punches, faceRecords, onBack, onPunch }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const busyRef = useRef(false)
  const punchedRef = useRef(false)
  const [camera, setCamera] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('Activa la cámara para iniciar')
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())
  const registeredEmployees = useMemo(() => employees.filter((employee) => faceRecords[employee.id]?.descriptors?.length >= 1 || faceRecords[employee.id]?.embedding), [employees, faceRecords])

  useEffect(() => { const interval = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(interval) }, [])
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])
  useEffect(() => { if (camera && streamRef.current && videoRef.current) videoRef.current.srcObject = streamRef.current }, [camera])

  const activateCamera = async () => {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no expone una cámara.')
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      setCamera(true)
      setModelLoading(true)
      setStatus('Cargando modelo facial local...')
      await loadFaceModels()
      setModelReady(true)
      setStatus('Buscando tu rostro...')
    } catch (cameraError) {
      setError(cameraError?.message?.includes('cámara') ? cameraError.message : 'No pudimos cargar el modelo facial o acceder a la cámara.')
      setStatus('No se pudo iniciar el reconocimiento')
    } finally {
      setModelLoading(false)
    }
  }

  useEffect(() => {
    if (!camera || !modelReady || result || registeredEmployees.length === 0) return undefined
    let active = true
    const inspect = async () => {
      if (!active || busyRef.current || punchedRef.current || !videoRef.current || videoRef.current.readyState < 2) return
      busyRef.current = true
      try {
        const descriptor = await extractFaceDescriptor(videoRef.current)
        if (!descriptor) {
          setStatus('Buscando un rostro...')
        } else {
          const match = findBestFaceMatch(descriptor, registeredEmployees, faceRecords)
          if (!match) {
            setStatus('Rostro no reconocido')
          } else if (active) {
            punchedRef.current = true
            setScanning(true)
            setStatus(`Identidad confirmada · ${Math.round((1 - match.distance) * 100)}%`)
            const punch = onPunch(match.employee)
            setResult({ type: punch.type, time: punch.time, employee: match.employee, confidence: match.distance })
            setScanning(false)
          }
        }
      } catch {
        if (active) setStatus('Ajusta la iluminación y vuelve a mirar a la cámara')
      } finally {
        busyRef.current = false
      }
    }
    inspect()
    const interval = setInterval(inspect, 1200)
    return () => { active = false; clearInterval(interval) }
  }, [camera, modelReady, result, registeredEmployees, faceRecords, onPunch])

  const resetScan = () => { punchedRef.current = false; setResult(null); setScanning(false); setStatus('Buscando tu rostro...') }

  return <div className="kiosk-shell"><header className="kiosk-topbar"><div className="brand"><div className="brand-mark"><Fingerprint size={19} /></div><span>marcador<span className="brand-dot">.</span></span></div><div className="kiosk-status"><i className="live-dot" /> Sistema operativo <span>•</span> {now.toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' })}</div><button className="kiosk-admin-button" onClick={onBack}><LayoutDashboard size={16} /> Panel administrador</button></header><main className="kiosk-main"><div className="kiosk-intro"><div className="eyebrow">Control de asistencia</div><h1>Marca tu asistencia<br /><em>en segundos.</em></h1><p>Colócate frente a la cámara. El sistema te identificará automáticamente.</p><div className="kiosk-time">{now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}<span>{now.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div><div className="privacy-note"><ShieldCheck size={17} /><span>Tu información biométrica está protegida y se utiliza únicamente para validar tu asistencia.</span></div></div><div className={`camera-card ${scanning ? 'is-scanning' : ''} ${result ? 'has-result' : ''}`}><div className="camera-frame">{camera && <video ref={videoRef} autoPlay muted playsInline />}{!camera && <div className="camera-placeholder"><div className="camera-placeholder-glow" /><ScanFace size={40} /><span>Cámara lista para reconocimiento automático</span></div>}{scanning && <div className="scan-overlay"><div className="scan-line" /><div className="scan-copy"><Sparkles size={19} /> Coincidencia encontrada...</div></div>}{result && <div className="result-overlay"><div className="result-check"><Check size={27} /></div><span>Identidad confirmada</span><strong>{result.employee.name}</strong><small>{result.type === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada · {result.time}</small></div>}<div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" /></div><div className="camera-controls">{!camera ? <button className="primary-button wide" onClick={activateCamera}><Camera size={17} /> Activar reconocimiento</button> : registeredEmployees.length === 0 ? <div className="kiosk-empty"><ScanFace size={18} /><span>Registra nuevamente los rostros para generar descriptores.</span><button className="text-button" onClick={onBack}>Ir a registrar rostros</button></div> : <div className={`automatic-status ${result ? 'success' : ''}`}><ScanFace size={18} /><span>{modelLoading ? 'Cargando modelo facial...' : status}</span>{result && <button className="text-button reset-button" onClick={resetScan}>Nueva marcación</button>}</div>}</div><div className="camera-foot"><span><i className="green-pulse" /> Reconocimiento automático activo</span><span><ShieldCheck size={14} /> Sin selector manual</span></div></div></main><footer className="kiosk-footer"><span><BriefcaseBusiness size={15} /> Acánets · Sistema de control interno</span><span>¿Necesitas ayuda? <strong>Contacta a RR. HH.</strong></span></footer></div>
}
