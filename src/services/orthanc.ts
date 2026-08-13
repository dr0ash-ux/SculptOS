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

function resourceId(value: string | { ID?: string }): string {
  const id = typeof value === 'string' ? value : value?.ID
  if (!id) throw new Error('Orthanc returned a resource without an ID.')
  return id
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
  const ids = await orthancFetch<Array<string | { ID?: string }>>('/studies')
  return Promise.all(ids.map((value) => orthancFetch<OrthancStudy>(`/studies/${encodeURIComponent(resourceId(value))}`)))
}

export async function getSeries(studyId: string): Promise<OrthancSeries[]> {
  const values = await orthancFetch<Array<string | { ID?: string }>>(`/studies/${encodeURIComponent(studyId)}/series`)
  return Promise.all(values.map((value) => orthancFetch<OrthancSeries>(`/series/${encodeURIComponent(resourceId(value))}`)))
}

export async function getInstances(seriesId: string): Promise<OrthancInstance[]> {
  const values = await orthancFetch<Array<string | { ID?: string }>>(`/series/${encodeURIComponent(seriesId)}/instances`)
  return Promise.all(values.map((value) => orthancFetch<OrthancInstance>(`/instances/${encodeURIComponent(resourceId(value))}`)))
}

export async function getStudyBundle(studyId: string) {
  const study = await orthancFetch<OrthancStudy>(`/studies/${encodeURIComponent(studyId)}`)
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
