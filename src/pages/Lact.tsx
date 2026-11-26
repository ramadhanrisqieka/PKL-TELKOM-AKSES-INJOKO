import { useSearchParams } from 'react-router-dom';
import EvidenceForm from '../components/EvidenceForm';
import CoverForm from '../components/CoverForm';
import DaftarIsiForm from '../components/DaftarIsiForm';
import BeritaAcaraForm from '../components/BeritaAcaraForm';
import OtdrForm from '../components/OtdrForm';
import KmlForm from '../components/KmlForm';
import ExcelDocForm from '../components/ExcelDocForm';
import PdfImportForm from '../components/PdfImportForm';

export default function Lact() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  // Menu "Cover", "Daftar Isi", "Laporan Commisioning Test", dan "BOQ"
  // (empat submenu pertama Tools LACT) memakai form & halaman tersendiri,
  // terpisah dari EvidenceForm yang menangani upload evidence.
  if (mode === 'cover') {
    return (
      <CoverForm
        docTitle="LACT"
        pageTitle="Buat LACT — Cover"
        activeMenu="lact-builder"
        defaultTitleLine1="LAPORAN COMMISSIONING TEST"
        defaultTitleLine2="(LACT)"
      />
    );
  }

  if (mode === 'daftar-isi') {
    return (
      <DaftarIsiForm
        docTitle="LACT"
        pageTitle="Buat LACT — Daftar Isi"
        activeMenu="lact-builder"
        defaultTitleLine1="DAFTAR ISI"
        defaultTitleLine2="DOKUMEN LAPORAN COMMISIONING TEST"
        defaultTitleLine3="(LACT)"
        defaultItems={[
          'Laporan Commisioning Test',
          'Hasil Ukur OPM & OTDR (End To End Sesuai SOW)',
          'Lampiran Mancore',
          'Berita Acara Lapangan & Dokumen Pendukung Lainnya',
        ]}
      />
    );
  }

  if (mode === 'berita-acara') {
    return (
      <BeritaAcaraForm
        docTitle="LACT"
        pageTitle="Buat LACT — Laporan Commisioning Test"
        activeMenu="lact-builder"
        defaultDocHeading="LAPORAN COMMISIONING TEST"
        defaultClosingText="Demikian Berita Acara Commisioning Test dan Hasil Ukur ini dibuat dengan sebenarnya dan dapat dipertanggung jawabkan."
      />
    );
  }

  if (mode === 'boq') {
    return (
      <ExcelDocForm
        key="boq"
        kind="boq"
        docTitle="LACT"
        pageTitle="Buat LACT — BOQ"
        activeMenu="lact-builder"
        defaultTitleLine1="BILL OF QUANTITY COMMISIONING TEST"
        defaultShowSign
      />
    );
  }

  if (mode === 'opm') {
    return (
      <ExcelDocForm
        key="opm"
        kind="opm"
        docTitle="LACT"
        pageTitle="Buat LACT — Data Pengukuran OPM"
        activeMenu="lact-builder"
        defaultTitleLine1="LAMPIRAN DATA PENGUKURAN OPM"
        defaultTitleLine2="PROJECT OUTSIDE PLANT FIBER OPTIC"
        defaultShowSign={false}
      />
    );
  }

  if (mode === 'otdr') {
    return (
      <OtdrForm
        docTitle="LACT"
        pageTitle="Buat LACT — Import OTDR"
        activeMenu="lact-builder"
        defaultTitleLine1="LAMPIRAN HASIL UKUR OTDR"
      />
    );
  }

  if (mode === 'mancore') {
    return (
      <ExcelDocForm
        key="mancore"
        kind="mancore"
        docTitle="LACT"
        pageTitle="Buat LACT — Lampiran Mancore"
        activeMenu="lact-builder"
        defaultTitleLine1="LAMPIRAN MANCORE"
        defaultShowSign={false}
      />
    );
  }

  if (mode === 'kml') {
    return (
      <KmlForm
        docTitle="LACT"
        pageTitle="Buat LACT — Lampiran KML"
        activeMenu="lact-builder"
        defaultDocHeading="LAMPIRAN KML"
      />
    );
  }

  if (mode === 'abd') {
    return (
      <PdfImportForm
        key="abd"
        docTitle="LACT"
        pageTitle="Buat LACT — ABD"
        activeMenu="lact-builder"
        sectionLabel="ABD"
        fileTag="ABD"
      />
    );
  }

  return (
    <EvidenceForm
      docTitle="LACT"
      pageTitle="Buat LACT"
      activeMenu="lact-builder"
    />
  );
}
