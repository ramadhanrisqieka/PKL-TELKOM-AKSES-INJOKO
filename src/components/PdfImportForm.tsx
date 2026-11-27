import { useState } from 'react';
import MainLayout from './MainLayout';
import PdfImportPage from './PdfImportPage';
import { buildPdfFileName } from './ExportOptions';
import { isPdfFile, renderPdfToImages } from '../utils/pdfImport';
import {
  exportRawPdfPages,
  registerRawPdfPage,
  unregisterRawPdfPage,
} from '../utils/pdfBundle';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import { useSharedProject } from '../utils/projectStore';
import '../assets/style_Evidence.css';
import '../assets/style_ExportOptions.css';
import '../assets/style_PdfImport.css';

interface PdfImportFormProps {
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file yang diunduh */
  docTitle: string;
  /** Judul yang tampil di kop halaman aplikasi, mis. "Buat BAUT — ABD" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' — supaya sidebar menyorot menu yang benar */
  activeMenu: string;
  /** Nama bagian seperti di menu, mis. "ABD" / "NDE" / "BA Tambah Kurang" / "BA ABD" */
  sectionLabel: string;
  /** Penanda di nama file unduhan (tanpa spasi), mis. "ABD" / "NDE" */
  fileTag: string;
}

/** Satu halaman dari PDF yang diimpor: preview untuk layar, bytes+pageIndex untuk ekspor asli. */
interface ImportedPage {
  id: string;
  name: string;
  source: string;
  preview: string;
  bytes: Uint8Array;
  pageIndex: number;
}

const MAX_PAGES = 80;
/** Hanya untuk preview di layar (ekspor PDF memakai file asli, bukan gambar ini). */
const RENDER_OPTIONS = { trim: false, scale: 2, format: 'jpeg', jpegQuality: 0.88, maxSide: 2200 } as const;

let idCounter = 0;
const newId = () => `rawpdf-${Date.now()}-${idCounter++}`;
const byName = (a: File, b: File) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const stripExt = (name: string) => name.replace(/\.pdf$/i, '');

export default function PdfImportForm({
  docTitle,
  pageTitle,
  activeMenu,
  sectionLabel,
  fileTag,
}: PdfImportFormProps) {
  const [project] = useSharedProject();

  const [items, setItems] = useState<ImportedPage[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');

  // ---------- Impor file PDF ----------
  const handleImport = async (fileList: File[]) => {
    if (loading) return;

    const pdfs = fileList.filter(isPdfFile).sort(byName);
    const notPdf = fileList.filter((f) => !isPdfFile(f));
    if (pdfs.length === 0) {
      showToast(`Pilih file PDF ${sectionLabel}. Format lain tidak bisa diimpor di sini.`, 'error');
      return;
    }

    const added: ImportedPage[] = [];
    const problems: string[] = notPdf.map((f) => `${f.name}: bukan file PDF`);

    for (const file of pdfs) {
      try {
        setLoading(`Membaca ${file.name}...`);
        const rawBytes = new Uint8Array(await file.arrayBuffer());
        const pages = await renderPdfToImages(
          file,
          (done, total) => setLoading(`${file.name}: halaman ${done} dari ${total}...`),
          RENDER_OPTIONS
        );
        pages.forEach((preview, i) => {
          const id = newId();
          added.push({
            id,
            name: pages.length > 1 ? `${file.name} — hal ${i + 1}` : file.name,
            source: stripExt(file.name),
            preview,
            bytes: rawBytes,
            pageIndex: i,
          });
        });
      } catch (err) {
        console.error(err);
        problems.push(`${file.name}: tidak bisa dibuka (file rusak, diberi password, atau bukan PDF yang valid)`);
      }
    }
    setLoading(null);

    let accepted = added;
    const room = MAX_PAGES - items.length;
    if (added.length > room) {
      accepted = added.slice(0, Math.max(0, room));
      problems.push(`Hanya ${MAX_PAGES} halaman yang bisa diimpor sekaligus; ${added.length - accepted.length} halaman dilewati`);
    }
    if (accepted.length > 0) {
      accepted.forEach((it) =>
        registerRawPdfPage(it.id, { bytes: it.bytes, pageIndex: it.pageIndex })
      );
      setItems((prev) => [...prev, ...accepted]);
      showToast(`${accepted.length} halaman ${sectionLabel} berhasil diimpor.`, 'success');
    }
    if (problems.length > 0) alert(`Sebagian file dilewati:\n\n${problems.map((p) => `• ${p}`).join('\n')}`);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeItem = (id: string) => {
    unregisterRawPdfPage(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const clearItems = () => {
    if (window.confirm(`Hapus semua halaman ${sectionLabel} yang sudah diimpor?`)) {
      items.forEach((it) => unregisterRawPdfPage(it.id));
      setItems([]);
    }
  };

  const handlePreview = () => {
    if (items.length === 0) {
      showToast(`Mohon impor file PDF ${sectionLabel} terlebih dahulu.`, 'error');
      focusAndShake(document.querySelector<HTMLElement>('.pdfimp-upload-box'));
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const safeName = (project.lokasi || project.proyek || items[0]?.source || 'dokumen')
        .trim()
        .replace(/\s+/g, '_');
      await exportRawPdfPages(
        items.map((it) => ({ bytes: it.bytes, pageIndex: it.pageIndex })),
        buildPdfFileName({ fileName }, `${docTitle}_${fileTag}_${safeName}`)
      );
      showToast(`${sectionLabel} ${docTitle} berhasil diunduh.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengekspor PDF asli, coba lagi.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (mode === 'preview') {
    return (
      <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
        <div className="evidence-preview-actions">
          <button className="evidence-btn-secondary" onClick={() => setMode('form')}>
            ← Kembali Edit
          </button>
          <button className="evidence-submit-btn" onClick={handleDownload} disabled={isProcessing}>
            {isProcessing ? 'Memproses...' : `Unduh ${sectionLabel} ${docTitle} (PDF)`}
          </button>
        </div>

        <details className="export-options" open>
          <summary>Opsi Export PDF</summary>
          <div className="export-options-grid">
            <label>
              Nama file (opsional)
              <input
                type="text"
                value={fileName}
                placeholder="Kosong = otomatis"
                onChange={(e) => setFileName(e.target.value)}
              />
            </label>
            <p className="export-options-hint">
              Halaman diekspor langsung dari file PDF asli — ukuran kertas (mis. A3 Landscape) dan ketajaman
              vektor tetap terjaga 100%.
            </p>
          </div>
        </details>

        <div id="pdf-import-content">
          {items.map((it, i) => (
            <div key={it.id} data-raw-pdf-id={it.id}>
              <PdfImportPage imageDataUrl={it.preview} imageAlt={`${sectionLabel} halaman ${i + 1}`} />
              {i < items.length - 1 && <div className="pdf-page-gap">— Akhir Halaman {i + 1} —</div>}
            </div>
          ))}
        </div>
      </MainLayout>
    );
  }

  const inputId = `pdf-import-upload-${fileTag}`;

  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-heading-field">
          <label htmlFor={inputId}>Impor PDF {sectionLabel}</label>
          <label
            htmlFor={inputId}
            className={`pdfimp-upload-box${isDragging ? ' dragging' : ''}${loading ? ' busy' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleImport(Array.from(e.dataTransfer.files));
            }}
          >
            <span className="evidence-upload-icon">⬆</span>
            <span className="evidence-upload-text">
              {loading ?? `Klik untuk pilih file PDF ${sectionLabel}, atau seret dan lepas ke sini`}
            </span>
            <span className="pdfimp-upload-hint">
              Setiap halaman PDF disalin apa adanya dari file asli (ukuran A3/A4, orientasi landscape/portrait,
              dan ketajaman tetap utuh). Boleh memilih beberapa file sekaligus.
            </span>
          </label>
          <input
            id={inputId}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="evidence-upload-input"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              handleImport(files);
            }}
          />

          {items.length > 0 && (
            <>
              <div className="pdfimp-toolbar">
                <span>{items.length} halaman akan dicetak. Atur urutannya dengan tombol ← →.</span>
                <button type="button" className="pdfimp-clear" onClick={clearItems}>
                  Hapus semua
                </button>
              </div>

              <div className="pdfimp-thumbs">
                {items.map((it, i) => (
                  <div key={it.id} className="pdfimp-thumb">
                    <span className="pdfimp-thumb-number">{i + 1}</span>
                    <img src={it.preview} alt={`${sectionLabel} halaman ${i + 1}`} />
                    <div className="pdfimp-thumb-name" title={it.name}>
                      {it.name}
                    </div>
                    <div className="pdfimp-thumb-actions">
                      <button
                        type="button"
                        className="pdfimp-thumb-btn"
                        title="Geser ke kiri"
                        disabled={i === 0}
                        onClick={() => moveItem(i, -1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="pdfimp-thumb-btn"
                        title="Geser ke kanan"
                        disabled={i === items.length - 1}
                        onClick={() => moveItem(i, 1)}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        className="pdfimp-thumb-btn remove"
                        title="Hapus halaman ini"
                        onClick={() => removeItem(it.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <button className="evidence-submit-btn" onClick={handlePreview}>
          Lihat Preview
        </button>
      </div>
    </MainLayout>
  );
}