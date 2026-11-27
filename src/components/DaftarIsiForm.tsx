import { useState } from 'react';
import MainLayout from './MainLayout';
import DaftarIsiPage, { type DaftarIsiItem } from './DaftarIsiPage';
import SimpleExportOptionsPanel, {
  DEFAULT_SIMPLE_EXPORT_OPTIONS,
  type SimpleExportOptions,
} from './SimpleExportOptions';
import { QUALITY_PRESETS, buildPdfFileName } from './ExportOptions';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import '../assets/style_DaftarIsi.css';

interface DaftarIsiFormProps {
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file yang diunduh */
  docTitle: string;
  /** Judul yang tampil di kop halaman aplikasi, mis. "Buat LACT — Daftar Isi" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' — supaya sidebar menyorot menu yang benar */
  activeMenu: string;
  defaultTitleLine1: string;
  defaultTitleLine2: string;
  defaultTitleLine3: string;
  defaultItems: string[];
}

let idCounter = 0;
const generateId = () => `toc-${Date.now()}-${idCounter++}`;

export default function DaftarIsiForm({
  docTitle,
  pageTitle,
  activeMenu,
  defaultTitleLine1,
  defaultTitleLine2,
  defaultTitleLine3,
  defaultItems,
}: DaftarIsiFormProps) {
  const [titleLine1, setTitleLine1] = useState(defaultTitleLine1);
  const [titleLine2, setTitleLine2] = useState(defaultTitleLine2);
  const [titleLine3, setTitleLine3] = useState(defaultTitleLine3);
  const [items, setItems] = useState<DaftarIsiItem[]>(
    defaultItems.map((text) => ({ id: generateId(), text }))
  );

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportOpts, setExportOpts] = useState<SimpleExportOptions>(
    DEFAULT_SIMPLE_EXPORT_OPTIONS
  );

  const handleItemChange = (id: string, value: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text: value } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { id: generateId(), text: '' }]);
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

  const handlePreview = () => {
    if (titleLine1.trim() === '') {
      showToast('Mohon isi judul dokumen (baris 1, 2, dan 3).', 'error');
      focusAndShake(document.getElementById('toc-title-1'));
      return;
    }
    if (titleLine2.trim() === '') {
      showToast('Mohon isi judul dokumen (baris 1, 2, dan 3).', 'error');
      focusAndShake(document.getElementById('toc-title-2'));
      return;
    }
    if (titleLine3.trim() === '') {
      showToast('Mohon isi judul dokumen (baris 1, 2, dan 3).', 'error');
      focusAndShake(document.getElementById('toc-title-3'));
      return;
    }
    if (items.length === 0) {
      showToast('Tambahkan minimal 1 poin daftar isi.', 'error');
      focusAndShake(document.querySelector<HTMLElement>('.evidence-add-card'));
      return;
    }
    if (items.some((it) => it.text.trim() === '')) {
      showToast('Mohon isi semua poin daftar isi (atau hapus yang kosong).', 'error');
      const emptyPoint = Array.from(
        document.querySelectorAll<HTMLInputElement>('.evidence-label-input')
      ).find((el) => el.value.trim() === '');
      focusAndShake(emptyPoint ?? null);
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      await generatePdfFromElement(
        'pdf-toc-content',
        buildPdfFileName(exportOpts, `${docTitle}_DaftarIsi`),
        {},
        undefined,
        QUALITY_PRESETS[exportOpts.quality]
      );
      showToast(`Daftar Isi ${docTitle} berhasil diunduh.`, 'success');
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
            {isProcessing ? 'Memproses...' : `Unduh Daftar Isi ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR div ber-id pdf-..., jadi tidak ikut masuk PDF */}
        <SimpleExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-toc-content">
          <DaftarIsiPage
            showLogos={exportOpts.showLogos}
            logoSize={exportOpts.logoSize}
            titleLine1={titleLine1}
            titleLine2={titleLine2}
            titleLine3={titleLine3}
            items={items}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-heading-field">
          <label htmlFor="toc-title-1">Judul — Baris 1</label>
          <input
            id="toc-title-1"
            type="text"
            value={titleLine1}
            onChange={(e) => setTitleLine1(e.target.value)}
            placeholder="Contoh: DAFTAR ISI"
          />
        </div>
        <div className="evidence-heading-field">
          <label htmlFor="toc-title-2">Judul — Baris 2</label>
          <input
            id="toc-title-2"
            type="text"
            value={titleLine2}
            onChange={(e) => setTitleLine2(e.target.value)}
            placeholder="Contoh: DOKUMEN LAPORAN COMMISIONING TEST"
          />
        </div>
        <div className="evidence-heading-field">
          <label htmlFor="toc-title-3">Judul — Baris 3</label>
          <input
            id="toc-title-3"
            type="text"
            value={titleLine3}
            onChange={(e) => setTitleLine3(e.target.value)}
            placeholder={`Contoh: (${docTitle})`}
          />
        </div>

        <div className="evidence-sections">
          {items.map((item, index) => (
            <div key={item.id} className="evidence-section-card">
              <button
                type="button"
                className="evidence-remove-btn"
                onClick={() => handleRemoveItem(item.id)}
                title="Hapus poin ini"
              >
                ×
              </button>

              <input
                type="text"
                className="evidence-label-input"
                placeholder={`Poin ${index + 1}`}
                value={item.text}
                onChange={(e) => handleItemChange(item.id, e.target.value)}
              />

              <div className="evidence-bulk-actions">
                <button
                  type="button"
                  className="evidence-bulk-move"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  title="Geser ke atas"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="evidence-bulk-move"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  title="Geser ke bawah"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="evidence-add-card" onClick={handleAddItem}>
            + Tambah Poin
          </button>
        </div>

        <button className="evidence-submit-btn" onClick={handlePreview}>
          Lihat Preview
        </button>
      </div>
    </MainLayout>
  );
}