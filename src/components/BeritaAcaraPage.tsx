import { useEffect, useState } from 'react';
import PdfHeader from './PdfHeader';
import type { ProjectData } from '../types/evidence';
import { formatTanggalKata, parseDateLocal } from '../utils/terbilang';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from './ExportOptions';
import '../assets/style_Evidence.css';
import '../assets/style_BeritaAcara.css';

export interface ChoicePair {
  /** [teks jika dipilih pertama, teks jika dipilih kedua] */
  labels: [string, string];
  /** 0 = pilihan pertama, 1 = pilihan kedua */
  selected: 0 | 1;
}

interface BeritaAcaraPageProps {
  docTitle: string; // judul halaman, mis. "LAPORAN COMMISIONING TEST"
  project: ProjectData;
  tanggalISO: string; // dari <input type="date">
  nama: string;
  nik: string;
  jabatanBaris1: string; // mis. "WASPANG"
  jabatanBaris2: string; // mis. "PT. TELKOM AKSES"
  kota: string; // mis. "Surabaya"
  choice1: ChoicePair;
  choice2a: ChoicePair;
  choice2b: ChoicePair;
  closingText: string;
  signatureDataUrl: string | null;
  /** Opsi export dari panel "Opsi Export PDF". Kosong = pengaturan standar. */
  options?: ExportOptions;
}

/**
 * CATATAN PENTING — baca ini dulu sebelum mengubah cara coret ditampilkan.
 *
 * Enam cara BERBEDA sudah dicoba untuk mencoret satu KATA di tengah teks
 * mengalir (di dalam <li>), dan SEMUANYA gagal di html2canvas saat export
 * PDF — beberapa bahkan gagal juga di preview browser — walau tekniknya
 * sangat berbeda-beda:
 *   1. `text-decoration: line-through` — salah hitung posisi garis.
 *   2. elemen anak + `position:absolute` + `transform:translateY(-50%)`
 *      — transform tidak diterapkan, garis nempel di atas kata.
 *   3. `background-image: linear-gradient(...)` pada span — bug lain soal
 *      background-position/size.
 *   4. elemen anak + `position:absolute` + `top:50%` + `margin-top` negatif
 *      — gejala sama seperti #2.
 *   5. `<svg>` hidup di DOM dengan `vertical-align` ditebak manual — aturan
 *      sejajar-baseline untuk `<svg>` ternyata tidak konsisten.
 *   6. SVG dijadikan `<img src="data:image/svg+xml...">` dengan
 *      `vertical-align` DIHITUNG (bukan ditebak) — hasilnya tetap kata
 *      melenceng jauh, bahkan sampai terpisah ke "baris" sendiri. Ini
 *      jauh lebih besar dari sekadar salah hitung beberapa piksel, jadi
 *      kesimpulannya: masalahnya BUKAN di angka vertical-align sama
 *      sekali, melainkan html2canvas memang tidak bisa diandalkan untuk
 *      menyelaraskan SATU ELEMEN KECIL (gambar/SVG) di tengah-tengah teks
 *      mengalir di dalam <li>, apa pun tekniknya.
 *
 * SOLUSI SEKARANG: berhenti mencoba menyelipkan elemen kecil di tengah
 * teks. Sebagai gantinya, SATU BARIS PENUH (contoh: "Pelaksanaan pekerjaan
 * telah / belum diselesaikan dengan spesifikasi teknis TELKOM") digambar
 * SEKALIGUS jadi SATU gambar utuh, pakai Canvas API bawaan browser
 * (`ctx.measureText`, `ctx.fillText`, `ctx.stroke`) — bukan perkiraan lebar
 * huruf manual lagi, tapi UKURAN SUNGGUHAN yang diukur langsung oleh mesin
 * render teks browser itu sendiri. Karena seluruh baris jadi satu gambar,
 * tidak ada lagi "elemen kecil di tengah teks lain" yang perlu
 * diselaraskan — jadi tidak ada lagi yang bisa html2canvas salah
 * selaraskan. <li>-nya cukup berisi satu <img> saja, ditampilkan sebagai
 * blok penuh.
 */

/** Satu potongan teks dalam satu baris: teks biasa, tebal, atau dicoret. */
interface LineSegment {
  text: string;
  bold?: boolean;
  struck?: boolean;
}

const CHOICE_LINE_FONT_SIZE = 13;
const CHOICE_LINE_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
// Disamakan dengan .pdf-ba-numbered { line-height: 1.6 } di style_BeritaAcara.css
const CHOICE_LINE_HEIGHT = Math.ceil(CHOICE_LINE_FONT_SIZE * 1.6);
// Gambar dirender 3x lebih besar lalu diperkecil lewat width/height HTML,
// supaya tetap tajam waktu ikut di-screenshot (html2canvas sendiri biasanya
// juga memakai scale > 1 — lihat quality.scale di pdfFromElement.ts).
const CHOICE_LINE_RENDER_SCALE = 3;

/**
 * Menggambar satu baris penuh (gabungan beberapa LineSegment) ke kanvas
 * tersembunyi, lalu mengembalikan hasilnya sebagai data URL gambar PNG.
 * Lebar tiap potongan teks diukur SUNGGUHAN lewat `ctx.measureText`, jadi
 * posisi dan panjang garis coretnya pasti pas dengan lebar teks aslinya.
 */
function renderChoiceLine(segments: LineSegment[]): { src: string; width: number; height: number } | null {
  const measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return null;

  const widths = segments.map((seg) => {
    measureCtx.font = `${seg.bold ? 700 : 400} ${CHOICE_LINE_FONT_SIZE}px ${CHOICE_LINE_FONT_FAMILY}`;
    return measureCtx.measureText(seg.text).width;
  });
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);

  const width = Math.ceil(totalWidth) + 2;
  const height = CHOICE_LINE_HEIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = width * CHOICE_LINE_RENDER_SCALE;
  canvas.height = height * CHOICE_LINE_RENDER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(CHOICE_LINE_RENDER_SCALE, CHOICE_LINE_RENDER_SCALE);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#222';

  // Posisi baseline standar di dalam kotak setinggi `height` (kira-kira
  // 72% dari atas — pas untuk font Arial ukuran ini).
  const baselineY = Math.round(height * 0.72);
  let x = 1;
  segments.forEach((seg, i) => {
    ctx.font = `${seg.bold ? 700 : 400} ${CHOICE_LINE_FONT_SIZE}px ${CHOICE_LINE_FONT_FAMILY}`;
    ctx.fillText(seg.text, x, baselineY);
    if (seg.struck) {
      const strikeY = baselineY - CHOICE_LINE_FONT_SIZE * 0.3;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, strikeY);
      ctx.lineTo(x + widths[i], strikeY);
      ctx.stroke();
    }
    x += widths[i];
  });

  return { src: canvas.toDataURL('image/png'), width, height };
}

/**
 * Satu baris nomor (isi <li>), digambar utuh sebagai SATU gambar lewat
 * `renderChoiceLine` (lihat catatan panjang di atas). Dirender lewat
 * `useEffect` karena butuh Canvas API yang cuma ada di browser; sebelum itu
 * selesai (sepersekian detik pertama), ditampilkan teks HTML biasa dulu
 * sebagai cadangan supaya tidak terlihat kosong.
 */
function ChoiceLine({ segments }: { segments: LineSegment[] }) {
  const [img, setImg] = useState<{ src: string; width: number; height: number } | null>(null);
  const key = segments.map((s) => `${s.text}|${s.bold ? 1 : 0}|${s.struck ? 1 : 0}`).join('~');

  useEffect(() => {
    setImg(renderChoiceLine(segments));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!img) {
    return (
      <>
        {segments.map((seg, i) => (
          <span
            key={i}
            style={{
              fontWeight: seg.bold ? 700 : 400,
              textDecoration: seg.struck ? 'line-through' : 'none',
            }}
          >
            {seg.text}
          </span>
        ))}
      </>
    );
  }

  return <img src={img.src} width={img.width} height={img.height} alt="" className="pdf-ba-choice-line-img" />;
}

export default function BeritaAcaraPage({
  docTitle,
  project,
  tanggalISO,
  nama,
  nik,
  jabatanBaris1,
  jabatanBaris2,
  kota,
  choice1,
  choice2a,
  choice2b,
  closingText,
  signatureDataUrl,
  options = DEFAULT_EXPORT_OPTIONS,
}: BeritaAcaraPageProps) {
  const tgl = parseDateLocal(tanggalISO);
  const kata = tgl
    ? formatTanggalKata(tgl)
    : { hari: '…', tanggal: '…', bulan: '…', tahun: '…', singkat: '…' };

  return (
    <div className="pdf-page pdf-ba-page">
      <PdfHeader showLogos={options.showLogos} logoSize={options.logoSize} />

      <h1 className="pdf-title">{docTitle}</h1>

      <div className="pdf-info-table">
        <div className="pdf-info-row">
          <span className="pdf-info-label">PROYEK</span>
          <span>: {project.proyek}</span>
        </div>
        <div className="pdf-info-row">
          <span className="pdf-info-label">KONTRAK</span>
          <span>: {project.kontrak}</span>
        </div>
        <div className="pdf-info-row">
          <span className="pdf-info-label">SURAT PESANAN</span>
          <span>: {project.suratPesanan}</span>
        </div>
        <div className="pdf-info-row">
          <span className="pdf-info-label">DISTRICT</span>
          <span>: {project.district}</span>
        </div>
        <div className="pdf-info-row">
          <span className="pdf-info-label">LOKASI</span>
          <span>: {project.lokasi}</span>
        </div>
        <div className="pdf-info-row">
          <span className="pdf-info-label">PELAKSANA</span>
          <span>: {project.pelaksana}</span>
        </div>
      </div>

      <p className="pdf-ba-paragraph">
        Pada hari ini <b>{kata.hari}</b> tanggal <b>{kata.tanggal}</b> bulan <b>{kata.bulan}</b>{' '}
        tahun <b>{kata.tahun}</b> yang bertanda tangan di bawah ini&nbsp;:
      </p>

      <div className="pdf-ba-signer">
        <div className="pdf-ba-signer-row">
          <span className="pdf-ba-signer-label">Nama</span>
          <span>: {nama}</span>
        </div>
        <div className="pdf-ba-signer-row">
          <span className="pdf-ba-signer-label">NIK</span>
          <span>: {nik}</span>
        </div>
        <div className="pdf-ba-signer-row">
          <span className="pdf-ba-signer-label">Jabatan</span>
          <span>
            : {jabatanBaris1} {jabatanBaris2}
          </span>
        </div>
      </div>

      <p className="pdf-ba-paragraph">
        Sehubungan dengan <b>{project.proyek}</b> menerangkan bahwa telah melaksanakan pemeriksaan
        kesisteman (Commisioning Test) dan fisik pada lokasi <b>{project.lokasi}</b> sebagai
        berikut&nbsp;:
      </p>

      <ol className="pdf-ba-numbered">
        <li>
          <ChoiceLine
            segments={[
              { text: 'Pelaksanaan pekerjaan ' },
              { text: choice1.labels[choice1.selected], bold: true },
              { text: ' / ' },
              { text: choice1.labels[choice1.selected === 0 ? 1 : 0], struck: true },
              { text: ' diselesaikan dengan spesifikasi teknis TELKOM' },
            ]}
          />
        </li>
        <li>
          <ChoiceLine
            segments={[
              { text: 'Hasil pekerjaan ' },
              { text: choice2a.labels[choice2a.selected], bold: true },
              { text: ' / ' },
              { text: choice2a.labels[choice2a.selected === 0 ? 1 : 0], struck: true },
              { text: ' diterima dan ' },
              { text: choice2b.labels[choice2b.selected], bold: true },
              { text: ' / ' },
              { text: choice2b.labels[choice2b.selected === 0 ? 1 : 0], struck: true },
              { text: ' untuk diajukan Uji Terima (UT)' },
            ]}
          />
        </li>
      </ol>

      <p className="pdf-ba-paragraph">{closingText}</p>

      <div className="pdf-ba-sign-wrap">
        <div className="pdf-ba-sign-block">
          <p>
            {kota || '…'}, {kata.singkat}
          </p>
          <p>{jabatanBaris1}</p>
          <p>{jabatanBaris2}</p>

          <div className="pdf-ba-sign-space">
            {signatureDataUrl && <img src={signatureDataUrl} alt="Tanda tangan" />}
          </div>

          <p className="pdf-ba-sign-name">{nama}</p>
          <p>NIK. {nik}</p>
        </div>
      </div>

      {options.showPageNumber && <div className="pdf-page-number">Halaman 1</div>}
    </div>
  );
}