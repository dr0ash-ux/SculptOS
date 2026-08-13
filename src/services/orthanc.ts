const ORTHANC_BASE_URL = import.meta.env.VITE_ORTHANC_URL || '/orthanc'

export type OrthancStudy = {
  ID: string
  MainDicomTags?: Record<string, string>
  Series?: string[]
  ParentPatient?: string
}

export type OrthancSeries = {
  ID: string
  MainDicomTags?: Record<string, string>
  Instances?: string[]
  ParentStudy?: string
}

export type OrthancInstance = {
  ID: string
  MainDicomTags?: Record<string, string>
  ParentSeries?: string
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

export async function uploadDicomFile(file: File): Promise<{ ID: string; ParentPatient?: string; ParentStudy?: string; ParentSeries?: string }> {
  const response = await fetch(`${ORTHANC_BASE_URL}/instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/dicom' },
    body: await file.arrayBuffer(),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`DICOM upload failed (${response.status}): ${body || response.statusText}`)
  }

  return response.json() as Promise<{ ID: string; ParentPatient?: string; ParentStudy?: string; ParentSeries?: string }>
}

export async function getStudies(): Promise<OrthancStudy[]> {
  const ids = await orthancFetch<string[]>('/studies')
  return Promise.all(ids.map((id) => orthancFetch<OrthancStudy>(`/studies/${id}`)))
}

export async function getSeries(studyId: string): Promise<OrthancSeries[]> {
  const ids = await orthancFetch<string[]>(`/studies/${studyId}/series`)
  return Promise.all(ids.map((id) => orthancFetch<OrthancSeries>(`/series/${id}`)))
}

export async function getInstances(seriesId: string): Promise<OrthancInstance[]> {
  const ids = await orthancFetch<string[]>(`/series/${seriesId}/instances`)
  return Promise.all(ids.map((id) => orthancFetch<OrthancInstance>(`/instances/${id}`)))
}

export async function getStudyBundle(studyId: string) {
  const study = await orthancFetch<OrthancStudy>(`/studies/${studyId}`)
  const series = await getSeries(studyId)
  const populatedSeries = await Promise.all(series.map(async (item) => ({
    ...item,
    instances: await getInstances(item.ID),
  })))
  return { study, series: populatedSeries }
}

export function getDicomWebRoot() {
  return `${ORTHANC_BASE_URL}/dicom-web/`
}

export function getWadoRsImageId(studyInstanceUID: string, seriesInstanceUID: string, sopInstanceUID: string, frame = 1) {
  return `wadors:${getDicomWebRoot()}studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(seriesInstanceUID)}/instances/${encodeURIComponent(sopInstanceUID)}/frames/${frame}`
}
