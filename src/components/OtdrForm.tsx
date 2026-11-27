import { useState } from 'react';
import MainLayout from './MainLayout';
import OtdrPage from './OtdrPage';
import SimpleExportOptionsPanel, {
  DEFAULT_SIMPLE_EXPORT_OPTIONS,
  type SimpleExportOptions,
} from './SimpleExportOptions';
import { QUALITY_PRESETS, buildPdfFileName } from './ExportOptions';
import { compressImage, formatBytes, MAX_ORIGINAL_BYTES, MAX_ORIGINAL_MB } from '../utils/imageCompress';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import { isPdfFile, isSorFile, renderPdfToImages } from '../utils/pdfImport';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import type { ProjectData } from '../types/evidence';
import '../assets/style_Otdr.css';
import { useSharedProject } from '../utils/projectStore';
import DistrictSelect from './DistrictSelect';

interface OtdrFormProps {
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file yang diunduh */
  docTitle: string;
  /** Judul yang tampil di kop halaman aplikasi, mis. "Buat LACT — Import OTDR" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' — supaya sidebar menyorot menu yang benar */
  activeMenu: string;
  /** Judul di kop halaman PDF (satu baris), mis. "LAMPIRAN HASIL UKUR OTDR" */
  defaultTitleLine1: string;
}

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

/** Satu halaman hasil OTDR yang diimpor. `file` hanya ada untuk gambar (foto asli dipakai saat export). */
interface OtdrItem {
  id: string;
  name: string;
  preview: string;
  file?: File;
}

const MAX_PAGES = 60;

let idCounter = 0;
const newId = () => `${Date.now()}-${idCounter++}`;
const byName = (a: File, b: File) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export default function OtdrForm({
  docTitle,
  pageTitle,
  activeMenu,
  defaultTitleLine1,
}: OtdrFormProps) {
  const [project, setProject] = useSharedProject(emptyProject);
  const [titleLine1, setTitleLine1] = useState(defaultTitleLine1);

  const [items, setItems] = useState<OtdrItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportOpts, setExportOpts] = useState<SimpleExportOptions>(DEFAULT_SIMPLE_EXPORT_OPTIONS);

  const handleProjectChange = (field: keyof ProjectData, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  // ---------- Impor hasil OTDR (PDF atau gambar dari aplikasi OTDR) ----------
  const handleImport = async (fileList: File[]) => {
    if (loading) return;

    const sor = fileList.filter(isSorFile);
    if (sor.length > 0) {
      alert(
        `File .sor tidak bisa dibuka langsung di sini:\n\n${sor.map((f) => `• ${f.name}`).join('\n')}\n\n` +
          '.sor adalah data mentah dari alat OTDR. Buka file itu di aplikasi OTDR, lalu ekspor atau ' +
          'simpan hasilnya sebagai PDF (atau gambar), dan impor file hasil ekspor itu di sini.'
      );
    }

    const usable = fileList.filter((f) => !isSorFile(f) && (isPdfFile(f) || f.type.startsWith('image/'))).sort(byName);
    if (usable.length === 0) {
      if (sor.length === 0) showToast('Pilih file PDF atau gambar hasil ekspor aplikasi OTDR.', 'error');
      return;
    }

    const added: OtdrItem[] = [];
    const problems: string[] = [];

    for (const file of usable) {
      try {
        if (isPdfFile(file)) {
          setLoading(`Membaca ${file.name}...`);
          const pages = await renderPdfToImages(file, (done, total) =>
            setLoading(`${file.name}: halaman ${done} dari ${total}...`)
          );
          pages.forEach((preview, i) =>
            added.push({
              id: newId(),
              name: pages.length > 1 ? `${file.name} — hal ${i + 1}` : file.name,
              preview,
            })
          );
        } else {
          if (file.size > MAX_ORIGINAL_BYTES) {
            problems.push(
              `${file.name} (${formatBytes(file.size)}): lebih dari ${MAX_ORIGINAL_MB} MB, kompres dulu lewat menu Kompres Foto`
            );
            continue;
          }
          setLoading(`Memproses ${file.name}...`);
          added.push({ id: newId(), name: file.name, preview: await compressImage(file), file });
        }
      } catch (err) {
        console.error(err);
        problems.push(`${file.name}: tidak bisa dibuka (file rusak, terkunci, atau bukan PDF/gambar yang valid)`);
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
      setItems((prev) => [...prev, ...accepted]);
      showToast(`${accepted.length} halaman OTDR berhasil diimpor.`, 'success');
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

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const clearItems = () => {
    if (window.confirm('Hapus semua hasil OTDR yang sudah diimpor?')) setItems([]);
  };

  const handlePreview = () => {
    if (titleLine1.trim() === '') {
      showToast('Mohon isi judul dokumen terlebih dahulu.', 'error');
      focusAndShake(document.getElementById('otdr-title'));
      return;
    }
    const projectBelumLengkap = Object.values(project).some((v) => v.trim() === '');
    if (projectBelumLengkap) {
      showToast('Mohon lengkapi semua data proyek terlebih dahulu.', 'error');
      const emptyField = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          '#otdr-project-fields input, #otdr-project-fields select'
        )
      ).find((el) => el.value.trim() === '');
      focusAndShake(emptyField ?? null);
      return;
    }
    if (items.length === 0) {
      showToast('Mohon impor hasil OTDR terlebih dahulu (PDF atau gambar dari aplikasi OTDR).', 'error');
      focusAndShake(document.querySelector<HTMLElement>('.otdr-upload-box'));
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const safeName = (project.lokasi || project.proyek || 'dokumen').trim().replace(/\s+/g, '_');
      const originals: Record<string, Blob> = {};
      items.forEach((it) => {
        if (it.file) originals[`otdr-image-${it.id}`] = it.file;
      });
      await generatePdfFromElement(
        'pdf-otdr-content',
        buildPdfFileName(exportOpts, `${docTitle}_OTDR_${safeName}`),
        originals,
        undefined,
        QUALITY_PRESETS[exportOpts.quality]
      );
      showToast(`OTDR ${docTitle} berhasil diunduh.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat PDF, coba lagi.', 'error');
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
            {isProcessing ? 'Memproses...' : `Unduh OTDR ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR div ber-id pdf-..., jadi tidak ikut masuk PDF */}
        <SimpleExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-otdr-content">
          {items.map((it, i) => (
            <div key={it.id}>
              <OtdrPage
                showLogos={exportOpts.showLogos}
                logoSize={exportOpts.logoSize}
                titleLine1={titleLine1}
                project={project}
                imageId={`otdr-image-${it.id}`}
                imageDataUrl={it.preview}
                imageAlt={`Hasil OTDR ${i + 1}`}
                pageNumber={i + 1}
                totalPages={items.length}
              />
              {i < items.length - 1 && <div className="pdf-page-gap">— Akhir Halaman {i + 1} —</div>}
            </div>
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-form-fields">
          <label>
            Judul Dokumen
            <input
              id="otdr-title"
              type="text"
              value={titleLine1}
              onChange={(e) => setTitleLine1(e.target.value)}
              placeholder="Contoh: LAMPIRAN HASIL UKUR OTDR"
            />
          </label>
        </div>

        <div id="otdr-project-fields" className="evidence-form-fields">
          <label>
            Proyek
            <input
              type="text"
              value={project.proyek}
              onChange={(e) => handleProjectChange('proyek', e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
          <label>
            Kontrak
            <input
              type="text"
              value={project.kontrak}
              onChange={(e) => handleProjectChange('kontrak', e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
          <label>
            Surat Pesanan
            <input
              type="text"
              value={project.suratPesanan}
              onChange={(e) => handleProjectChange('suratPesanan', e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
          <label>
            District
            <DistrictSelect
              value={project.district}
              onChange={(v) => handleProjectChange('district', v)}
            />
          </label>
          <label>
            Lokasi
            <input
              type="text"
              value={project.lokasi}
              onChange={(e) => handleProjectChange('lokasi', e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
          <label>
            Pelaksana
            <input
              type="text"
              value={project.pelaksana}
              onChange={(e) => handleProjectChange('pelaksana', e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
        </div>

        <div className="evidence-heading-field">
          <label htmlFor="otdr-import-upload">Impor Hasil OTDR</label>
          <label
            htmlFor="otdr-import-upload"
            className={`otdr-upload-box${isDragging ? ' dragging' : ''}${loading ? ' busy' : ''}`}
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
              {loading ?? 'Klik untuk pilih file hasil ekspor aplikasi OTDR (PDF atau gambar), atau seret dan lepas ke sini'}
            </span>
            <span className="otdr-upload-hint">
              Header (logo, judul, data proyek) disediakan di atas hasil OTDR. File .sor mentah tidak bisa dibuka
              langsung: buka dulu di aplikasi OTDR, lalu ekspor ke PDF.
            </span>
          </label>
          <input
            id="otdr-import-upload"
            type="file"
            accept=".pdf,application/pdf,image/*,.sor"
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
              <div className="otdr-toolbar">
                <span>
                  {items.length} halaman akan dicetak. Atur urutannya dengan tombol ← →.
                </span>
                <button type="button" className="otdr-clear" onClick={clearItems}>
                  Hapus semua
                </button>
              </div>

              <div className="otdr-thumbs">
                {items.map((it, i) => (
                  <div key={it.id} className="otdr-thumb">
                    <span className="otdr-thumb-number">{i + 1}</span>
                    <img src={it.preview} alt={`Hasil OTDR ${i + 1}`} />
                    <div className="otdr-thumb-name" title={it.name}>
                      {it.name}
                    </div>
                    <div className="otdr-thumb-actions">
                      <button
                        type="button"
                        className="otdr-thumb-btn"
                        title="Geser ke kiri"
                        disabled={i === 0}
                        onClick={() => moveItem(i, -1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="otdr-thumb-btn"
                        title="Geser ke kanan"
                        disabled={i === items.length - 1}
                        onClick={() => moveItem(i, 1)}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        className="otdr-thumb-btn remove"
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