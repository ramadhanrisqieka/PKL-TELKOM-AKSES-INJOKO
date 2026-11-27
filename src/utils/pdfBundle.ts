/**
 * "Paket PDF Lengkap": menyimpan hasil render tiap bagian (Cover, Daftar Isi,
 * ..., ABD, BA ABD) lalu menggabungkan semuanya jadi SATU file PDF menggunakan pdf-lib.
 *
 * - Bagian buatan aplikasi (.pdf-page biasa) discreenshot via html2canvas -> halaman A4 Portrait.
 * - Bagian Import PDF (NDE, BA Tambah Kurang, ABD, BA ABD) menyalin halaman PDF ASLI
 *   secara utuh (termasuk ukuran A3 Landscape & ketajaman vektornya).
 */
import { useSyncExternalStore } from 'react';
import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import { findOriginal, installOriginalsTracker, whenTrackerIdle } from './originalsTracker';

installOriginalsTracker();

export interface RawPdfPageRef {
  bytes: Uint8Array;
  pageIndex: number;
}

export type BundlePage =
  | {
      kind: 'image';
      /** Gambar JPEG halaman (data URL) */
      img: string;
      /** Posisi & ukuran di halaman A4, satuan mm */
      x: number;
      w: number;
      h: number;
    }
  | {
      kind: 'pdf';
      /** File PDF asli (Uint8Array) */
      bytes: Uint8Array;
      /** Indeks halaman (0-based) di dalam file PDF sumber */
      pageIndex: number;
    };

interface BundleEntry {
  pages: BundlePage[];
  savedAt: number;
}

export interface QualitySetting {
  scale: number;
  jpeg: number;
}

// Registry halaman PDF mentah yang sedang aktif di PdfImportForm
const rawPdfRegistry = new Map<string, RawPdfPageRef>();

export function registerRawPdfPage(id: string, ref: RawPdfPageRef) {
  rawPdfRegistry.set(id, ref);
}

export function unregisterRawPdfPage(id: string) {
  rawPdfRegistry.delete(id);
}

// builderId (mis. 'lact-builder') -> mode (mis. 'cover') -> isi
const bundles = new Map<string, Map<string, BundleEntry>>();
const fileLabels = new Map<string, string>();
const bundleNames = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getVersion = () => version;

/** Hook: komponen ikut dirender ulang setiap isi paket berubah. */
export function useBundleVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}

export function isSectionSaved(builderId: string, mode: string): boolean {
  return bundles.get(builderId)?.has(mode) ?? false;
}

export function getSectionPageCount(builderId: string, mode: string): number {
  return bundles.get(builderId)?.get(mode)?.pages.length ?? 0;
}

export function removeSection(builderId: string, mode: string) {
  bundles.get(builderId)?.delete(mode);
  emit();
}

export function clearBundle(builderId: string) {
  bundles.delete(builderId);
  fileLabels.delete(builderId);
  bundleNames.delete(builderId);
  emit();
}

export function getBundleName(builderId: string): string {
  return bundleNames.get(builderId) ?? '';
}

export function setBundleName(builderId: string, name: string) {
  if (name) bundleNames.set(builderId, name);
  else bundleNames.delete(builderId);
}

export function saveSection(builderId: string, mode: string, pages: BundlePage[], fileLabel?: string) {
  let m = bundles.get(builderId);
  if (!m) {
    m = new Map();
    bundles.set(builderId, m);
  }
  m.set(mode, { pages, savedAt: Date.now() });
  if (fileLabel) fileLabels.set(builderId, fileLabel);
  emit();
}

export function getFileLabel(builderId: string): string {
  return fileLabels.get(builderId) ?? '';
}

/** Ambil nama lokasi dari tabel info proyek di halaman yang sedang tampil (untuk nama file). */
export function readLokasiFromPreview(root: HTMLElement): string {
  const rows = Array.from(root.querySelectorAll('.pdf-info-row'));
  for (const row of rows) {
    const spans = row.querySelectorAll('span');
    if (spans.length >= 2 && (spans[0].textContent ?? '').trim().toUpperCase() === 'LOKASI') {
      return (spans[1].textContent ?? '').replace(/^\s*:\s*/, '').trim();
    }
  }
  return '';
}

// ---------- Helper unduh & konversi satuan PDF ----------

const A4_W_MM = 210;
const A4_H_MM = 297;
const MM_TO_PT = 72 / 25.4;

function triggerPdfDownload(pdfBytes: Uint8Array, fileName: string) {
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Ekspor satuan untuk halaman Import PDF (ABD, NDE, BA Tambah Kurang, BA ABD):
 * menyalin halaman asli persis sesuai urutan tanpa mengubah ukuran/orientasi (mis. A3 Landscape).
 */
export async function exportRawPdfPages(pages: RawPdfPageRef[], fileName: string): Promise<number> {
  if (pages.length === 0) throw new Error('Tidak ada halaman untuk diekspor');

  const outPdf = await PDFDocument.create();
  const docCache = new Map<Uint8Array, PDFDocument>();

  for (const ref of pages) {
    let srcDoc = docCache.get(ref.bytes);
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(ref.bytes, { ignoreEncryption: true });
      docCache.set(ref.bytes, srcDoc);
    }
    const [copied] = await outPdf.copyPages(srcDoc, [ref.pageIndex]);
    outPdf.addPage(copied);
  }

  const outBytes = await outPdf.save();
  triggerPdfDownload(outBytes, fileName);
  return pages.length;
}

// ---------- Mengambil halaman dari preview yang sedang tampil ----------

function swapImageSrc(img: HTMLImageElement, url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      img.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      img.removeEventListener('load', onLoad);
      reject(new Error('Gagal memuat foto asli'));
    };
    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
    img.src = url;
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );
}

/**
 * Mengambil halaman dari setiap elemen .pdf-page di dalam `root`:
 * - Jika halaman berasal dari Import PDF (memiliki data-raw-pdf-id), langsung
 *   menyimpan referensi halaman PDF aslinya (instan & ukuran A3/asli terjaga).
 * - Jika halaman buatan aplikasi, discreenshot via html2canvas seperti biasa.
 */
export async function captureSectionPages(
  root: HTMLElement,
  quality: QualitySetting,
  onProgress?: (done: number, total: number) => void
): Promise<BundlePage[]> {
  const pageEls = Array.from(root.querySelectorAll('.pdf-page')) as HTMLElement[];
  if (pageEls.length === 0) throw new Error('Tidak ada halaman untuk disimpan');

  await whenTrackerIdle();

  const imgEls = Array.from(root.querySelectorAll('img[data-evidence-id]')) as HTMLImageElement[];
  const previousSrc = new Map<HTMLImageElement, string>();
  const objectUrls: string[] = [];
  const pages: BundlePage[] = [];

  try {
    for (const img of imgEls) {
      const original = findOriginal(img.src);
      if (!original) continue;
      previousSrc.set(img, img.src);
      const url = URL.createObjectURL(original);
      objectUrls.push(url);
      await swapImageSrc(img, url);
    }
    await waitForImages(root);

    for (let i = 0; i < pageEls.length; i++) {
      onProgress?.(i, pageEls.length);

      const el = pageEls[i];
      const rawId =
        el.dataset.rawPdfId ?? el.closest<HTMLElement>('[data-raw-pdf-id]')?.dataset.rawPdfId;
      const rawRef = rawId ? rawPdfRegistry.get(rawId) : undefined;

      if (rawRef) {
        pages.push({ kind: 'pdf', bytes: rawRef.bytes, pageIndex: rawRef.pageIndex });
        onProgress?.(i + 1, pageEls.length);
        continue;
      }

      const canvas = await html2canvas(el, {
        scale: quality.scale,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const img = canvas.toDataURL('image/jpeg', quality.jpeg);

      let w = A4_W_MM;
      let h = (canvas.height * w) / canvas.width;
      if (h > A4_H_MM) {
        h = A4_H_MM;
        w = (canvas.width * h) / canvas.height;
      }
      pages.push({ kind: 'image', img, x: (A4_W_MM - w) / 2, w, h });
      onProgress?.(i + 1, pageEls.length);
    }
  } finally {
    previousSrc.forEach((src, img) => {
      img.src = src;
    });
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }
  return pages;
}

/**
 * Gabungkan semua bagian yang sudah tersimpan jadi satu file PDF campuran:
 * halaman laporan tetap A4 Portrait, halaman Import PDF (ABD, dll.) tetap ukuran aslinya.
 */
export async function mergeBundleToPdf(
  builderId: string,
  orderedModes: string[],
  fileName: string
): Promise<number> {
  const m = bundles.get(builderId);
  if (!m || m.size === 0) throw new Error('Paket masih kosong');

  const outPdf = await PDFDocument.create();
  const docCache = new Map<Uint8Array, PDFDocument>();
  let pageCount = 0;

  for (const mode of orderedModes) {
    const entry = m.get(mode);
    if (!entry) continue;

    for (const p of entry.pages) {
      if (p.kind === 'pdf') {
        let srcDoc = docCache.get(p.bytes);
        if (!srcDoc) {
          srcDoc = await PDFDocument.load(p.bytes, { ignoreEncryption: true });
          docCache.set(p.bytes, srcDoc);
        }
        const [copied] = await outPdf.copyPages(srcDoc, [p.pageIndex]);
        outPdf.addPage(copied);
      } else {
        const pageW = A4_W_MM * MM_TO_PT;
        const pageH = A4_H_MM * MM_TO_PT;
        const page = outPdf.addPage([pageW, pageH]);
        const embedded = await outPdf.embedJpg(p.img);
        const wPt = p.w * MM_TO_PT;
        const hPt = p.h * MM_TO_PT;
        const xPt = p.x * MM_TO_PT;
        // Origin pdf-lib di kiri-bawah, sehingga posisi rata atas = pageH - hPt
        page.drawImage(embedded, {
          x: xPt,
          y: pageH - hPt,
          width: wPt,
          height: hPt,
        });
      }
      pageCount++;
    }
  }

  if (pageCount === 0) throw new Error('Paket masih kosong');
  const outBytes = await outPdf.save();
  triggerPdfDownload(outBytes, fileName);
  return pageCount;
}