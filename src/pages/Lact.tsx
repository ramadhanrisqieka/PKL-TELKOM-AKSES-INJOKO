import { useSearchParams } from 'react-router-dom';
import EvidenceForm from '../components/EvidenceForm';
import CoverForm from '../components/CoverForm';
import DaftarIsiForm from '../components/DaftarIsiForm';
import BeritaAcaraForm from '../components/BeritaAcaraForm';
import BoqForm from '../components/BoqForm';
import OpmForm from '../components/OpmForm';
import MancoreForm from '../components/MancoreForm';
import KmlForm from '../components/KmlForm';

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
      <BoqForm
        docTitle="LACT"
        pageTitle="Buat LACT — BOQ"
        activeMenu="lact-builder"
        defaultDocHeading="BILL OF QUANTITY COMMISIONING TEST"
      />
    );
  }

  if (mode === 'opm') {
    return (
      <OpmForm
        docTitle="LACT"
        pageTitle="Buat LACT — Data Pengukuran OPM"
        activeMenu="lact-builder"
        defaultTitleLine1="LAMPIRAN DATA PENGUKURAN OPM"
        defaultTitleLine2="PROJECT OUTSIDE PLANT FIBER OPTIC"
      />
    );
  }

  if (mode === 'mancore') {
    return (
      <MancoreForm
        docTitle="LACT"
        pageTitle="Buat LACT — Lampiran Mancore"
        activeMenu="lact-builder"
        defaultDocHeading="LAMPIRAN MANCORE"
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

  return (
    <EvidenceForm
      docTitle="LACT"
      pageTitle="Buat LACT"
      activeMenu="lact-builder"
    />
  );
}