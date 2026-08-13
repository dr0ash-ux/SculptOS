import { useState } from 'react'
import './App.css'

type NavItem = {
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Patients', icon: 'users' },
  { label: 'Imaging', icon: 'scan' },
  { label: 'Planning', icon: 'layers' },
  { label: 'Reports', icon: 'file' },
]

const recentPatients = [
  { initials: 'AR', name: 'Aarav Rao', id: 'SC-1024', procedure: 'Orthognathic planning', status: 'Planning', updated: 'Today, 10:42' },
  { initials: 'MS', name: 'Meera Shah', id: 'SC-1023', procedure: 'Aligner planning', status: 'Review', updated: 'Today, 09:18' },
  { initials: 'VK', name: 'Vikram Kumar', id: 'SC-1022', procedure: 'CBCT analysis', status: 'Imaging', updated: 'Yesterday' },
  { initials: 'NP', name: 'Nisha Patel', id: 'SC-1021', procedure: 'Surgical simulation', status: 'Ready', updated: 'Yesterday' },
]

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    scan: 'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 8h10v8H7z',
    layers: 'm12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
    plus: 'M12 5v14M5 12h14',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    search: 'm21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    chevron: 'm9 18 6-6-6-6',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d={paths[name]} />
    </svg>
  )
}

function App() {
  const [active, setActive] = useState('Overview')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SculptOS</strong>
            <span>Clinical workspace</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => setActive(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item">
            <Icon name="file" />
            <span>Settings</span>
          </button>
          <div className="user-card">
            <div className="avatar">AJ</div>
            <div className="user-copy">
              <strong>Dr. Aishwarya Jain</strong>
              <span>Maxillofacial Surgery</span>
            </div>
            <Icon name="chevron" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search"><Icon name="search" /></button>
            <button className="icon-button notification" aria-label="Notifications"><Icon name="bell" /><span /></button>
            <div className="mini-avatar">AJ</div>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">THURSDAY, 13 AUGUST 2026</p>
              <h1>Good afternoon, Dr. Jain.</h1>
              <p className="subheading">Your surgical planning workspace is ready.</p>
            </div>
            <button className="primary-button">
              <Icon name="plus" />
              New patient
            </button>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <span>Active patients</span>
              <strong>24</strong>
              <small><b>+3</b> this month</small>
            </article>
            <article className="stat-card">
              <span>Plans in progress</span>
              <strong>8</strong>
              <small><b>3</b> need review</small>
            </article>
            <article className="stat-card">
              <span>Imaging studies</span>
              <strong>42</strong>
              <small><b>6</b> uploaded this week</small>
            </article>
            <article className="stat-card accent-card">
              <span>Ready for simulation</span>
              <strong>5</strong>
              <small>Cases with complete datasets</small>
            </article>
          </section>

          <section className="workspace-grid">
            <article className="panel patients-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">PATIENT WORKSPACE</p>
                  <h2>Recent patients</h2>
                </div>
                <button className="text-button">View all <Icon name="arrow" /></button>
              </div>

              <div className="patient-list">
                {recentPatients.map((patient) => (
                  <button className="patient-row" key={patient.id}>
                    <div className="patient-avatar">{patient.initials}</div>
                    <div className="patient-main">
                      <strong>{patient.name}</strong>
                      <span>{patient.id} · {patient.procedure}</span>
                    </div>
                    <span className={`status status-${patient.status.toLowerCase()}`}>{patient.status}</span>
                    <span className="patient-date">{patient.updated}</span>
                    <Icon name="chevron" />
                  </button>
                ))}
              </div>
            </article>

            <article className="panel quick-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">QUICK ACTIONS</p>
                  <h2>Start a workflow</h2>
                </div>
              </div>
              <div className="quick-actions">
                <button><span className="action-icon"><Icon name="users" /></span><span><strong>Add patient</strong><small>Create a new clinical record</small></span><Icon name="chevron" /></button>
                <button><span className="action-icon"><Icon name="scan" /></span><span><strong>Open imaging</strong><small>Review a DICOM study</small></span><Icon name="chevron" /></button>
                <button><span className="action-icon"><Icon name="layers" /></span><span><strong>New treatment plan</strong><small>Begin a 3D planning workflow</small></span><Icon name="chevron" /></button>
              </div>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel timeline-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">TODAY</p>
                  <h2>Clinical activity</h2>
                </div>
              </div>
              <div className="timeline">
                <div><span className="timeline-dot" /><div><strong>CBCT imported</strong><p>Vikram Kumar · 09:42</p></div></div>
                <div><span className="timeline-dot" /><div><strong>Plan marked ready</strong><p>Nisha Patel · 08:56</p></div></div>
                <div><span className="timeline-dot" /><div><strong>Patient record created</strong><p>Aarav Rao · 08:21</p></div></div>
              </div>
            </article>
            <article className="panel readiness-panel">
              <div className="readiness-copy">
                <p className="eyebrow">DATA READINESS</p>
                <h2>Build the complete patient dataset</h2>
                <p>Combine CBCT/DICOM, intraoral scans and treatment records in one planning workspace.</p>
                <button className="secondary-button">Explore imaging <Icon name="arrow" /></button>
              </div>
              <div className="readiness-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core">3D</div></div>
            </article>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
