import { useState } from 'react';
import MainLayout from './MainLayout';
import BeritaAcaraPage, { type ChoicePair } from './BeritaAcaraPage';
import { compressImage } from '../utils/imageCompress';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import { focusAndShake, showToast } from '../utils/uiFeedback';
import ExportOptionsPanel, {
  DEFAULT_EXPORT_OPTIONS,
  QUALITY_PRESETS,
  buildPdfFileName,
  type ExportOptions,
} from './ExportOptions';
import type { ProjectData } from '../types/evidence';
import '../assets/style_BeritaAcara.css';
import { useSharedProject } from '../utils/projectStore';
import DistrictSelect from './DistrictSelect';
import DualSignFields from './DualSignFields';
import { DEFAULT_LEFT_PARTY, DEFAULT_RIGHT_PARTY, type SignParty } from './DualSignBlock';

interface BeritaAcaraFormProps {
  /** 'LACT' atau 'BAUT' — dipakai untuk nama file yang diunduh */
  docTitle: string;
  /** Judul yang tampil di kop halaman aplikasi, mis. "Buat LACT — Laporan Commisioning Test" */
  pageTitle: string;
  /** 'lact-builder' atau 'baut-builder' — supaya sidebar menyorot menu yang benar */
  activeMenu: string;
  /** Judul dokumen di kop halaman PDF, mis. "LAPORAN COMMISIONING TEST" */
  defaultDocHeading: string;
  defaultClosingText: string;
  /**
   * Khusus BAUT: blok tanda tangan DUA PIHAK (kiri: Telkom Infrastruktur Indonesia, kanan: Telkom Akses beserta
   * kota & tanggal), seperti contoh dokumen. Kosong/false = satu penandatangan seperti biasa (LACT).
   */
  dualSign?: boolean;
}

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

const FIXED_CHOICE_1: ChoicePair = { labels: ['telah', 'belum'], selected: 0 };
const FIXED_CHOICE_2A: ChoicePair = { labels: ['dapat', 'tidak dapat'], selected: 0 };
const FIXED_CHOICE_2B: ChoicePair = { labels: ['layak', 'tidak layak'], selected: 0 };

export default function BeritaAcaraForm({
  docTitle,
  pageTitle,
  activeMenu,
  defaultDocHeading,
  defaultClosingText,
  dualSign = false,
}: BeritaAcaraFormProps) {
  const [project, setProject] = useSharedProject(emptyProject);
  const [docHeading, setDocHeading] = useState(defaultDocHeading);

  const [tanggalISO, setTanggalISO] = useState('');
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [jabatanBaris1, setJabatanBaris1] = useState(dualSign ? DEFAULT_RIGHT_PARTY.jabatanBaris1 : 'WASPANG');
  const [jabatanBaris2, setJabatanBaris2] = useState(dualSign ? DEFAULT_RIGHT_PARTY.jabatanBaris2 : 'PT. TELKOM AKSES');
  const [kota, setKota] = useState('');
  // Pihak kiri (hanya dipakai kalau dualSign). Pihak kanan = nama/nik/jabatan/tanda tangan di atas.
  const [leftParty, setLeftParty] = useState<SignParty>(DEFAULT_LEFT_PARTY);

  const [closingText, setClosingText] = useState(defaultClosingText);

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportOpts, setExportOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);

  const handleProjectChange = (field: keyof ProjectData, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignatureChange = async (file: File | null) => {
    if (!file) return;
    try {
      const preview = await compressImage(file);
      setSignatureDataUrl(preview);
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
    if (docHeading.trim() === '') {
      showToast('Mohon isi judul dokumen terlebih dahulu.', 'error');
      focusAndShake(document.getElementById('ba-heading'));
      return;
    }
    const projectBelumLengkap = Object.values(project).some((v) => v.trim() === '');
    if (projectBelumLengkap) {
      showToast('Mohon lengkapi semua data proyek terlebih dahulu.', 'error');
      const emptyField = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          '#ba-project-fields input, #ba-project-fields select'
        )
      ).find((el) => el.value.trim() === '');
      focusAndShake(emptyField ?? null);
      return;
    }
    if (!tanggalISO) {
      showToast('Mohon pilih tanggal Berita Acara.', 'error');
      focusAndShake(document.getElementById('ba-tanggal'));
      return;
    }
    if (kota.trim() === '') {
      showToast('Mohon isi kota untuk baris tanda tangan (mis. Surabaya).', 'error');
      focusAndShake(document.getElementById('ba-kota'));
      return;
    }
    if (dualSign && (leftParty.nama.trim() === '' || leftParty.nik.trim() === '')) {
      showToast('Mohon isi Nama dan NIK penandatangan kiri.', 'error');
      const emptySign = Array.from(
        document.querySelectorAll<HTMLInputElement>('.evidence-form input[type="text"]')
      ).find((el) => el.id !== 'ba-closing' && el.value.trim() === '');
      focusAndShake(emptySign ?? null);
      return;
    }
    if (nama.trim() === '' || nik.trim() === '') {
      showToast(
        dualSign ? 'Mohon isi Nama dan NIK penandatangan kanan.' : 'Mohon isi Nama dan NIK penandatangan.',
        'error'
      );
      if (!dualSign) {
        focusAndShake(document.getElementById(nama.trim() === '' ? 'ba-nama' : 'ba-nik'));
      } else {
        const emptySign = Array.from(
          document.querySelectorAll<HTMLInputElement>('.evidence-form input[type="text"]')
        ).find((el) => el.id !== 'ba-closing' && el.value.trim() === '');
        focusAndShake(emptySign ?? null);
      }
      return;
    }
    setMode('preview');
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const safeName = (project.lokasi || project.proyek || 'dokumen').trim().replace(/\s+/g, '_');
      await generatePdfFromElement(
        'pdf-ba-content',
        buildPdfFileName(exportOpts, `${docTitle}_BeritaAcara_${safeName}`),
        {},
        undefined,
        QUALITY_PRESETS[exportOpts.quality]
      );
      showToast(`Berita Acara ${docTitle} berhasil diunduh.`, 'success');
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
            {isProcessing ? 'Memproses...' : `Unduh ${docTitle} (PDF)`}
          </button>
        </div>

        {/* Panel opsi berada DI LUAR #pdf-ba-content, jadi tidak ikut masuk PDF */}
        <ExportOptionsPanel value={exportOpts} onChange={setExportOpts} />

        <div id="pdf-ba-content">
          <BeritaAcaraPage
            docTitle={docHeading}
            project={project}
            tanggalISO={tanggalISO}
            nama={nama}
            nik={nik}
            jabatanBaris1={jabatanBaris1}
            jabatanBaris2={jabatanBaris2}
            kota={kota}
            choice1={FIXED_CHOICE_1}
            choice2a={FIXED_CHOICE_2A}
            choice2b={FIXED_CHOICE_2B}
            closingText={closingText}
            signatureDataUrl={signatureDataUrl}
            leftParty={dualSign ? leftParty : undefined}
            options={exportOpts}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pageTitle={pageTitle} activeMenu={activeMenu}>
      <div className="evidence-form">
        <div className="evidence-heading-field">
          <label htmlFor="ba-heading">Judul Dokumen</label>
          <input
            id="ba-heading"
            type="text"
            value={docHeading}
            onChange={(e) => setDocHeading(e.target.value)}
            placeholder="Contoh: LAPORAN COMMISIONING TEST"
          />
        </div>

        <div id="ba-project-fields" className="evidence-form-fields">
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
            Tanggal Berita Acara
            <input id="ba-tanggal" type="date" value={tanggalISO} onChange={(e) => setTanggalISO(e.target.value)} />
          </label>
          <label>
            Kota (untuk baris tanda tangan)
            <input
              id="ba-kota"
              type="text"
              value={kota}
              onChange={(e) => setKota(e.target.value)}
              placeholder="Contoh: Surabaya"
            />
          </label>
        </div>
        <p className="evidence-section-desc">
          Hari, tanggal, bulan, dan tahun dalam kalimat pembuka akan terisi otomatis (mis. "Selasa,
          Delapan, September, Dua Ribu Dua Puluh Enam") dari tanggal di atas.
        </p>

        {dualSign ? (
          <DualSignFields idPrefix="ba" left={leftParty} right={{ nama, nik, jabatanBaris1, jabatanBaris2, signatureDataUrl }} onLeftChange={patchLeft} onRightChange={patchRight} />
        ) : (
          <>
            <div className="evidence-form-fields">
              <label>
                Nama Penandatangan
                <input
                  id="ba-nama"
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Ketik disini"
                />
              </label>
              <label>
                NIK
                <input
                  id="ba-nik"
                  type="text"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="Ketik disini"
                />
              </label>
              <label>
                Jabatan — Baris 1
                <input
                  type="text"
                  value={jabatanBaris1}
                  onChange={(e) => setJabatanBaris1(e.target.value)}
                  placeholder="Contoh: WASPANG"
                />
              </label>
              <label>
                Jabatan — Baris 2
                <input
                  type="text"
                  value={jabatanBaris2}
                  onChange={(e) => setJabatanBaris2(e.target.value)}
                  placeholder="Contoh: PT. TELKOM AKSES"
                />
              </label>
            </div>

            <div className="evidence-heading-field">
              <label htmlFor="ba-sign-upload">Tanda Tangan (opsional, foto atau scan)</label>
              <input
                id="ba-sign-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  handleSignatureChange(file);
                }}
              />
              {signatureDataUrl && (
                <img src={signatureDataUrl} alt="Pratinjau tanda tangan" className="ba-signature-preview" />
              )}
            </div>
          </>
        )}

        <div className="evidence-heading-field">
          <label htmlFor="ba-closing">Kalimat Penutup</label>
          <input
            id="ba-closing"
            type="text"
            value={closingText}
            onChange={(e) => setClosingText(e.target.value)}
          />
        </div>

        <button className="evidence-submit-btn" onClick={handlePreview}>
          Lihat Preview
        </button>
      </div>
    </MainLayout>
  );
}