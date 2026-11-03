import { useSearchParams } from 'react-router-dom';
import EvidenceForm from '../components/EvidenceForm';
import CoverForm from '../components/CoverForm';
import DaftarIsiForm from '../components/DaftarIsiForm';
import BeritaAcaraForm from '../components/BeritaAcaraForm';
import BoqForm from '../components/BoqForm';
import OpmForm from '../components/OpmForm';
import MancoreForm from '../components/MancoreForm';
import KmlForm from '../components/KmlForm';

export default function BuatBaut() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  // Menu "Cover", "Daftar Isi", "Berita Acara Uji Terima", dan "BOQ"
  // (empat submenu pertama Tools BAUT) memakai form & halaman tersendiri,
  // terpisah dari EvidenceForm yang menangani upload evidence.
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
      />
    );
  }

  if (mode === 'boq') {
    return (
      <BoqForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — BOQ"
        activeMenu="baut-builder"
        defaultDocHeading="BILL OF QUANTITY UJI TERIMA"
      />
    );
  }

  if (mode === 'opm') {
    return (
      <OpmForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Data Pengukuran OPM"
        activeMenu="baut-builder"
        defaultTitleLine1="LAMPIRAN DATA PENGUKURAN OPM"
        defaultTitleLine2="PROJECT OUTSIDE PLANT FIBER OPTIC"
      />
    );
  }

  if (mode === 'mancore') {
    return (
      <MancoreForm
        docTitle="BAUT"
        pageTitle="Buat BAUT — Lampiran Mancore"
        activeMenu="baut-builder"
        defaultDocHeading="LAMPIRAN MANCORE"
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