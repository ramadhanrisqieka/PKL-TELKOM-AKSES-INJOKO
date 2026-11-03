import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from './MainLayout';
import EvidencePreview from './EvidencePreview';
import ExportOptionsPanel, {
  DEFAULT_EXPORT_OPTIONS,
  QUALITY_PRESETS,
  buildPdfFileName,
  type ExportOptions,
} from './ExportOptions';
import PhotoCompressor from './PhotoCompressor';
import { compressImage, formatBytes, MAX_ORIGINAL_BYTES, MAX_ORIGINAL_MB } from '../utils/imageCompress';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import type { ProjectData, EvidenceItem } from '../types/evidence';
import '../assets/style_Evidence.css';

interface EvidenceFormProps {
  docTitle: string;
  pageTitle: string;
  activeMenu: string;
}

// Jumlah slot Lampiran Evidence yang independen. Mau nambah/kurangi lagi?
// Tinggal ubah angka ini saja, semua menu & state otomatis menyesuaikan.
const EVIDENCE_SLOT_COUNT = 12;

type EvidenceSlot = `evidence${number}`;
type UploadMode = BulkLikeMode | 'compress';

const EVIDENCE_SLOTS: EvidenceSlot[] = Array.from(
  { length: EVIDENCE_SLOT_COUNT },
  (_, i) => `evidence${i + 1}` as EvidenceSlot
);
const isEvidenceSlot = (m: string): m is EvidenceSlot =>
  (EVIDENCE_SLOTS as string[]).includes(m);

// Kalau nanti mau nambah fitur serupa lagi (upload sekaligus dengan keranjang
// terpisah), tinggal tambahkan nama modenya di BULK_LIKE_MODES di bawah.
// CATATAN: "Data Pengukuran OPM" TIDAK lagi di sini — dulu sempat dititipkan
// sebagai salah satu BulkLikeMode (jadi cuma galeri foto generik, tanpa kop/
// tabel info proyek/blok tanda tangan yang benar). Sekarang "Data Pengukuran
// OPM" punya halaman & form sendiri: lihat OpmForm.tsx / OpmPage.tsx /
// style_Opm.css, dirutekan langsung dari Lact.tsx & BuatBaut.tsx (mode
// 'opm'), persis seperti pola BoqForm/BoqPage.
type BulkLikeMode = EvidenceSlot;
const BULK_LIKE_MODES: BulkLikeMode[] = [...EVIDENCE_SLOTS];
const isBulkLikeMode = (m: string): m is BulkLikeMode =>
  (BULK_LIKE_MODES as string[]).includes(m);

const MODE_TITLES: Record<string, string> = {
  compress: 'Kompres Foto',
  ...Object.fromEntries(EVIDENCE_SLOTS.map((slot, i) => [slot, `Lampiran Evidence ${i + 1}`])),
};

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

let idCounter = 0;
const generateId = () => `item-${Date.now()}-${idCounter++}`;

// Nama file bawaan kamera/WhatsApp tidak informatif, jadi keterangannya dikosongkan
const CAMERA_FILE_NAME = /^(img|dsc|dscn|pxl|vid|screenshot|whatsapp)/i;

/** Mengubah nama file menjadi keterangan awal. Contoh: "ODP_BEFORE.jpg" -> "ODP BEFORE" */
const fileNameToLabel = (fileName: string) => {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
  if (CAMERA_FILE_NAME.test(base) || /^[\d\s.-]+$/.test(base)) return '';
  return base;
};

export default function EvidenceForm({
  docTitle,
  pageTitle,
  activeMenu,
}: EvidenceFormProps) {
  // Mode dipilih dari menu sidebar: ?mode=evidence1..evidence12, atau ?mode=compress.
  // Kalau tidak ada/tidak dikenali, otomatis dianggap Lampiran Evidence 1.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawMode = searchParams.get('mode') ?? '';
  const uploadMode: UploadMode = isBulkLikeMode(rawMode)
    ? rawMode
    : rawMode === 'compress'
    ? 'compress'
    : EVIDENCE_SLOTS[0];

  const [project, setProject] = useState<ProjectData>(emptyProject);
  const [docHeading, setDocHeading] = useState('LAMPIRAN EVIDENT PEKERJAAN');

  // Keranjang TERPISAH untuk Lampiran Evidence 1-12
  // (ganti mode tidak saling menghapus isian satu sama lain)
  const [evidenceItemsByMode, setEvidenceItemsByMode] = useState<Record<BulkLikeMode, EvidenceItem[]>>(
    () =>
      Object.fromEntries(BULK_LIKE_MODES.map((slot) => [slot, [] as EvidenceItem[]])) as Record<
        BulkLikeMode,
        EvidenceItem[]
      >
  );
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Foto yang melebihi batas ukuran dan dialihkan ke menu Kompres Foto, serta slot
  // mana yang harus dituju lagi setelah selesai dikompres (salah satu Lampiran Evidence)
  const [pendingCompress, setPendingCompress] = useState<File[]>([]);
  const [compressReturnMode, setCompressReturnMode] = useState<BulkLikeMode>(EVIDENCE_SLOTS[0]);

  // Helper baca/tulis keranjang evidence slot yang SEDANG AKTIF
  const setSlotItems = (slot: BulkLikeMode, updater: (prev: EvidenceItem[]) => EvidenceItem[]) => {
    setEvidenceItemsByMode((prev) => ({ ...prev, [slot]: updater(prev[slot]) }));
  };

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  // Opsi export PDF (logo, kolom, kualitas, dsb.) dipilih di halaman preview
  const [exportOpts, setExportOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);

  // Daftar yang sedang dipakai sesuai mode: tiap slot Lampiran Evidence punya
  // keranjangnya sendiri. Di mode "compress" tidak ada daftar (hanya halaman kompres).
  const activeItems: EvidenceItem[] = isBulkLikeMode(uploadMode) ? evidenceItemsByMode[uploadMode] : [];
  const setActiveItems = (updater: (prev: EvidenceItem[]) => EvidenceItem[]) => {
    if (isBulkLikeMode(uploadMode)) {
      setSlotItems(uploadMode, updater);
    }
  };

  // Kalau pindah mode lewat sidebar, kembali ke tampilan form
  useEffect(() => {
    setMode('form');
  }, [uploadMode]);

  // Foto kiriman untuk dikompres hanya berlaku selama berada di menu Kompres Foto
  useEffect(() => {
    if (uploadMode !== 'compress') setPendingCompress([]);
  }, [uploadMode]);

  const handleProjectChange = (field: keyof ProjectData, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const handleLabelChange = (id: string, value: string) => {
    setActiveItems((prev) => prev.map((it) => (it.id === id ? { ...it, label: value } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setActiveItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Foto di atas batas ukuran dialihkan ke menu Kompres Foto. `fromMode` dicatat
  // supaya setelah selesai dikompres, hasilnya kembali ke slot/mode asal yang benar.
  const redirectToCompress = (bigFiles: File[], fromMode: BulkLikeMode) => {
    const daftar = bigFiles.map((f) => `• ${f.name} (${formatBytes(f.size)})`).join('\n');
    const lanjut = window.confirm(
      `Foto berikut berukuran lebih dari ${MAX_ORIGINAL_MB} MB dan perlu dikompres dulu:\n\n${daftar}\n\nBuka menu Kompres Foto sekarang?`
    );
    if (lanjut) {
      setPendingCompress(bigFiles);
      setCompressReturnMode(fromMode);
      setSearchParams({ mode: 'compress' });
    }
  };

  // ---------- Mode: Lampiran Evidence 1-12 ----------
  // Semua fungsi di bawah ini generik: otomatis mengoperasikan keranjang slot
  // yang SEDANG AKTIF (evidence1 sampai evidence12) lewat
  // setActiveItems, jadi tidak ada data yang tercampur antar slot.
  const handleBulkFiles = async (fileList: File[]) => {
    if (!isBulkLikeMode(uploadMode)) return;
    if (bulkProgress) return; // sedang memproses

    const images = fileList.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      alert('Pilih file gambar (JPG atau PNG).');
      return;
    }

    const tooBig = images.filter((f) => f.size > MAX_ORIGINAL_BYTES);
    const files = images.filter((f) => f.size <= MAX_ORIGINAL_BYTES);

    if (files.length > 0) {
      // Urutkan berdasarkan nama file (IMG_2 sebelum IMG_10) supaya urutannya wajar
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      setBulkProgress({ done: 0, total: files.length });
      const added: EvidenceItem[] = [];
      let failed = 0;

      for (let i = 0; i < files.length; i++) {
        try {
          const preview = await compressImage(files[i]);
          added.push({ id: generateId(), label: fileNameToLabel(files[i].name), dataUrl: preview, file: files[i] });
        } catch (err) {
          console.error(err);
          failed++;
        }
        setBulkProgress({ done: i + 1, total: files.length });
      }

      setActiveItems((prev) => [...prev, ...added]);
      setBulkProgress(null);

      if (failed > 0) {
        alert(`${failed} foto gagal diproses dan dilewati.`);
      }
    }

    if (tooBig.length > 0) {
      redirectToCompress(tooBig, uploadMode);
    }
  };

  const moveBulkItem = (index: number, direction: -1 | 1) => {
    setActiveItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleClearBulk = () => {
    if (window.confirm('Hapus semua foto yang sudah diunggah?')) {
      setActiveItems(() => []);
    }
  };

  // ---------- Mode: Kompres Foto ----------
  // Hasil kompres dikembalikan ke slot/mode ASAL (dicatat di compressReturnMode):
  // yaitu salah satu Lampiran Evidence 1-12.
  const handleUseCompressed = async (files: File[]) => {
    const added: EvidenceItem[] = [];
    for (const file of files) {
      try {
        const preview = await compressImage(file);
        added.push({ id: generateId(), label: fileNameToLabel(file.name), dataUrl: preview, file });
      } catch (err) {
        console.error(err);
      }
    }

    setSlotItems(compressReturnMode, (prev) => [...prev, ...added]);

    setPendingCompress([]);
    setSearchParams({ mode: compressReturnMode });
  };

  // ---------- Preview & unduh ----------
  const handlePreview = () => {
    if (docHeading.trim() === '') {
      alert('Mohon isi judul dokumen terlebih dahulu.');
      return;
    }
    const projectBelumLengkap = Object.values(project).some((v) => v.trim() === '');
    if (projectBelumLengkap) {
      alert('Mohon lengkapi semua data proyek terlebih dahulu.');
      return;
    }
    if (activeItems.length === 0) {
      alert('Tambahkan minimal 1 evidence foto terlebih dahulu.');
      return;
    }
    const adaLabelKosong = activeItems.some((it) => it.label.trim() === '');
    if (adaLabelKosong) {
      alert('Mohon isi keterangan untuk setiap foto evidence.');
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    setExportStatus('');
    try {
      // Nama file otomatis dari lokasi (proyek biasanya sama untuk banyak dokumen)
      const safeName = (project.lokasi || project.proyek || 'dokumen').trim().replace(/\s+/g, '_');

      // Foto ASLI dipakai untuk PDF supaya tajam; yang ada di layar hanyalah versi ringan
      const originals: Record<string, Blob> = {};
      activeItems.forEach((it) => {
        if (it.file) originals[it.id] = it.file;
      });

      await generatePdfFromElement(
        'pdf-preview-content',
        buildPdfFileName(exportOpts, `${docTitle}_${safeName}`),
        originals,
        (done, total) => setExportStatus(`Memproses foto ${done} dari ${total}...`),
        QUALITY_PRESETS[exportOpts.quality]
      );
    } catch (err) {
      console.error(err);
      alert('Gagal membuat PDF, coba lagi.');
    } finally {
      setIsProcessing(false);
      setExportStatus('');
    }
  };

  const fullTitle = `${pageTitle} — ${MODE_TITLES[uploadMode]}`;

  if (mode === 'preview') {
    return (
      <MainLayout pageTitle={fullTitle} activeMenu={activeMenu}>
        <div className="evidence-preview-actions">
          <button className="evidence-btn-secondary" onClick={() => setMode('form')}>
            ← Kembali Edit
          </button>
          <button className="evidence-submit-btn" onClick={handleDownload} disabled={isProcessing}>
            {isProcessing ? exportStatus || 'Memproses...' : `Unduh ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR #pdf-preview-content, jadi tidak ikut masuk PDF */}
        <ExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-preview-content">
          <EvidencePreview
            docTitle={docHeading}
            project={project}
            items={activeItems}
            options={exportOpts}
          />
        </div>
      </MainLayout>
    );
  }

  if (uploadMode === 'compress') {
    return (
      <MainLayout pageTitle={fullTitle} activeMenu={activeMenu}>
        <PhotoCompressor initialFiles={pendingCompress} onUse={handleUseCompressed} />
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle={fullTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-heading-field">
          <label htmlFor="doc-heading-input">Judul Dokumen</label>
          <input
            id="doc-heading-input"
            type="text"
            value={docHeading}
            onChange={(e) => setDocHeading(e.target.value)}
            placeholder="Contoh: LAMPIRAN EVIDENT PEKERJAAN"
          />
        </div>

        <div className="evidence-form-fields">
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
            <input
              type="text"
              value={project.district}
              onChange={(e) => handleProjectChange('district', e.target.value)}
              placeholder="Ketik disini"
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

        {/* ================= UPLOAD FOTO SEKALIGUS (semua Lampiran Evidence) ================= */}
        <div className="evidence-bulk">
          <label
            htmlFor="bulk-file-input"
            className={`evidence-bulk-dropzone ${isDragging ? 'dragging' : ''} ${bulkProgress ? 'busy' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleBulkFiles(Array.from<File>(e.dataTransfer.files));
            }}
          >
            {bulkProgress ? (
              <span className="evidence-bulk-title">
                Memproses foto {bulkProgress.done} dari {bulkProgress.total}...
              </span>
            ) : (
              <>
                <span className="evidence-bulk-icon">⬆</span>
                <span className="evidence-bulk-title">Pilih banyak foto sekaligus</span>
                <span className="evidence-bulk-hint">
                  atau seret dan lepas foto ke sini. Disarankan 4 atau 6 foto per lembar.
                  Foto di atas {MAX_ORIGINAL_MB} MB akan diarahkan ke menu Kompres Foto.
                </span>
              </>
            )}
          </label>
          <input
            id="bulk-file-input"
            type="file"
            accept="image/*"
            multiple
            className="evidence-upload-input"
            disabled={!!bulkProgress}
            onChange={(e) => {
              const files = Array.from<File>(e.target.files ?? []);
              e.target.value = ''; // supaya file yang sama bisa dipilih lagi
              handleBulkFiles(files);
            }}
          />

          {activeItems.length > 0 && (
            <>
              <div className="evidence-bulk-toolbar">
                <span>{activeItems.length} foto siap dipakai. Isi keterangan dan atur urutannya.</span>
                <button type="button" className="evidence-bulk-clear" onClick={handleClearBulk}>
                  Hapus semua
                </button>
              </div>

              <div className="evidence-bulk-list">
                {activeItems.map((item, index) => (
                  <div key={item.id} className="evidence-section-card evidence-bulk-card">
                    <span className="evidence-bulk-number">{index + 1}</span>
                    <button
                      type="button"
                      className="evidence-remove-btn"
                      onClick={() => handleRemoveItem(item.id)}
                      title="Hapus foto ini"
                    >
                      ×
                    </button>

                    <input
                      type="text"
                      className="evidence-label-input"
                      placeholder="Ketik keterangan"
                      value={item.label}
                      onChange={(e) => handleLabelChange(item.id, e.target.value)}
                    />

                    {item.dataUrl && (
                      <img src={item.dataUrl} alt={item.label} className="evidence-bulk-thumb" />
                    )}

                    <div className="evidence-bulk-actions">
                      <button
                        type="button"
                        className="evidence-bulk-move"
                        onClick={() => moveBulkItem(index, -1)}
                        disabled={index === 0}
                        title="Geser ke depan"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="evidence-bulk-move"
                        onClick={() => moveBulkItem(index, 1)}
                        disabled={index === activeItems.length - 1}
                        title="Geser ke belakang"
                      >
                        →
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