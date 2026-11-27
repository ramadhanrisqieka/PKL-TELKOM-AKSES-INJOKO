import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_EXPORT_OPTIONS, QUALITY_PRESETS, type PdfQuality } from './ExportOptions';
import {
  captureSectionPages,
  clearBundle,
  getBundleName,
  getFileLabel,
  getSectionPageCount,
  isSectionSaved,
  mergeBundleToPdf,
  readLokasiFromPreview,
  removeSection,
  saveSection,
  setBundleName,
  useBundleVersion,
} from '../utils/pdfBundle';
import { showToast } from '../utils/uiFeedback';

export interface BundleSection {
  id: string;
  label: string;
  mode: string;
  href: string;
}

interface BundleBarProps {
  /** 'lact-builder' atau 'baut-builder' — paket LACT dan BAUT dipisah */
  builderId: string;
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file */
  docType: string;
  /** Mode halaman yang sedang tampil, mis. 'cover' atau 'evidence3' */
  currentMode: string;
  /** Urutan bagian sesuai menu (Cover ... Lampiran KML) */
  sections: BundleSection[];
  /** Mengambil elemen yang berisi halaman-halaman preview (.pdf-page) */
  getRoot: () => HTMLElement | null;
}

const safeName = (s: string) => s.trim().replace(/[^\w\-[\].]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Membersihkan nama file yang diketik user: membuang karakter yang dilarang
 * Windows (\ / : * ? " < > |), merapikan spasi, dan membuang ".pdf" di ujung
 * (ekstensi ditambahkan otomatis). Spasi dan huruf besar-kecil dibiarkan.
 */
const cleanUserFileName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.pdf$/i, '')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 120);

/**
 * Bilah "Paket PDF Lengkap" di bawah preview. Tidak mengubah tombol unduh
 * per bagian yang sudah ada: ini hanya menambah cara menyimpan bagian yang
 * sedang tampil ke paket, lanjut ke bagian berikutnya, lalu menggabungkan
 * semuanya jadi satu PDF (lihat utils/pdfBundle.ts).
 */
export default function BundleBar({ builderId, docType, currentMode, sections, getRoot }: BundleBarProps) {
  const navigate = useNavigate();
  useBundleVersion(); // render ulang saat isi paket berubah

  const [quality, setQuality] = useState<PdfQuality>(DEFAULT_EXPORT_OPTIONS.quality);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [info, setInfo] = useState('');
  // Nama file paket yang diketik user. Disimpan juga di pdfBundle supaya tidak
  // hilang waktu pindah ke bagian lain (komponen ini dibuat ulang tiap pindah halaman).
  const [fileNameInput, setFileNameInput] = useState(() => getBundleName(builderId));

  const idx = sections.findIndex((s) => s.mode === currentMode);
  const current = idx >= 0 ? sections[idx] : undefined;
  const next = idx >= 0 ? sections[idx + 1] : undefined;
  if (!current) return null;

  const savedSections = sections.filter((s) => isSectionSaved(builderId, s.mode));
  const totalPages = savedSections.reduce((n, s) => n + getSectionPageCount(builderId, s.mode), 0);
  const currentSaved = isSectionSaved(builderId, currentMode);

  /** Nama otomatis (dipakai kalau kolom nama dikosongkan): LACT_Lengkap_<lokasi> */
  const buildAutoName = () => {
    const label = safeName(getFileLabel(builderId));
    return `${docType}_Lengkap${label ? `_${label}` : ''}`;
  };
  const autoName = buildAutoName();
  const typedName = cleanUserFileName(fileNameInput);

  const handleNameChange = (value: string) => {
    setFileNameInput(value);
    setBundleName(builderId, value);
  };

  const saveCurrent = async () => {
    const root = getRoot();
    if (!root) throw new Error('Preview tidak ditemukan');
    const pages = await captureSectionPages(root, QUALITY_PRESETS[quality], (done, total) =>
      setStatus(`Menyimpan "${current.label}": halaman ${done} dari ${total}...`)
    );
    saveSection(builderId, currentMode, pages, readLokasiFromPreview(root));
    showToast(`"${current.label}" tersimpan ke Paket PDF.`, 'success');
  };

  const merge = async () => {
    setStatus('Menggabungkan semua bagian jadi 1 PDF...');
    // Nama ketikan user menang; kalau kosong pakai nama otomatis
    const fileName = `${cleanUserFileName(fileNameInput) || buildAutoName()}.pdf`;
    const pageCount = await mergeBundleToPdf(
      builderId,
      sections.map((s) => s.mode),
      fileName
    );
    setInfo(`Terunduh: ${fileName} (${pageCount} halaman)`);
    showToast(`Paket PDF diunduh (${pageCount} halaman).`, 'success');
  };

  const run = async (action: () => Promise<void> | void) => {
    if (busy) return;
    setBusy(true);
    setInfo('');
    try {
      await action();
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses paket PDF, coba lagi.', 'error');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="bundle-bar">
      <div className="bundle-bar-header">
        <div className="bundle-bar-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M12 11v6" />
            <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
          </svg>
        </div>
        <div className="bundle-bar-heading">
          <div className="bundle-bar-title">Paket PDF Lengkap {docType}</div>
          <div className="bundle-bar-subtitle">Gabungkan semua bagian jadi 1 file PDF</div>
        </div>
        {savedSections.length > 0 && (
          <div className="bundle-bar-count">
            <strong>{savedSections.length}</strong> bagian · <strong>{totalPages}</strong> halaman
          </div>
        )}
      </div>

      <p className="bundle-bar-hint">
        Tombol unduh di atas tetap mengunduh bagian ini saja. Untuk satu file utuh ({sections[0].label} sampai{' '}
        {sections[sections.length - 1].label}), simpan tiap bagian ke paket lalu gabungkan. Bagian yang tidak
        diperlukan boleh dilewati lewat menu di samping.
      </p>

      <div className="bundle-bar-saved">
        {savedSections.length === 0 ? (
          <span className="bundle-bar-empty">Belum ada bagian yang tersimpan di paket.</span>
        ) : (
          savedSections.map((s) => (
            <span key={s.id} className="bundle-chip">
              <span className="bundle-chip-dot" aria-hidden="true" />
              <span className="bundle-chip-label">{s.label}</span>
              <span className="bundle-chip-pages">{getSectionPageCount(builderId, s.mode)} hal</span>
              <button
                type="button"
                className="bundle-chip-remove"
                title={`Hapus "${s.label}" dari paket`}
                aria-label={`Hapus ${s.label} dari paket`}
                disabled={busy}
                onClick={() => removeSection(builderId, s.mode)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="bundle-bar-settings">
        <label className="bundle-field bundle-field-grow">
          <span className="bundle-field-label">Nama file paket</span>
          <span className="bundle-input-wrap">
            <input
              type="text"
              className="bundle-input"
              value={fileNameInput}
              placeholder={autoName}
              maxLength={120}
              disabled={busy}
              onChange={(e) => handleNameChange(e.target.value)}
            />
            <span className="bundle-input-suffix">.pdf</span>
          </span>
          <span className="bundle-field-help">
            {typedName
              ? `Akan diunduh sebagai: ${typedName}.pdf`
              : `Kosongkan untuk nama otomatis: ${autoName}.pdf`}
          </span>
        </label>

        <label className="bundle-field">
          <span className="bundle-field-label">Kualitas paket</span>
          <select
            className="bundle-select"
            value={quality}
            onChange={(e) => setQuality(e.target.value as PdfQuality)}
            disabled={busy}
          >
            {(Object.keys(QUALITY_PRESETS) as PdfQuality[]).map((q) => (
              <option key={q} value={q}>
                {QUALITY_PRESETS[q].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bundle-bar-actions">
        {next && (
          <button
            type="button"
            className="bundle-btn bundle-btn-primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await saveCurrent();
                navigate(next.href);
              })
            }
          >
            {currentSaved ? 'Perbarui' : 'Simpan'} &amp; lanjut ke {next.label} →
          </button>
        )}

        <button
          type="button"
          className={next ? 'bundle-btn bundle-btn-secondary' : 'bundle-btn bundle-btn-primary'}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await saveCurrent();
              await merge();
            })
          }
        >
          {currentSaved ? 'Perbarui' : 'Simpan'} &amp; gabungkan jadi 1 PDF
        </button>

        {savedSections.length > 0 && (
          <button type="button" className="bundle-btn bundle-btn-neutral" disabled={busy} onClick={() => run(merge)}>
            Gabungkan yang sudah tersimpan saja
          </button>
        )}

        {savedSections.length > 0 && (
          <button
            type="button"
            className="bundle-btn bundle-btn-ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Kosongkan seluruh paket ${docType} (${savedSections.length} bagian)?`)) {
                clearBundle(builderId);
                setFileNameInput('');
              }
            }}
          >
            Kosongkan paket
          </button>
        )}
      </div>

      {status && <div className="bundle-bar-status">{status}</div>}
      {info && <div className="bundle-bar-info">{info}</div>}
      <p className="bundle-bar-note">
        Paket tersimpan di memori browser: hilang kalau halaman di-refresh atau ditutup.
      </p>
    </div>
  );
}