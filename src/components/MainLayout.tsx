import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../assets/MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  activeMenu: string;
}

interface SubMenu {
  id: string;
  label: string;
  mode: 'cover' | 'daftar-isi' | 'berita-acara' | 'boq' | `evidence${number}` | 'opm' | 'mancore' | 'kml' | 'compress'; // dibaca oleh halaman lewat ?mode=...
  href: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  href?: string;         // menu biasa
  children?: SubMenu[];  // menu dropdown
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

const menus: MenuItem[] = [
  { id: 'welcome', label: 'Welcome', href: '/welcome', icon: 'images/mdi-home-variant1.svg' },
  {
    id: 'lact-builder',
    label: 'Tools LACT',
    icon: 'images/audit.png',
    children: [
      { id: 'lact-cover', label: 'Cover', mode: 'cover', href: '/lact?mode=cover' },
      { id: 'lact-daftar-isi', label: 'Daftar Isi', mode: 'daftar-isi', href: '/lact?mode=daftar-isi' },
      { id: 'lact-berita-acara', label: 'Laporan Commisioning Test', mode: 'berita-acara', href: '/lact?mode=berita-acara' },
      { id: 'lact-boq', label: 'BOQ', mode: 'boq', href: '/lact?mode=boq' },
      // 10 fitur INDEPENDEN: masing-masing punya daftar foto & keterangan sendiri,
      // tidak saling berbagi data walau tampilan/caranya sama persis.
      // Evidence 4 menggantikan "Upload Sekaligus" versi lama (nama diganti saja).
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `lact-evidence-${i + 1}`,
        label: `Lampiran Evidence ${i + 1}`,
        mode: `evidence${i + 1}` as SubMenu['mode'],
        href: `/lact?mode=evidence${i + 1}`,
      })),
      // Halaman tersendiri (header + judul + tabel info proyek + satu gambar
      // data pengukuran OPM + blok tanda tangan), polanya sama seperti BOQ.
      // Lihat OpmForm.tsx / OpmPage.tsx, dirutekan dari Lact.tsx (mode 'opm').
      { id: 'lact-opm', label: 'Data Pengukuran OPM', mode: 'opm', href: '/lact?mode=opm' },
      // Halaman tersendiri juga, polanya sama seperti BOQ & Data Pengukuran
      // OPM. Lihat MancoreForm.tsx / MancorePage.tsx, dirutekan dari Lact.tsx
      // (mode 'mancore').
      { id: 'lact-mancore', label: 'Lampiran Mancore', mode: 'mancore', href: '/lact?mode=mancore' },
      // Halaman tersendiri juga, polanya sama seperti BOQ/OPM/Mancore,
      // hanya saja TANPA blok tanda tangan (lihat catatan di KmlPage.tsx).
      // Lihat KmlForm.tsx / KmlPage.tsx, dirutekan dari Lact.tsx (mode 'kml').
      { id: 'lact-kml', label: 'Lampiran KML', mode: 'kml', href: '/lact?mode=kml' },
      { id: 'lact-compress', label: 'Kompres Foto', mode: 'compress', href: '/lact?mode=compress' },
    ],
  },
  {
    id: 'baut-builder',
    label: 'Tools BAUT',
    icon: 'images/audit.png',
    children: [
      { id: 'baut-cover', label: 'Cover', mode: 'cover', href: '/baut?mode=cover' },
      { id: 'baut-daftar-isi', label: 'Daftar Isi', mode: 'daftar-isi', href: '/baut?mode=daftar-isi' },
      { id: 'baut-berita-acara', label: 'Berita Acara Uji Terima', mode: 'berita-acara', href: '/baut?mode=berita-acara' },
      { id: 'baut-boq', label: 'BOQ', mode: 'boq', href: '/baut?mode=boq' },
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `baut-evidence-${i + 1}`,
        label: `Lampiran Evidence ${i + 1}`,
        mode: `evidence${i + 1}` as SubMenu['mode'],
        href: `/baut?mode=evidence${i + 1}`,
      })),
      // Sama seperti di Tools LACT: halaman tersendiri, lihat OpmForm.tsx.
      { id: 'baut-opm', label: 'Data Pengukuran OPM', mode: 'opm', href: '/baut?mode=opm' },
      // Sama seperti di Tools LACT: halaman tersendiri, lihat MancoreForm.tsx.
      { id: 'baut-mancore', label: 'Lampiran Mancore', mode: 'mancore', href: '/baut?mode=mancore' },
      // Sama seperti di Tools LACT: halaman tersendiri, lihat KmlForm.tsx.
      { id: 'baut-kml', label: 'Lampiran KML', mode: 'kml', href: '/baut?mode=kml' },
      { id: 'baut-compress', label: 'Kompres Foto', mode: 'compress', href: '/baut?mode=compress' },
    ],
  },
];

export default function MainLayout({ children, pageTitle, activeMenu }: MainLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentMode = searchParams.get('mode') ?? 'evidence1';
  const current = menus.find((m) => m.id === activeMenu);

  // Dropdown yang terbuka: otomatis membuka menu dari halaman yang sedang aktif
  const [openId, setOpenId] = useState<string | null>(activeMenu);
  useEffect(() => {
    setOpenId(activeMenu);
  }, [activeMenu]);

  return (
    <div className="layout-wrapper">
      <header className="layout-header">
        <div className="header-brand">
          <img src={asset('images/logo-TA.svg')} alt="Telkom Akses" className="header-logo" />
        </div>
        <div className="header-status-area">
          <div className="profile-badge">LACT</div>
        </div>
      </header>

      <div className="layout-body">
        <img className="body-bg-map" src={asset('images/peta-dunia.png')} alt="Peta" />

        <aside className="layout-sidebar">
          <nav className="sidebar-nav">
            {menus.map((m) => {
              // ---------- Menu biasa (Welcome) ----------
              if (!m.children) {
                const active = activeMenu === m.id;
                return (
                  <div
                    key={m.id}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={() => m.href && navigate(m.href)}
                  >
                    <img
                      src={asset(m.icon)}
                      alt={m.label}
                      className="nav-icon"
                      style={{ filter: active ? 'brightness(0) invert(1)' : 'none' }}
                    />
                    <span className="nav-label">{m.label}</span>
                  </div>
                );
              }

              // ---------- Menu dropdown (Tools LACT / Tools BAUT) ----------
              const isOpen = openId === m.id;
              const isParentActive = activeMenu === m.id;
              return (
                <div key={m.id}>
                  <div
                    className={`nav-item ${isParentActive ? 'active-parent' : ''}`}
                    onClick={() => setOpenId(isOpen ? null : m.id)}
                  >
                    <img src={asset(m.icon)} alt={m.label} className="nav-icon" />
                    <span className="nav-label">{m.label}</span>
                    <span className={`nav-chevron ${isOpen ? 'open' : ''}`}>▾</span>
                  </div>

                  <div className={`sub-menu-container ${isOpen ? 'open' : ''}`}>
                    {m.children.map((c) => {
                      const subActive = isParentActive && currentMode === c.mode;
                      return (
                        <div
                          key={c.id}
                          className={`sub-menu-item ${subActive ? 'active' : ''}`}
                          onClick={() => navigate(c.href)}
                        >
                          {c.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="layout-content">
          {activeMenu !== 'welcome' && (
            <div className="feature-page-header">
              {current && <img src={asset(current.icon)} alt="" className="feature-page-icon" />}
              <h2 className="feature-page-title">{pageTitle}</h2>
            </div>
          )}
          <div className="feature-page-content">{children}</div>
        </main>
      </div>

      <footer className="layout-footer">
        <div className="footer-left">
          © 2026 Telkom Akses | LACT Evidence Builder | Developed by{' '}
          <span className="text-red">Kerja Praktek</span>
        </div>
        <div className="footer-center"></div>
        <div className="footer-right"></div>
      </footer>
    </div>
  );
}