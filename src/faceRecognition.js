import * as faceapi from '@vladmandic/face-api'

const MODEL_URL = '/models'
const MATCH_THRESHOLD = 0.5
let modelsPromise

export function loadFaceModels() {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
  }
  return modelsPromise
}

export async function extractFaceDescriptor(input) {
  await loadFaceModels()
  const result = await faceapi.detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor()
  return result?.descriptor ? Array.from(result.descriptor) : null
}

export function findBestFaceMatch(descriptor, employees, faceRecords) {
  if (!descriptor) return null
  const current = new Float32Array(descriptor)
  let best = null
  employees.forEach((employee) => {
    const record = faceRecords[employee.id]
    const descriptors = record?.descriptors || (record?.embedding ? [record.embedding] : [])
    descriptors.forEach((storedDescriptor) => {
      const distance = faceapi.euclideanDistance(current, new Float32Array(storedDescriptor))
      if (!best || distance < best.distance) best = { employee, distance }
    })
  })
  return best && best.distance <= MATCH_THRESHOLD ? best : null
}
