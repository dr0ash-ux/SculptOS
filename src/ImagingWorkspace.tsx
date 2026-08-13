import { useEffect, useRef, useState } from 'react'
import { Enums, RenderingEngine, init as cornerstoneInit, type IStackViewport } from '@cornerstonejs/core'
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader'
import { getStudyBundle, getStudies, getWadoRsImageId, uploadDicomFile, type OrthancStudy, type OrthancSeries } from './services/orthanc'
import './imaging-workspace.css'

type SeriesWithInstances = OrthancSeries & {
  instances: Array<{ ID: string; MainDicomTags?: Record<string, string> }>
  parentStudyTags?: Record<string, string>
}

type ImportItem = { id: string; file: File; status: 'queued' | 'uploading' | 'done' | 'error'; error?: string }

let cornerstoneReady: Promise<void> | null = null
function initCornerstone() {
  if (!cornerstoneReady) {
    cornerstoneReady = (async () => {
      await cornerstoneInit()
      await dicomImageLoaderInit({ maxWebWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) })
    })()
  }
  return cornerstoneReady
}

function tag(tags: Record<string, string> | undefined, key: string, fallback = '—') { return tags?.[key] || fallback }

function DicomViewport({ series }: { series: SeriesWithInstances }) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<RenderingEngine | null>(null)
  const [status, setStatus] = useState('Preparing viewer…')

  useEffect(() => {
    let disposed = false
    const engineId = `sculptos-engine-${Date.now()}`
    const viewportId = `sculptos-stack-${Date.now()}`
    const run = async () => {
      try {
        await initCornerstone()
        if (disposed || !elementRef.current) return
        const studyUID = tag(series.parentStudyTags, 'StudyInstanceUID', '')
        const seriesUID = tag(series.MainDicomTags, 'SeriesInstanceUID', '')
        const imageIds = series.instances.map((instance) => tag(instance.MainDicomTags, 'SOPInstanceUID', '')).filter(Boolean).map((sopUID) => getWadoRsImageId(studyUID, seriesUID, sopUID))
        if (!studyUID || !seriesUID || !imageIds.length) throw new Error('This series has no complete DICOM UIDs.')
        const engine = new RenderingEngine(engineId)
        engineRef.current = engine
        engine.enableElement({ viewportId, element: elementRef.current, type: Enums.ViewportType.STACK })
        const viewport = engine.getViewport<IStackViewport>(viewportId)
        await viewport.setStack(imageIds, Math.floor(imageIds.length / 2))
        viewport.render()
        if (!disposed) setStatus(`${imageIds.length} images · WADO-RS`)
      } catch (error) { if (!disposed) setStatus(error instanceof Error ? error.message : 'Unable to load this series.') }
    }
    void run()
    return () => { disposed = true; engineRef.current?.destroy(); engineRef.current = null }
  }, [series])

  return <div className="dicom-viewport-shell"><div ref={elementRef} className="dicom-viewport" /><div className="dicom-viewport-status">{status}</div></div>
}

export default function ImagingWorkspace() {
  const [screen, setScreen] = useState<'import' | 'viewer'>('import')
  const [, setStudies] = useState<OrthancStudy[]>([])
  const [selectedStudy, setSelectedStudy] = useState<OrthancStudy | null>(null)
  const [series, setSeries] = useState<SeriesWithInstances[]>([])
  const [selectedSeries, setSelectedSeries] = useState<SeriesWithInstances | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [importQueue, setImportQueue] = useState<ImportItem[]>([])
  const [importing, setImporting] = useState(false)
  const multiFileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { folderInputRef.current?.setAttribute('webkitdirectory', ''); folderInputRef.current?.setAttribute('directory', '') }, [])

  const refresh = async () => {
    setLoading(true)
    try { const result = await getStudies(); setStudies(result); setOnline(true) } catch (error) { setOnline(false); setMessage(error instanceof Error ? error.message : 'Orthanc is unavailable.') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  const addFilesToQueue = (fileList: FileList | null) => {
    if (!fileList?.length) return
    const incoming = Array.from(fileList).filter((file) => file.size > 0)
    setImportQueue((current) => {
      const existing = new Set(current.map((item) => `${item.file.name}|${item.file.size}|${item.file.lastModified}`))
      return [...current, ...incoming.filter((file) => !existing.has(`${file.name}|${file.size}|${file.lastModified}`)).map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, status: 'queued' as const }))]
    })
  }

  const clearQueue = () => { if (!importing) setImportQueue([]) }

  const importAll = async () => {
    if (importing) return
    const pending = importQueue.filter((item) => item.status === 'queued' || item.status === 'error')
    if (!pending.length) return
    setImporting(true); setMessage('')
    let completed = 0; let failed = 0
    for (const item of pending) {
      setImportQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry))
      try { await uploadDicomFile(item.file); completed++; setImportQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'done' } : entry)) }
      catch (error) { failed++; setImportQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } : entry)) }
    }
    setImporting(false)
    setMessage(failed ? `Uploaded ${completed} file${completed === 1 ? '' : 's'}; ${failed} failed.` : `${completed} DICOM file${completed === 1 ? '' : 's'} uploaded.`)
    await refresh()
  }

  const openViewer = async () => {
    setLoading(true); setMessage('')
    try {
      const result = await getStudies()
      setStudies(result)
      if (!result.length) throw new Error('No DICOM study is available to view yet.')
      const latest = result[result.length - 1]
      const bundle = await getStudyBundle(latest.ID)
      const populated = bundle.series.map((item) => ({ ...item, parentStudyTags: latest.MainDicomTags })) as SeriesWithInstances[]
      setSelectedStudy(latest); setSeries(populated); setSelectedSeries(populated[0] || null); setScreen('viewer')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open the DICOM viewer.') } finally { setLoading(false) }
  }

  if (screen === 'viewer') return <div className="imaging-workspace imaging-viewer-page">
    <section className="imaging-simple-heading"><div><p className="eyebrow">IMAGING · DICOM VIEWER</p><h1>{tag(selectedStudy?.MainDicomTags, 'StudyDescription', 'DICOM study')}</h1><p>{tag(selectedStudy?.MainDicomTags, 'PatientName', 'Patient')} · {tag(selectedStudy?.MainDicomTags, 'StudyDate')}</p></div><button className="secondary-button" onClick={() => setScreen('import')}>← Back to Imaging</button></section>
    {message && <div className="imaging-message">{message}</div>}
    <div className="dicom-viewer-layout">
      <aside className="panel series-browser"><div className="panel-header"><div><p className="eyebrow">SERIES</p><h2>{series.length} series</h2></div></div>{series.length ? <div className="series-list">{series.map((item) => <button className={`series-item ${selectedSeries?.ID === item.ID ? 'active' : ''}`} key={item.ID} onClick={() => setSelectedSeries(item)}><div><strong>{tag(item.MainDicomTags, 'SeriesDescription', 'Unnamed series')}</strong><span>{tag(item.MainDicomTags, 'Modality')} · {item.instances.length} images</span></div><span>›</span></button>)}</div> : <div className="imaging-empty">No series found.</div>}</aside>
      <section className="panel viewer-panel"><div className="panel-header"><div><p className="eyebrow">CORNERSTONE3D</p><h2>{selectedSeries ? tag(selectedSeries.MainDicomTags, 'SeriesDescription', 'DICOM viewer') : 'DICOM viewer'}</h2></div><span className="viewer-badge">WADO-RS</span></div>{selectedSeries ? <DicomViewport series={selectedSeries} /> : <div className="viewer-empty"><div className="viewer-empty-mark">CT</div><strong>Select a series to open it</strong><span>Images will be decoded in the browser by Cornerstone3D.</span></div>}</section>
    </div>
  </div>

  const uploadedCount = importQueue.filter((item) => item.status === 'done').length
  const selectedCount = importQueue.length
  return <div className="imaging-workspace imaging-import-page">
    <section className="imaging-simple-heading"><div><p className="eyebrow">IMAGING</p><h1>DICOM / CBCT</h1><p>Import a DICOM study, then open it in the dedicated viewer.</p></div><span className={`orthanc-status ${online ? 'online' : online === false ? 'offline' : ''}`}><i />{online ? 'Orthanc online' : online === false ? 'Orthanc offline' : 'Checking Orthanc'}</span></section>
    {message && <div className="imaging-message">{message}</div>}
    <section className="panel imaging-import-card"><div className="import-card-icon">DICOM</div><h2>Upload files</h2><p>Import individual DICOM files or an entire CBCT folder.</p><div className="import-choice-row"><button className="primary-button" onClick={() => multiFileInputRef.current?.click()} disabled={importing}>Import files</button><button className="secondary-button" onClick={() => folderInputRef.current?.click()} disabled={importing}>Import folder</button></div><input ref={multiFileInputRef} className="imaging-hidden-input" type="file" multiple accept=".dcm,application/dicom" onChange={(e) => { addFilesToQueue(e.target.files); e.currentTarget.value = '' }} /><input ref={folderInputRef} className="imaging-hidden-input" type="file" multiple accept=".dcm,application/dicom" onChange={(e) => { addFilesToQueue(e.target.files); e.currentTarget.value = '' }} /></section>
    {selectedCount > 0 && <section className="panel upload-summary-card"><div><p className="eyebrow">IMPORT</p><h2>{selectedCount} files selected</h2><p>{uploadedCount ? `${uploadedCount} files uploaded to Orthanc.` : 'Ready to upload to Orthanc.'}</p></div><div className="upload-summary-actions"><button className="secondary-button" onClick={clearQueue} disabled={importing}>Clear</button><button className="primary-button" onClick={() => void importAll()} disabled={importing || !importQueue.some((item) => item.status === 'queued' || item.status === 'error')}>{importing ? 'Uploading…' : 'Upload to Orthanc'}</button></div></section>}
    {uploadedCount > 0 && uploadedCount === selectedCount && <section className="panel uploaded-result-card"><div><p className="eyebrow">READY</p><h2>{uploadedCount} files uploaded</h2><p>The study is ready to open in the DICOM viewer.</p></div><button className="primary-button view-button" onClick={() => void openViewer()} disabled={loading}>{loading ? 'Opening…' : 'VIEW'}</button></section>}
    {selectedCount > 0 && <section className="upload-manage-row"><span>{selectedCount} files in import queue</span><button className="text-button" onClick={() => setImportQueue([])} disabled={importing}>Clear selection</button></section>}
  </div>
}
