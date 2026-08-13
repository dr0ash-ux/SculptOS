const ORTHANC_BASE_URL = import.meta.env.VITE_ORTHANC_URL || 'http://localhost:8042'

export type OrthancStudy = {
  ID: string
  MainDicomTags?: Record<string, string>
  Series?: string[]
  ParentPatient?: string
}

async function orthancFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${ORTHANC_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Orthanc request failed (${response.status}): ${body || response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function checkOrthanc(): Promise<boolean> {
  try {
    await orthancFetch('/system')
    return true
  } catch {
    return false
  }
}

export async function uploadDicomFile(file: File): Promise<{ ID: string }> {
  const response = await fetch(`${ORTHANC_BASE_URL}/instances`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/dicom',
    },
    body: await file.arrayBuffer(),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`DICOM upload failed (${response.status}): ${body || response.statusText}`)
  }

  return response.json() as Promise<{ ID: string }>
}

export async function getStudies(): Promise<OrthancStudy[]> {
  const ids = await orthancFetch<string[]>('/studies')
  return Promise.all(ids.map((id) => orthancFetch<OrthancStudy>(`/studies/${id}`)))
}

export function getDicomWebRoot() {
  return `${ORTHANC_BASE_URL}/dicom-web/`
}
