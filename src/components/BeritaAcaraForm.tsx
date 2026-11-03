import { useState } from 'react';
import MainLayout from './MainLayout';
import BeritaAcaraPage, { type ChoicePair } from './BeritaAcaraPage';
import { compressImage } from '../utils/imageCompress';
import { generatePdfFromElement } from '../utils/pdfFromElement';
import ExportOptionsPanel, {
  DEFAULT_EXPORT_OPTIONS,
  QUALITY_PRESETS,
  buildPdfFileName,
  type ExportOptions,
} from './ExportOptions';
import type { ProjectData } from '../types/evidence';
import '../assets/style_BeritaAcara.css';

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
}

const emptyProject: ProjectData = {
  proyek: '',
  kontrak: '',
  suratPesanan: '',
  district: '',
  lokasi: '',
  pelaksana: '',
};

// Dulu ada tombol pilih "telah/belum", "dapat/tidak dapat", "layak/tidak
// layak" (komponen ChoicePicker) yang bisa diklik user di form. Atas
// permintaan pembimbing, pilihan itu sekarang DIHILANGKAN dari form —
// hasilnya dipatenkan selalu "telah", "dapat", "layak" (yang lain otomatis
// tercoret), persis seperti contoh dokumen resminya. Lihat FIXED_CHOICE_*
// di bawah: kalau nanti pola dokumennya berubah, cukup ganti nilai di sana.
const FIXED_CHOICE_1: ChoicePair = { labels: ['telah', 'belum'], selected: 0 };
const FIXED_CHOICE_2A: ChoicePair = { labels: ['dapat', 'tidak dapat'], selected: 0 };
const FIXED_CHOICE_2B: ChoicePair = { labels: ['layak', 'tidak layak'], selected: 0 };

export default function BeritaAcaraForm({
  docTitle,
  pageTitle,
  activeMenu,
  defaultDocHeading,
  defaultClosingText,
}: BeritaAcaraFormProps) {
  const [project, setProject] = useState<ProjectData>(emptyProject);
  const [docHeading, setDocHeading] = useState(defaultDocHeading);

  const [tanggalISO, setTanggalISO] = useState('');
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [jabatanBaris1, setJabatanBaris1] = useState('WASPANG');
  const [jabatanBaris2, setJabatanBaris2] = useState('PT. TELKOM AKSES');
  const [kota, setKota] = useState('');

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
    } catch (err) {
      console.error(err);
      alert(`Foto tanda tangan "${file.name}" tidak bisa dibuka. Pastikan formatnya JPG atau PNG.`);
    }
  };

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
    if (!tanggalISO) {
      alert('Mohon pilih tanggal Berita Acara.');
      return;
    }
    if (nama.trim() === '' || nik.trim() === '') {
      alert('Mohon isi Nama dan NIK penandatangan.');
      return;
    }
    if (kota.trim() === '') {
      alert('Mohon isi kota untuk baris tanda tangan (mis. Surabaya).');
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
    } catch (err) {
      console.error(err);
      alert('Gagal membuat PDF, coba lagi.');
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
        <ExportOptionsPanel value={exportOpts} onChange={setExportOpts} showColumns={false} />

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

        <div className="evidence-form-fields">
          <label>
            Tanggal Berita Acara
            <input type="date" value={tanggalISO} onChange={(e) => setTanggalISO(e.target.value)} />
          </label>
          <label>
            Kota (untuk baris tanda tangan)
            <input
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

        <div className="evidence-form-fields">
          <label>
            Nama Penandatangan
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Ketik disini"
            />
          </label>
          <label>
            NIK
            <input
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

        {/*
          Dulu di sini ada "Poin 1" dan "Poin 2": tombol untuk memilih
          telah/belum, dapat/tidak dapat, layak/tidak layak. Atas permintaan
          pembimbing, bagian ini DIHAPUS dari form — hasilnya di PDF sekarang
          dipatenkan selalu "telah", "dapat", "layak" (lihat FIXED_CHOICE_*
          di atas komponen ini), sama seperti dokumen contoh resminya.
        */}

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