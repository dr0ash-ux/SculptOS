import { useEffect, useRef, useState } from 'react'
import { Enums, RenderingEngine, init as cornerstoneInit } from '@cornerstonejs/core'
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader'
import { getStudyBundle, getStudies, getWadoRsImageId, uploadDicomFile, type OrthancSeries, type OrthancStudy } from './services/orthanc'
import './imaging-workspace.css'

type SeriesWithInstances = OrthancSeries & {
  instances: Array<{ ID: string; MainDicomTags?: Record<string, string> }>
  parentStudyTags?: Record<string, string>
}

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

function tag(tags: Record<string, string> | undefined, key: string, fallback = '—') {
  return tags?.[key] || fallback
}

function DicomViewport({ series }: { series: SeriesWithInstances }) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<RenderingEngine | null>(null)
  const [status, setStatus] = useState('Preparing viewport…')

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
        const imageIds = series.instances
          .map((instance) => tag(instance.MainDicomTags, 'SOPInstanceUID', ''))
          .filter(Boolean)
          .map((sopUID) => getWadoRsImageId(studyUID, seriesUID, sopUID))

        if (!studyUID || !seriesUID || !imageIds.length) throw new Error('This series has no complete DICOM UIDs.')

        const engine = new RenderingEngine(engineId)
        engineRef.current = engine
        engine.enableElement({ viewportId, element: elementRef.current, type: Enums.ViewportType.STACK })
        const viewport = engine.getViewport(viewportId)
        await viewport.setStack(imageIds, Math.floor(imageIds.length / 2))
        viewport.render()
        if (!disposed) setStatus(`${imageIds.length} images · WADO-RS`)
      } catch (error) {
        if (!disposed) setStatus(error instanceof Error ? error.message : 'Unable to load this series.')
      }
    }

    void run()
    return () => {
      disposed = true
      engineRef.current?.destroy()
      engineRef.current = null
    }
  }, [series])

  return <div className="dicom-viewport-shell"><div ref={elementRef} className="dicom-viewport" /><div className="dicom-viewport-status">{status}</div></div>
}

export default function ImagingWorkspace() {
  const [studies, setStudies] = useState<OrthancStudy[]>([])
  const [selectedStudy, setSelectedStudy] = useState<OrthancStudy | null>(null)
  const [series, setSeries] = useState<SeriesWithInstances[]>([])
  const [selectedSeries, setSelectedSeries] = useState<SeriesWithInstances | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await getStudies()
      setStudies(result)
      setOnline(true)
      if (selectedStudy) setSelectedStudy(result.find((study) => study.ID === selectedStudy.ID) || null)
    } catch (error) {
      setOnline(false)
      setMessage(error instanceof Error ? error.message : 'Orthanc is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const selectStudy = async (study: OrthancStudy) => {
    setSelectedStudy(study)
    setSelectedSeries(null)
    setSeries([])
    setLoading(true)
    try {
      const bundle = await getStudyBundle(study.ID)
      setSeries(bundle.series.map((item) => ({ ...item, parentStudyTags: study.MainDicomTags })))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read study series.')
    } finally {
      setLoading(false)
    }
  }

  const upload = async (file?: File) => {
    if (!file) return
    setLoading(true)
    setMessage('Uploading DICOM…')
    try {
      const result = await uploadDicomFile(file)
      setMessage(`DICOM imported into Orthanc (${result.ID}).`)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'DICOM upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="imaging-workspace">
    <section className="page-heading imaging-heading"><div><p className="eyebrow">IMAGING WORKSPACE</p><h1>CBCT / DICOM</h1><p className="subheading">Orthanc is the imaging store; Cornerstone3D renders the selected DICOM series through DICOMweb.</p></div><div className="heading-actions"><span className={`orthanc-status ${online ? 'online' : online === false ? 'offline' : ''}`}><i />{online ? 'Orthanc online' : online === false ? 'Orthanc offline' : 'Checking Orthanc'}</span><label className="primary-button imaging-upload">Import DICOM<input type="file" accept=".dcm,application/dicom" onChange={(e) => void upload(e.target.files?.[0])} /></label><button className="secondary-button" onClick={() => void refresh()} disabled={loading}>Refresh</button></div></section>
    {message && <div className="imaging-message">{message}</div>}
    <div className="imaging-layout">
      <aside className="panel study-browser"><div className="panel-header"><div><p className="eyebrow">ORTHANC</p><h2>Studies</h2></div><span>{studies.length}</span></div>{studies.length ? <div className="study-list">{studies.map((study) => <button className={`study-item ${selectedStudy?.ID === study.ID ? 'active' : ''}`} key={study.ID} onClick={() => void selectStudy(study)}><strong>{tag(study.MainDicomTags, 'PatientName')}</strong><span>{tag(study.MainDicomTags, 'StudyDescription', 'DICOM study')}</span><small>{tag(study.MainDicomTags, 'StudyDate')} · {tag(study.MainDicomTags, 'Modality')}</small></button>)}</div> : <div className="imaging-empty">{online === false ? 'Start Orthanc to load studies.' : 'No DICOM studies yet. Import a .dcm file to begin.'}</div>}</aside>
      <section className="panel series-browser"><div className="panel-header"><div><p className="eyebrow">SERIES</p><h2>{selectedStudy ? tag(selectedStudy.MainDicomTags, 'StudyDescription', 'Selected study') : 'Select a study'}</h2></div></div>{series.length ? <div className="series-list">{series.map((item) => <button className={`series-item ${selectedSeries?.ID === item.ID ? 'active' : ''}`} key={item.ID} onClick={() => setSelectedSeries(item)}><div><strong>{tag(item.MainDicomTags, 'SeriesDescription', 'Unnamed series')}</strong><span>{tag(item.MainDicomTags, 'Modality')} · {item.instances.length} instances</span></div><span>›</span></button>)}</div> : <div className="imaging-empty">{selectedStudy ? 'No series found in this study.' : 'Choose a study from the left.'}</div>}</section>
      <section className="panel viewer-panel"><div className="panel-header"><div><p className="eyebrow">CORNERSTONE3D</p><h2>{selectedSeries ? tag(selectedSeries.MainDicomTags, 'SeriesDescription', 'DICOM viewer') : 'DICOM viewer'}</h2></div><span className="viewer-badge">WADO-RS</span></div>{selectedSeries ? <DicomViewport series={selectedSeries} /> : <div className="viewer-empty"><div className="viewer-empty-mark">CT</div><strong>Select a series to open it</strong><span>Images will be decoded in the browser by Cornerstone3D.</span></div>}</section>
    </div>
  </div>
}
