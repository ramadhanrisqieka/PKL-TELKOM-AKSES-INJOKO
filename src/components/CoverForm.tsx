import { useState } from 'react';
import MainLayout from './MainLayout';
import CoverPage from './CoverPage';
import SimpleExportOptionsPanel, {
  DEFAULT_SIMPLE_EXPORT_OPTIONS,
  type SimpleExportOptions,
} from './SimpleExportOptions';
import { QUALITY_PRESETS, buildPdfFileName } from './ExportOptions';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import type { ProjectData } from '../types/evidence';
import '../assets/style_Cover.css';
import { useSharedProject } from '../utils/projectStore';
import DistrictSelect from './DistrictSelect';

interface CoverFormProps {
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file yang diunduh */
  docTitle: string;
  /** Judul yang tampil di kop halaman aplikasi, mis. "Buat LACT — Cover" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' — supaya sidebar menyorot menu yang benar */
  activeMenu: string;
  defaultTitleLine1: string;
  defaultTitleLine2: string;
}

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

export default function CoverForm({
  docTitle,
  pageTitle,
  activeMenu,
  defaultTitleLine1,
  defaultTitleLine2,
}: CoverFormProps) {
  const [project, setProject] = useSharedProject(emptyProject);
  const [titleLine1, setTitleLine1] = useState(defaultTitleLine1);
  const [titleLine2, setTitleLine2] = useState(defaultTitleLine2);
  const [partyLine1, setPartyLine1] = useState('PT. TELKOM INFRASTRUKTUR INDONESIA, Tbk.');
  const [partyLine2, setPartyLine2] = useState('PT. TELKOM AKSES');

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportOpts, setExportOpts] = useState<SimpleExportOptions>(
    DEFAULT_SIMPLE_EXPORT_OPTIONS
  );

  const handleProjectChange = (field: keyof ProjectData, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreview = () => {
    if (titleLine1.trim() === '') {
      showToast('Mohon isi judul dokumen (baris 1 dan baris 2).', 'error');
      focusAndShake(document.getElementById('cover-title-1'));
      return;
    }
    if (titleLine2.trim() === '') {
      showToast('Mohon isi judul dokumen (baris 1 dan baris 2).', 'error');
      focusAndShake(document.getElementById('cover-title-2'));
      return;
    }
    const projectBelumLengkap = Object.values(project).some((v) => v.trim() === '');
    if (projectBelumLengkap) {
      showToast('Mohon lengkapi semua data proyek terlebih dahulu.', 'error');
      const emptyField = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          '#cover-project-fields input, #cover-project-fields select'
        )
      ).find((el) => el.value.trim() === '');
      focusAndShake(emptyField ?? null);
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const safeName = (project.lokasi || project.proyek || 'dokumen').trim().replace(/\s+/g, '_');
      await generatePdfFromElement(
        'pdf-cover-content',
        buildPdfFileName(exportOpts, `${docTitle}_Cover_${safeName}`),
        {},
        undefined,
        QUALITY_PRESETS[exportOpts.quality]
      );
      showToast(`Cover ${docTitle} berhasil diunduh.`, 'success');
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
            {isProcessing ? 'Memproses...' : `Unduh Cover ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR div ber-id pdf-..., jadi tidak ikut masuk PDF */}
        <SimpleExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-cover-content">
          <CoverPage
            showLogos={exportOpts.showLogos}
            logoSize={exportOpts.logoSize}
            project={project}
            titleLine1={titleLine1}
            titleLine2={titleLine2}
            partyLine1={partyLine1}
            partyLine2={partyLine2}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-heading-field">
          <label htmlFor="cover-title-1">Judul Dokumen — Baris 1</label>
          <input
            id="cover-title-1"
            type="text"
            value={titleLine1}
            onChange={(e) => setTitleLine1(e.target.value)}
            placeholder="Contoh: LAPORAN COMMISSIONING TEST"
          />
        </div>
        <div className="evidence-heading-field">
          <label htmlFor="cover-title-2">Judul Dokumen — Baris 2</label>
          <input
            id="cover-title-2"
            type="text"
            value={titleLine2}
            onChange={(e) => setTitleLine2(e.target.value)}
            placeholder={`Contoh: (${docTitle})`}
          />
        </div>

        <div id="cover-project-fields" className="evidence-form-fields">
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

        <div className="evidence-form-fields">
          <label>
            Pihak Pertama (baris setelah "ANTARA")
            <input
              type="text"
              value={partyLine1}
              onChange={(e) => setPartyLine1(e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
          <label>
            Pihak Kedua (baris setelah "DENGAN")
            <input
              type="text"
              value={partyLine2}
              onChange={(e) => setPartyLine2(e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
        </div>

        <button className="evidence-submit-btn" onClick={handlePreview}>
          Lihat Preview
        </button>
      </div>
    </MainLayout>
  );
}