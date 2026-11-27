import { useMemo, useState } from 'react';
import MainLayout from './MainLayout';
import ExcelDocPage from './ExcelDocPage';
import ExcelTable from './ExcelTable';
import ExcelImportBox, { type SheetInfo } from './ExcelImportBox';
import SimpleExportOptionsPanel, {
  DEFAULT_SIMPLE_EXPORT_OPTIONS,
  type SimpleExportOptions,
} from './SimpleExportOptions';
import { QUALITY_PRESETS, buildPdfFileName } from './ExportOptions';
import { compressImage, formatBytes, MAX_ORIGINAL_BYTES, MAX_ORIGINAL_MB } from '../utils/imageCompress';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import { readXlsx, type WorkbookModel } from '../utils/xlsxReader';
import { buildSheetTable, paginateTable, prepareOpmTable, stretchRowsToFit, type SheetTable } from '../utils/xlsxTable';
import type { ProjectData } from '../types/evidence';
import '../assets/style_ExcelDoc.css';
import { useSharedProject } from '../utils/projectStore';
import DistrictSelect from './DistrictSelect';
import DualSignFields from './DualSignFields';
import { DEFAULT_LEFT_PARTY, DEFAULT_RIGHT_PARTY, type SignParty } from './DualSignBlock';

export type ExcelDocKind = 'boq' | 'opm' | 'mancore';

interface ExcelDocFormProps {
  /** 'LACT' atau 'BAUT' */
  docTitle: string;
  /** Judul di kop halaman aplikasi, mis. "Buat LACT — BOQ" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' */
  activeMenu: string;
  /** Jenis dokumen: menentukan nama file, label, dan sheet yang dipilih otomatis */
  kind: ExcelDocKind;
  defaultTitleLine1: string;
  /** Baris kedua judul (kosongkan untuk judul satu baris) */
  defaultTitleLine2?: string;
  /** Tampilkan blok tanda tangan bawaan aplikasi? (BOQ: ya. OPM/Mancore: Excel biasanya sudah memuat nama penandatangan) */
  defaultShowSign: boolean;
  /**
   * Khusus BAUT: blok tanda tangan DUA PIHAK (kiri: Telkom Infrastruktur Indonesia, kanan: Telkom Akses beserta
   * kota & tanggal), seperti contoh dokumen. Kosong/false = satu penandatangan seperti biasa (LACT).
   */
  dualSign?: boolean;
}

const KINDS: Record<ExcelDocKind, { fileTag: string; imageLabel: string; imagePrompt: string; defaultSheets: 'first' | 'all' }> = {
  boq: {
    fileTag: 'BOQ',
    imageLabel: 'Gambar Tabel BOQ (screenshot/scan dari Excel)',
    imagePrompt: 'Unggah gambar tabel BOQ disini',
    defaultSheets: 'first',
  },
  opm: {
    fileTag: 'OPM',
    imageLabel: 'Gambar Data Pengukuran OPM (screenshot/scan dari Excel)',
    imagePrompt: 'Unggah gambar data pengukuran OPM disini',
    defaultSheets: 'all',
  },
  mancore: {
    fileTag: 'Mancore',
    imageLabel: 'Gambar Lampiran Mancore (screenshot/scan tabel OLT/FTM, FEEDER/ODC, DISTRIBUSI/ODP dari Excel)',
    imagePrompt: 'Unggah gambar lampiran mancore disini',
    defaultSheets: 'first',
  },
};

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

const CONTENT_WIDTH = 714;
const FRAME_HEIGHT_TWO_LINE = 690;
const FRAME_HEIGHT_ONE_LINE = 722;
const SIGN_HEIGHT = 250;
const SIGN_HEIGHT_DUAL = 215;

export default function ExcelDocForm({
  docTitle,
  pageTitle,
  activeMenu,
  kind,
  defaultTitleLine1,
  defaultTitleLine2,
  defaultShowSign,
  dualSign = false,
}: ExcelDocFormProps) {
  const info = KINDS[kind];
  const inputId = `xdoc-${kind}-excel`;

  const [project, setProject] = useSharedProject(emptyProject);
  const [titleLine1, setTitleLine1] = useState(defaultTitleLine1);
  const [titleLine2, setTitleLine2] = useState(defaultTitleLine2 ?? '');
  const twoLines = defaultTitleLine2 !== undefined;

  // Sumber isi: file Excel (utama) atau satu gambar (cadangan)
  const [source, setSource] = useState<'excel' | 'image'>('excel');
  const [workbook, setWorkbook] = useState<WorkbookModel | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);

  const [showSign, setShowSign] = useState(defaultShowSign);
  const [tanggalISO, setTanggalISO] = useState('');
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [jabatanBaris1, setJabatanBaris1] = useState(dualSign ? DEFAULT_RIGHT_PARTY.jabatanBaris1 : 'WASPANG');
  const [jabatanBaris2, setJabatanBaris2] = useState(dualSign ? DEFAULT_RIGHT_PARTY.jabatanBaris2 : 'PT. TELKOM AKSES');
  const [kota, setKota] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [leftParty, setLeftParty] = useState<SignParty>(DEFAULT_LEFT_PARTY);

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportOpts, setExportOpts] = useState<SimpleExportOptions>(DEFAULT_SIMPLE_EXPORT_OPTIONS);

  const handleProjectChange = (field: keyof ProjectData, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  // ---------- Tabel dari tiap sheet (dihitung sekali per file) ----------
  const tables = useMemo(() => {
    const map = new Map<string, SheetTable | null>();
    workbook?.sheets.forEach((s) => {
      const t = buildSheetTable(s);
      map.set(s.name, t && kind === 'opm' ? prepareOpmTable(t, { dropTrailer: showSign }) : t);
    });
    return map;
  }, [workbook, kind, showSign]);

  const sheetInfos: SheetInfo[] = useMemo(
    () =>
      (workbook?.sheets ?? []).map((s) => {
        const t = tables.get(s.name);
        return { name: s.name, hidden: s.hidden, rows: t?.rows.length ?? 0, cols: t?.colWidths.length ?? 0, hasPrintArea: !!s.printArea };
      }),
    [workbook, tables]
  );

  // ---------- Halaman hasil: tiap sheet yang dipilih jadi satu atau beberapa halaman ----------
  const frameHeight = (twoLines ? FRAME_HEIGHT_TWO_LINE : FRAME_HEIGHT_ONE_LINE) - (showSign ? (dualSign ? SIGN_HEIGHT_DUAL : SIGN_HEIGHT) : 0);
  const excelPages = useMemo(() => {
    if (!workbook) return [];
    const out: { key: string; table: SheetTable; rows: number[]; zoom: number }[] = [];
    for (const s of workbook.sheets) {
      if (!selected.has(s.name)) continue;
      const base = tables.get(s.name);
      if (!base) continue;
      const zoom = Math.min(1, CONTENT_WIDTH / base.totalWidth);
      const t = kind === 'opm' ? stretchRowsToFit(base, zoom, frameHeight) : base;
      paginateTable(t, zoom, frameHeight).forEach((rows, i) => out.push({ key: `${s.name}-${i}`, table: t, rows, zoom }));
    }
    return out;
  }, [workbook, selected, tables, frameHeight, kind]);

  const totalPages = source === 'excel' ? excelPages.length : image ? 1 : 0;

  // ---------- Impor Excel ----------
  const handleExcelFiles = async (files: File[]) => {
    if (importLoading || files.length === 0) return;
    const file = files.find((f) => /\.(xlsx|xlsm)$/i.test(f.name));
    if (!file) {
      const msg = files.some((f) => /\.xls$/i.test(f.name))
        ? 'Format .xls (Excel lama) belum bisa dibaca. Buka di Excel, lalu simpan sebagai .xlsx.'
        : 'Pilih file Excel berformat .xlsx.';
      setImportError(msg);
      showToast(msg, 'error');
      return;
    }
    setImportLoading(true);
    setImportError('');
    try {
      const wb = await readXlsx(file, file.name);
      const visible = wb.sheets.filter((s) => !s.hidden && buildSheetTable(s));
      if (visible.length === 0) {
        throw new Error('Tidak ada sheet berisi data yang bisa ditampilkan.');
      }
      const chosen = info.defaultSheets === 'all' ? visible : [visible[0]];
      setWorkbook(wb);
      setSelected(new Set(chosen.map((s) => s.name)));
      showToast(`File Excel "${file.name}" berhasil dimuat.`, 'success');
    } catch (err) {
      console.error(err);
      setWorkbook(null);
      setSelected(new Set());
      const msg =
        err instanceof Error && err.message.startsWith('Tidak ada sheet')
          ? err.message
          : 'File Excel tidak bisa dibaca. Pastikan file .xlsx tidak rusak dan tidak dikunci password.';
      setImportError(msg);
      showToast(msg, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const toggleSheet = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ---------- Gambar (cadangan) ----------
  const handleImageChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_ORIGINAL_BYTES) {
      showToast(
        `Gambar ${file.name} (${formatBytes(file.size)}) lebih dari ${MAX_ORIGINAL_MB} MB. Kompres dulu lewat menu Kompres Foto.`,
        'error'
      );
      return;
    }
    try {
      setImage({ file, preview: await compressImage(file) });
      showToast(`Gambar ${info.fileTag} berhasil diunggah.`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Gambar "${file.name}" tidak bisa dibuka. Pastikan formatnya JPG atau PNG.`, 'error');
    }
  };

  const handleSignatureChange = async (file: File | null) => {
    if (!file) return;
    try {
      setSignatureDataUrl(await compressImage(file));
      showToast('Foto tanda tangan berhasil diunggah.', 'success');
    } catch (err) {
      console.error(err);
      showToast(`Foto tanda tangan "${file.name}" tidak bisa dibuka. Pastikan formatnya JPG atau PNG.`, 'error');
    }
  };

  const patchLeft = (p: Partial<SignParty>) => setLeftParty((prev) => ({ ...prev, ...p }));
  const patchRight = (p: Partial<SignParty>) => {
    if (p.nama !== undefined) setNama(p.nama);
    if (p.nik !== undefined) setNik(p.nik);
    if (p.jabatanBaris1 !== undefined) setJabatanBaris1(p.jabatanBaris1);
    if (p.jabatanBaris2 !== undefined) setJabatanBaris2(p.jabatanBaris2);
    if (p.signatureDataUrl !== undefined) setSignatureDataUrl(p.signatureDataUrl);
  };

  const handlePreview = () => {
    if (titleLine1.trim() === '') {
      showToast('Mohon isi judul dokumen terlebih dahulu.', 'error');
      focusAndShake(document.getElementById(twoLines ? `${inputId}-title-1` : `${inputId}-title`));
      return;
    }
    if (twoLines && titleLine2.trim() === '') {
      showToast('Mohon isi judul dokumen baris 2 terlebih dahulu.', 'error');
      focusAndShake(document.getElementById(`${inputId}-title-2`));
      return;
    }
    if (Object.values(project).some((v) => v.trim() === '')) {
      showToast('Mohon lengkapi semua data proyek terlebih dahulu.', 'error');
      const emptyField = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          `#${inputId}-project-fields input, #${inputId}-project-fields select`
        )
      ).find((el) => el.value.trim() === '');
      focusAndShake(emptyField ?? null);
      return;
    }
    if (source === 'excel' && excelPages.length === 0) {
      showToast(workbook ? 'Mohon centang minimal satu sheet.' : 'Mohon impor file Excel terlebih dahulu.', 'error');
      focusAndShake(document.querySelector<HTMLElement>('.xdoc-dropzone, .xdoc-import'));
      return;
    }
    if (source === 'image' && !image) {
      showToast('Mohon unggah gambar terlebih dahulu.', 'error');
      focusAndShake(document.querySelector<HTMLElement>('.xdoc-dropzone'));
      return;
    }
    if (showSign) {
      if (!tanggalISO) {
        showToast('Mohon pilih tanggal untuk blok tanda tangan (atau matikan blok tanda tangan).', 'error');
        focusAndShake(document.getElementById(`${inputId}-tanggal`));
        return;
      }
      if (kota.trim() === '') {
        showToast('Mohon isi kota untuk baris tanda tangan (atau matikan blok tanda tangan).', 'error');
        focusAndShake(document.getElementById(`${inputId}-kota`));
        return;
      }
      if (dualSign && (leftParty.nama.trim() === '' || leftParty.nik.trim() === '')) {
        showToast('Mohon lengkapi Nama dan NIK penandatangan kiri (atau matikan blok tanda tangan).', 'error');
        const emptySign = Array.from(
          document.querySelectorAll<HTMLInputElement>('.evidence-form input[type="text"]')
        ).find((el) => el.value.trim() === '');
        focusAndShake(emptySign ?? null);
        return;
      }
      if (nama.trim() === '' || nik.trim() === '') {
        showToast(
          dualSign
            ? 'Mohon lengkapi Nama dan NIK penandatangan kanan (atau matikan blok tanda tangan).'
            : 'Mohon lengkapi Nama dan NIK untuk blok tanda tangan (atau matikan blok tanda tangan).',
          'error'
        );
        if (!dualSign) {
          focusAndShake(document.getElementById(nama.trim() === '' ? `${inputId}-nama` : `${inputId}-nik`));
        } else {
          const emptySign = Array.from(
            document.querySelectorAll<HTMLInputElement>('.evidence-form input[type="text"]')
          ).find((el) => el.value.trim() === '');
          focusAndShake(emptySign ?? null);
        }
        return;
      }
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const safeName = (project.lokasi || project.proyek || 'dokumen').trim().replace(/\s+/g, '_');
      const originals: Record<string, Blob> = {};
      if (source === 'image' && image) originals['xdoc-image'] = image.file;
      await generatePdfFromElement(
        'pdf-xdoc-content',
        buildPdfFileName(exportOpts, `${docTitle}_${info.fileTag}_${safeName}`),
        originals,
        undefined,
        QUALITY_PRESETS[exportOpts.quality]
      );
      showToast(`${info.fileTag} ${docTitle} berhasil diunduh.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat PDF, coba lagi.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const signProps = {
    showSign,
    tanggalISO,
    nama,
    nik,
    jabatanBaris1,
    jabatanBaris2,
    kota,
    signatureDataUrl,
    leftParty: dualSign ? leftParty : undefined,
  };
  const pageProps = {
    showLogos: exportOpts.showLogos,
    logoSize: exportOpts.logoSize,
    titleLine1,
    titleLine2: twoLines ? titleLine2 : undefined,
    project,
    totalPages,
    ...signProps,
  };

  // ======================= Preview =======================
  if (mode === 'preview') {
    return (
      <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
        <div className="evidence-preview-actions">
          <button className="evidence-btn-secondary" onClick={() => setMode('form')}>
            ← Kembali Edit
          </button>
          <button className="evidence-submit-btn" onClick={handleDownload} disabled={isProcessing}>
            {isProcessing ? 'Memproses...' : `Unduh ${info.fileTag} ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR div ber-id pdf-..., jadi tidak ikut masuk PDF */}
        <SimpleExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-xdoc-content">
          {source === 'excel' ? (
            excelPages.map((p, i) => (
              <div key={p.key}>
                <ExcelDocPage {...pageProps} pageNumber={i + 1}>
                  <ExcelTable table={p.table} rowIndices={p.rows} zoom={p.zoom} />
                </ExcelDocPage>
                {i < excelPages.length - 1 && <div className="pdf-page-gap">— Akhir Halaman {i + 1} —</div>}
              </div>
            ))
          ) : (
            <ExcelDocPage {...pageProps} pageNumber={1}>
              {image && <img className="pdf-xdoc-image" src={image.preview} alt={info.fileTag} data-evidence-id="xdoc-image" />}
            </ExcelDocPage>
          )}
        </div>
      </MainLayout>
    );
  }

  // ======================= Form =======================
  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        {twoLines ? (
          <div className="evidence-form-fields">
            <label>
              Judul Dokumen — Baris 1
              <input id={`${inputId}-title-1`} type="text" value={titleLine1} onChange={(e) => setTitleLine1(e.target.value)} />
            </label>
            <label>
              Judul Dokumen — Baris 2
              <input id={`${inputId}-title-2`} type="text" value={titleLine2} onChange={(e) => setTitleLine2(e.target.value)} />
            </label>
          </div>
        ) : (
          <div className="evidence-heading-field">
            <label htmlFor={`${inputId}-title`}>Judul Dokumen</label>
            <input
              id={`${inputId}-title`}
              type="text"
              value={titleLine1}
              onChange={(e) => setTitleLine1(e.target.value)}
              placeholder="Ketik disini"
            />
          </div>
        )}

        <div id={`${inputId}-project-fields`} className="evidence-form-fields">
          <label>
            Proyek
            <input type="text" value={project.proyek} onChange={(e) => handleProjectChange('proyek', e.target.value)} placeholder="Ketik disini" />
          </label>
          <label>
            Kontrak
            <input type="text" value={project.kontrak} onChange={(e) => handleProjectChange('kontrak', e.target.value)} placeholder="Ketik disini" />
          </label>
          <label>
            Surat Pesanan
            <input type="text" value={project.suratPesanan} onChange={(e) => handleProjectChange('suratPesanan', e.target.value)} placeholder="Ketik disini" />
          </label>
          <label>
            District
            <DistrictSelect value={project.district} onChange={(v) => handleProjectChange('district', v)} />
          </label>
          <label>
            Lokasi
            <input type="text" value={project.lokasi} onChange={(e) => handleProjectChange('lokasi', e.target.value)} placeholder="Ketik disini" />
          </label>
          <label>
            Pelaksana
            <input type="text" value={project.pelaksana} onChange={(e) => handleProjectChange('pelaksana', e.target.value)} placeholder="Ketik disini" />
          </label>
        </div>

        <div className="evidence-heading-field">
          <label>Isi Dokumen</label>
          <div className="xdoc-source">
            <button type="button" className={`xdoc-source-btn${source === 'excel' ? ' active' : ''}`} onClick={() => setSource('excel')}>
              Import Excel (.xlsx)
            </button>
            <button type="button" className={`xdoc-source-btn${source === 'image' ? ' active' : ''}`} onClick={() => setSource('image')}>
              Gambar (screenshot/scan)
            </button>
          </div>

          {source === 'excel' ? (
            <ExcelImportBox
              inputId={inputId}
              loading={importLoading}
              error={importError}
              fileName={workbook?.fileName ?? ''}
              sheets={sheetInfos}
              selected={selected}
              onFiles={handleExcelFiles}
              onToggle={toggleSheet}
              onClear={() => {
                setWorkbook(null);
                setSelected(new Set());
                setImportError('');
              }}
            />
          ) : (
            <div className="xdoc-import">
              <label htmlFor={`${inputId}-img`} className="xdoc-dropzone">
                {image ? (
                  <img src={image.preview} alt={info.fileTag} className="xdoc-image-preview" />
                ) : (
                  <>
                    <span className="xdoc-dropzone-icon">⬆</span>
                    <span className="xdoc-dropzone-title">{info.imagePrompt}</span>
                  </>
                )}
              </label>
              <input
                id={`${inputId}-img`}
                type="file"
                accept="image/*"
                className="xdoc-file-input"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  handleImageChange(f);
                }}
              />
              <p className="xdoc-hint">{info.imageLabel}</p>
            </div>
          )}
          {totalPages > 0 && <p className="xdoc-hint">Hasil: {totalPages} halaman.</p>}
        </div>

        <div className="evidence-heading-field">
          <label className="xdoc-check">
            <input type="checkbox" checked={showSign} onChange={(e) => setShowSign(e.target.checked)} />
            {dualSign
              ? 'Tampilkan blok tanda tangan 2 pihak (kota, tanggal, nama, NIK, tanda tangan)'
              : 'Tampilkan blok tanda tangan (tanggal, nama, NIK, tanda tangan)'}
          </label>
          {!showSign && (
            <p className="xdoc-hint">
              Dimatikan karena file Excel {kind === 'boq' ? '' : 'OPM/Mancore '}biasanya sudah memuat nama penandatangan di bagian bawah tabelnya.
              Nyalakan kalau mau memakai blok tanda tangan dari aplikasi.
            </p>
          )}
        </div>

        {showSign && dualSign && (
          <>
            <div className="evidence-form-fields" style={{ marginTop: 4 }}>
              <label>
                Tanggal
                <input id={`${inputId}-tanggal`} type="date" value={tanggalISO} onChange={(e) => setTanggalISO(e.target.value)} />
              </label>
              <label>
                Kota (untuk baris tanda tangan)
                <input id={`${inputId}-kota`} type="text" value={kota} onChange={(e) => setKota(e.target.value)} placeholder="Contoh: Surabaya" />
              </label>
            </div>
            <DualSignFields
              idPrefix={inputId}
              left={leftParty}
              right={{ nama, nik, jabatanBaris1, jabatanBaris2, signatureDataUrl }}
              onLeftChange={patchLeft}
              onRightChange={patchRight}
            />
          </>
        )}

        {showSign && !dualSign && (
          <>
            <div className="evidence-form-fields" style={{ marginTop: 4 }}>
              <label>
                Tanggal
                <input id={`${inputId}-tanggal`} type="date" value={tanggalISO} onChange={(e) => setTanggalISO(e.target.value)} />
              </label>
              <label>
                Kota (untuk baris tanda tangan)
                <input id={`${inputId}-kota`} type="text" value={kota} onChange={(e) => setKota(e.target.value)} placeholder="Contoh: Surabaya" />
              </label>
              <label>
                Nama Penandatangan
                <input id={`${inputId}-nama`} type="text" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Ketik disini" />
              </label>
              <label>
                NIK
                <input id={`${inputId}-nik`} type="text" value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Ketik disini" />
              </label>
              <label>
                Jabatan — Baris 1
                <input type="text" value={jabatanBaris1} onChange={(e) => setJabatanBaris1(e.target.value)} placeholder="Contoh: WASPANG" />
              </label>
              <label>
                Jabatan — Baris 2
                <input type="text" value={jabatanBaris2} onChange={(e) => setJabatanBaris2(e.target.value)} placeholder="Contoh: PT. TELKOM AKSES" />
              </label>
            </div>

            <div className="evidence-heading-field">
              <label htmlFor={`${inputId}-sign`}>Tanda Tangan (opsional, foto atau scan)</label>
              <input
                id={`${inputId}-sign`}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  handleSignatureChange(f);
                }}
              />
              {signatureDataUrl && (
                <img src={signatureDataUrl} alt="Pratinjau tanda tangan" style={{ maxWidth: 220, maxHeight: 90, marginTop: 8, display: 'block' }} />
              )}
            </div>
          </>
        )}

        <button className="evidence-submit-btn" onClick={handlePreview}>
          Lihat Preview
        </button>
      </div>
    </MainLayout>
  );
}