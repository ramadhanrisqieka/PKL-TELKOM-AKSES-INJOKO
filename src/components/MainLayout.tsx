import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BundleBar from './BundleBar';
import ToastContainer from './ToastContainer';
import { isSectionSaved, useBundleVersion } from '../utils/pdfBundle';
import '../assets/MainLayout.css';
import '../assets/style_Bundle.css';
import '../assets/dark-mode.css';
import '../assets/micro-interactions.css';

interface MainLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  activeMenu: string;
}

interface SubMenu {
  id: string;
  label: string;
  mode: 'cover' | 'daftar-isi' | 'berita-acara' | 'boq' | `evidence${number}` | 'opm' | 'otdr' | 'mancore' | 'kml' | 'abd' | 'nde' | 'ba-tambah-kurang' | 'ba-abd';
  href: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  children?: SubMenu[];
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

const makeEvidenceMenus = (prefix: 'lact' | 'baut'): SubMenu[] =>
  Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    const label =
      num === 1
        ? 'Lampiran Evidence Pekerjaan'
        : num === 2
        ? 'Lampiran Evidence Hasil Ukur OPM'
        : `Lampiran Evidence ${num}`;
    return {
      id: `${prefix}-evidence-${num}`,
      label,
      mode: `evidence${num}` as SubMenu['mode'],
      href: `/${prefix}?mode=evidence${num}`,
    };
  });

const isExtraEvidenceMode = (mode: string) => /^evidence([3-9]|1[0-2])$/.test(mode);

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
      ...makeEvidenceMenus('lact'),
      { id: 'lact-opm', label: 'Data Pengukuran OPM', mode: 'opm', href: '/lact?mode=opm' },
      { id: 'lact-otdr', label: 'Import OTDR', mode: 'otdr', href: '/lact?mode=otdr' },
      { id: 'lact-mancore', label: 'Lampiran Mancore', mode: 'mancore', href: '/lact?mode=mancore' },
      { id: 'lact-kml', label: 'Lampiran KML', mode: 'kml', href: '/lact?mode=kml' },
      { id: 'lact-abd', label: 'ABD', mode: 'abd', href: '/lact?mode=abd' },
    ],
  },
  {
    id: 'baut-builder',
    label: 'Tools BAUT',
    icon: 'images/audit.png',
    children: [
      { id: 'baut-cover', label: 'Cover', mode: 'cover', href: '/baut?mode=cover' },
      { id: 'baut-nde', label: 'NDE', mode: 'nde', href: '/baut?mode=nde' },
      { id: 'baut-daftar-isi', label: 'Daftar Isi', mode: 'daftar-isi', href: '/baut?mode=daftar-isi' },
      { id: 'baut-berita-acara', label: 'Berita Acara Uji Terima', mode: 'berita-acara', href: '/baut?mode=berita-acara' },
      { id: 'baut-boq', label: 'BOQ', mode: 'boq', href: '/baut?mode=boq' },
      { id: 'baut-ba-tambah-kurang', label: 'BA Tambah Kurang', mode: 'ba-tambah-kurang', href: '/baut?mode=ba-tambah-kurang' },
      ...makeEvidenceMenus('baut'),
      { id: 'baut-opm', label: 'Data Pengukuran OPM', mode: 'opm', href: '/baut?mode=opm' },
      { id: 'baut-otdr', label: 'Import OTDR', mode: 'otdr', href: '/baut?mode=otdr' },
      { id: 'baut-mancore', label: 'Lampiran Mancore', mode: 'mancore', href: '/baut?mode=mancore' },
      { id: 'baut-kml', label: 'Lampiran KML', mode: 'kml', href: '/baut?mode=kml' },
      { id: 'baut-abd', label: 'ABD', mode: 'abd', href: '/baut?mode=abd' },
      { id: 'baut-ba-abd', label: 'BA ABD', mode: 'ba-abd', href: '/baut?mode=ba-abd' },
    ],
  },
  { id: 'kompres-foto', label: 'Kompres Foto', href: '/kompres-foto', icon: 'images/icon-kompres-foto.svg' },
];

export default function MainLayout({ children, pageTitle, activeMenu }: MainLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentMode = searchParams.get('mode') ?? 'evidence1';
  const current = menus.find((m) => m.id === activeMenu);

  // ----- Paket PDF Lengkap (lihat BundleBar.tsx & utils/pdfBundle.ts) -----
  useBundleVersion();
  const builder = menus.find((m) => m.id === activeMenu && m.children);
  const bundleSections = (builder?.children ?? [])
    .map((c) => ({ id: c.id, label: c.label, mode: c.mode as string, href: c.href }));
  const contentRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // State drawer sidebar khusus tampilan mobile/Android
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Tema awal selalu 'light' kecuali pengguna pernah memilih 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('verita-theme') === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('verita-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleMainScroll = () => {
    const el = mainRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 220);
  };

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Kembalikan scroll ke atas & tutup drawer otomatis saat pindah menu/mode
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    setShowScrollTop(false);
    setMobileMenuOpen(false);
  }, [activeMenu, currentMode]);

  const [hasPreview, setHasPreview] = useState(false);
  useEffect(() => {
    const has = !!contentRef.current?.querySelector('.pdf-page');
    setHasPreview((prev) => (prev === has ? prev : has));
  });

  // Dropdown yang terbuka: otomatis membuka menu dari halaman yang sedang aktif
  const [openId, setOpenId] = useState<string | null>(activeMenu);
  useEffect(() => {
    setOpenId(activeMenu);
  }, [activeMenu]);

  // Dropdown khusus untuk Lampiran Evidence 3–12
  const [extraEvidenceOpen, setExtraEvidenceOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (isExtraEvidenceMode(currentMode)) {
      setExtraEvidenceOpen((prev) => ({ ...prev, [activeMenu]: true }));
    }
  }, [activeMenu, currentMode]);

  return (
    <div className="layout-wrapper">
      <header className="layout-header">
        <div className="header-brand">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Buka menu navigasi"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <img src={asset('images/logo-TA.svg')} alt="Telkom Akses" className="header-logo" />
        </div>
        <div className="header-status-area">
          <button
            type="button"
            className="theme-switch-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            aria-label={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          >
            <span key={theme} className="theme-switch-icon" aria-hidden="true">
              {theme === 'dark' ? '☀️' : '🌙'}
            </span>
            <span className="theme-switch-label">
              {theme === 'dark' ? 'Terang' : 'Gelap'}
            </span>
          </button>

          <div
            className="verita-header-brand"
            onClick={() => navigate('/welcome')}
            title="Verita — Evidence & Document Builder"
          >
            <img
              src={asset('verita-icon.svg')}
              alt="Verita"
              className="verita-header-icon"
            />
            <div className="verita-header-text">
              <span className="verita-wordmark">Verita</span>
              <span className="verita-tagline">Evidence &amp; Document Builder</span>
            </div>
          </div>
        </div>
      </header>

      <div className="layout-body">
        <img className="body-bg-map" src={asset('images/peta-dunia.png')} alt="Peta" />

        <div
          className={`sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        />

        <aside className={`layout-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <nav className="sidebar-nav">
            {menus.map((m) => {
              // ---------- Menu biasa (Welcome, Kompres Foto) ----------
              if (!m.children) {
                const active = activeMenu === m.id;
                return (
                  <div
                    key={m.id}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      if (m.href) navigate(m.href);
                      setMobileMenuOpen(false);
                    }}
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
                      if (isExtraEvidenceMode(c.mode) && c.mode !== 'evidence3') {
                        return null;
                      }

                      if (c.mode === 'evidence3') {
                        const extraItems = m.children!.filter((item) => isExtraEvidenceMode(item.mode));
                        const isExtraOpen = !!extraEvidenceOpen[m.id];
                        const hasSavedExtra = extraItems.some((item) => isSectionSaved(m.id, item.mode));

                        return (
                          <div key={`${m.id}-extra-evidence`}>
                            <div
                              className="sub-menu-item"
                              style={{ fontWeight: 600, opacity: 0.85 }}
                              onClick={() =>
                                setExtraEvidenceOpen((prev) => ({
                                  ...prev,
                                  [m.id]: !prev[m.id],
                                }))
                              }
                            >
                              <span>Lampiran Tambahan</span>
                              {hasSavedExtra && (
                                <span
                                  className="sub-menu-saved"
                                  title="Ada lampiran tambahan yang tersimpan"
                                />
                              )}
                              <span className={`nav-chevron ${isExtraOpen ? 'open' : ''}`}>▾</span>
                            </div>

                            {isExtraOpen && (
                              <div style={{ paddingLeft: 12 }}>
                                {extraItems.map((extra) => {
                                  const subActive = isParentActive && currentMode === extra.mode;
                                  return (
                                    <div
                                      key={extra.id}
                                      className={`sub-menu-item ${subActive ? 'active' : ''}`}
                                      onClick={() => {
                                        navigate(extra.href);
                                        setMobileMenuOpen(false);
                                      }}
                                    >
                                      {extra.label}
                                      {isSectionSaved(m.id, extra.mode) && (
                                        <span
                                          className="sub-menu-saved"
                                          title="Sudah tersimpan di Paket PDF"
                                          aria-label="Sudah tersimpan di Paket PDF"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const subActive = isParentActive && currentMode === c.mode;
                      return (
                        <div
                          key={c.id}
                          className={`sub-menu-item ${subActive ? 'active' : ''}`}
                          onClick={() => {
                            navigate(c.href);
                            setMobileMenuOpen(false);
                          }}
                        >
                          {c.label}
                          {isSectionSaved(m.id, c.mode) && (
                            <span
                              className="sub-menu-saved"
                              title="Sudah tersimpan di Paket PDF"
                              aria-label="Sudah tersimpan di Paket PDF"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <main
          className="layout-content"
          ref={mainRef}
          onScroll={handleMainScroll}
        >
          {activeMenu !== 'welcome' && (
            <div className="feature-page-header">
              {current && <img src={asset(current.icon)} alt="" className="feature-page-icon" />}
              <h2 className="feature-page-title">{pageTitle}</h2>
            </div>
          )}
          <div className="feature-page-content" ref={contentRef}>
            <div key={`${activeMenu}-${currentMode}`} className="page-enter">
              {children}
            </div>
            {builder && hasPreview && (
              <BundleBar
                builderId={builder.id}
                docType={builder.id === 'lact-builder' ? 'LACT' : 'BAUT'}
                currentMode={currentMode}
                sections={bundleSections}
                getRoot={() => contentRef.current}
              />
            )}
          </div>
        </main>

        <button
          type="button"
          className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
          onClick={scrollToTop}
          title="Kembali ke atas"
          aria-label="Kembali ke atas"
        >
          ↑
        </button>
      </div>

      <footer className="layout-footer">
        <div className="footer-left">
          © 2026 Telkom Akses | <strong>Verita</strong> — Evidence &amp; Document Builder | Developed by{' '}
          <span className="text-red">Telkom Akses</span>
        </div>
        <div className="footer-center"></div>
        <div className="footer-right"></div>
      </footer>
      <ToastContainer />
    </div>
  );
}