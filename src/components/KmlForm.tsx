import { useState } from 'react';
import MainLayout from './MainLayout';
import KmlPage from './KmlPage';
import SimpleExportOptionsPanel, {
  DEFAULT_SIMPLE_EXPORT_OPTIONS,
  type SimpleExportOptions,
} from './SimpleExportOptions';
import { QUALITY_PRESETS, buildPdfFileName } from './ExportOptions';
import { compressImage } from '../utils/imageCompress';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import type { ProjectData } from '../types/evidence';
import '../assets/style_Kml.css';
import { useSharedProject } from '../utils/projectStore';
import DistrictSelect from './DistrictSelect';

interface KmlFormProps {
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file yang diunduh */
  docTitle: string;
  /** Judul yang tampil di kop halaman aplikasi, mis. "Buat LACT — Lampiran KML" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' — supaya sidebar menyorot menu yang benar */
  activeMenu: string;
  /** Judul dokumen di kop halaman PDF, mis. "LAMPIRAN KML" */
  defaultDocHeading: string;
}

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

export default function KmlForm({ docTitle, pageTitle, activeMenu, defaultDocHeading }: KmlFormProps) {
  const [project, setProject] = useSharedProject(emptyProject);
  const [docHeading, setDocHeading] = useState(defaultDocHeading);

  const [kmlImageFile, setKmlImageFile] = useState<File | null>(null);
  const [kmlImagePreview, setKmlImagePreview] = useState<string | null>(null);

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportOpts, setExportOpts] = useState<SimpleExportOptions>(
    DEFAULT_SIMPLE_EXPORT_OPTIONS
  );

  const handleProjectChange = (field: keyof ProjectData, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const handleKmlImageChange = async (file: File | null) => {
    if (!file) return;
    try {
      const preview = await compressImage(file);
      setKmlImageFile(file);
      setKmlImagePreview(preview);
      showToast('Gambar lampiran KML berhasil diunggah.', 'success');
    } catch (err) {
      console.error(err);
      showToast(`Gambar "${file.name}" tidak bisa dibuka. Pastikan formatnya JPG atau PNG.`, 'error');
    }
  };

  const handlePreview = () => {
    if (docHeading.trim() === '') {
      showToast('Mohon isi judul dokumen terlebih dahulu.', 'error');
      focusAndShake(document.getElementById('kml-heading'));
      return;
    }
    const projectBelumLengkap = Object.values(project).some((v) => v.trim() === '');
    if (projectBelumLengkap) {
      showToast('Mohon lengkapi semua data proyek terlebih dahulu.', 'error');
      const emptyField = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          '#kml-project-fields input, #kml-project-fields select'
        )
      ).find((el) => el.value.trim() === '');
      focusAndShake(emptyField ?? null);
      return;
    }
    if (!kmlImagePreview) {
      showToast('Mohon unggah gambar lampiran KML terlebih dahulu.', 'error');
      focusAndShake(document.querySelector<HTMLElement>('.kml-image-upload-box'));
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const safeName = (project.lokasi || project.proyek || 'dokumen').trim().replace(/\s+/g, '_');
      const originals: Record<string, Blob> = kmlImageFile
        ? { 'kml-image': kmlImageFile }
        : {};
      await generatePdfFromElement(
        'pdf-kml-content',
        buildPdfFileName(exportOpts, `${docTitle}_KML_${safeName}`),
        originals,
        undefined,
        QUALITY_PRESETS[exportOpts.quality]
      );
      showToast(`KML ${docTitle} berhasil diunduh.`, 'success');
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
            {isProcessing ? 'Memproses...' : `Unduh KML ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR div ber-id pdf-..., jadi tidak ikut masuk PDF */}
        <SimpleExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-kml-content">
          <KmlPage
            showLogos={exportOpts.showLogos}
            logoSize={exportOpts.logoSize}
            docTitle={docHeading}
            project={project}
            kmlImageDataUrl={kmlImagePreview}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-heading-field">
          <label htmlFor="kml-heading">Judul Dokumen</label>
          <input
            id="kml-heading"
            type="text"
            value={docHeading}
            onChange={(e) => setDocHeading(e.target.value)}
            placeholder="Contoh: LAMPIRAN KML"
          />
        </div>

        <div id="kml-project-fields" className="evidence-form-fields">
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
          <label htmlFor="kml-image-upload">
            Gambar Lampiran KML (screenshot Google Earth: jalur kabel, titik ODC/ODP, kotak pengukuran jarak)
          </label>
          <label htmlFor="kml-image-upload" className="kml-image-upload-box">
            {kmlImagePreview ? (
              <img src={kmlImagePreview} alt="Pratinjau lampiran KML" />
            ) : (
              <>
                <span className="evidence-upload-icon">⬆</span>
                <span className="evidence-upload-text">Unggah gambar lampiran KML disini</span>
              </>
            )}
          </label>
          <input
            id="kml-image-upload"
            type="file"
            accept="image/*"
            className="evidence-upload-input"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              handleKmlImageChange(file);
            }}
          />
          {kmlImagePreview && (
            <label htmlFor="kml-image-upload" className="evidence-change-photo-link">
              Ganti gambar
            </label>
          )}
        </div>

        <button className="evidence-submit-btn" onClick={handlePreview}>
          Lihat Preview
        </button>
      </div>
    </MainLayout>
  );
}