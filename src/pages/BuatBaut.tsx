import { useSearchParams } from 'react-router-dom';
import EvidenceForm from '../components/EvidenceForm';
import CoverForm from '../components/CoverForm';
import DaftarIsiForm from '../components/DaftarIsiForm';
import BeritaAcaraForm from '../components/BeritaAcaraForm';
import OtdrForm from '../components/OtdrForm';
import KmlForm from '../components/KmlForm';
import ExcelDocForm from '../components/ExcelDocForm';
import PdfImportForm from '../components/PdfImportForm';

export default function BuatBaut() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  // Tiga menu KHUSUS BAUT (tidak ada di LACT): NDE (setelah Cover), BA Tambah Kurang
  // (setelah BOQ), dan BA ABD (setelah Lampiran KML). Ketiganya import file PDF jadi
  // dan memakai satu komponen yang sama; `key` wajib berbeda supaya halaman yang sudah
  // diimpor di satu menu tidak ikut muncul di menu lain.
  if (mode === 'nde') {
    return (
      <PdfImportForm
        key="nde"
        docTitle="BAUT"
        pageTitle="Buat BAUT — NDE"
        activeMenu="baut-builder"
        sectionLabel="NDE"
        fileTag="NDE"
      />
    );
  }

  if (mode === 'ba-tambah-kurang') {
    return (
      <PdfImportForm
        key="ba-tambah-kurang"
        docTitle="BAUT"
        pageTitle="Buat BAUT — BA Tambah Kurang"
        activeMenu="baut-builder"
        sectionLabel="BA Tambah Kurang"
        fileTag="BA_Tambah_Kurang"
      />
    );
  }

  if (mode === 'abd') {
    return (
      <PdfImportForm
        key="abd"
        docTitle="BAUT"
        pageTitle="Buat BAUT — ABD"
        activeMenu="baut-builder"
        sectionLabel="ABD"
        fileTag="ABD"
      />
    );
  }

  if (mode === 'ba-abd') {
    return (
      <PdfImportForm
        key="ba-abd"
        docTitle="BAUT"
        pageTitle="Buat BAUT — BA ABD"
        activeMenu="baut-builder"
        sectionLabel="BA ABD"
        fileTag="BA_ABD"
      />
    );
  }

  // Menu "Cover", "Daftar Isi", "Berita Acara Uji Terima", dan "BOQ"
  // (empat submenu pertama Tools BAUT) memakai form & halaman tersendiri,
  // terpisah dari EvidenceForm yang menangani upload evidence.
  //
  // KHUSUS BAUT (tidak di LACT): Berita Acara Uji Terima, BOQ, Data Pengukuran OPM, dan
  // Lampiran Mancore memakai blok tanda tangan DUA PIHAK (prop `dualSign`): kiri PT. TELKOM
  // INFRASTRUKTUR INDONESIA, Tbk., kanan PT. TELKOM AKSES beserta kota & tanggal.
  if (mode === 'cover') {
    return (
      <CoverForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Cover"
        activeMenu="baut-builder"
        defaultTitleLine1="DOKUMEN BERITA ACARA UJI TERIMA"
        defaultTitleLine2="(BAUT)"
      />
    );
  }

  if (mode === 'daftar-isi') {
    return (
      <DaftarIsiForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Daftar Isi"
        activeMenu="baut-builder"
        defaultTitleLine1="DAFTAR ISI"
        defaultTitleLine2="DOKUMEN BERITA ACARA UJI TERIMA"
        defaultTitleLine3="(BAUT)"
        defaultItems={[
          'Berita Acara Uji Terima',
          'Lampiran Evident Pekerjaan',
          'Dokumen Pendukung Lainnya',
        ]}
      />
    );
  }

  if (mode === 'berita-acara') {
    return (
      <BeritaAcaraForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Berita Acara Uji Terima"
        activeMenu="baut-builder"
        defaultDocHeading="DOKUMEN BERITA ACARA UJI TERIMA"
        defaultClosingText="Demikian Berita Acara Uji Terima ini dibuat dengan sebenarnya dan dapat dipertanggung jawabkan."
        dualSign
      />
    );
  }

  if (mode === 'boq') {
    return (
      <ExcelDocForm
        key="boq"
        kind="boq"
        docTitle="BAUT"
        pageTitle="Buat BAUT — BOQ"
        activeMenu="baut-builder"
        defaultTitleLine1="BILL OF QUANTITY UJI TERIMA"
        defaultShowSign
        dualSign
      />
    );
  }

  if (mode === 'opm') {
    return (
      <ExcelDocForm
        key="opm"
        kind="opm"
        docTitle="BAUT"
        pageTitle="Buat BAUT — Data Pengukuran OPM"
        activeMenu="baut-builder"
        defaultTitleLine1="LAMPIRAN DATA PENGUKURAN OPM"
        defaultTitleLine2="PROJECT OUTSIDE PLANT FIBER OPTIC"
        defaultShowSign={false}
        dualSign
      />
    );
  }

  if (mode === 'otdr') {
    return (
      <OtdrForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Import OTDR"
        activeMenu="baut-builder"
        defaultTitleLine1="LAMPIRAN HASIL UKUR OTDR"
      />
    );
  }

  if (mode === 'mancore') {
    return (
      <ExcelDocForm
        key="mancore"
        kind="mancore"
        docTitle="BAUT"
        pageTitle="Buat BAUT — Lampiran Mancore"
        activeMenu="baut-builder"
        defaultTitleLine1="LAMPIRAN MANCORE"
        defaultShowSign={false}
        dualSign
      />
    );
  }

  if (mode === 'kml') {
    return (
      <KmlForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Lampiran KML"
        activeMenu="baut-builder"
        defaultDocHeading="LAMPIRAN KML"
      />
    );
  }

  return (
    <EvidenceForm
      docTitle="BAUT"
      pageTitle="Buat BAUT"
      activeMenu="baut-builder"
    />
  );
}
