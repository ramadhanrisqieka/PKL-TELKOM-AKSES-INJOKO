import type { ProjectData, EvidenceItem } from '../types/evidence';
import PdfHeader from './PdfHeader';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from './ExportOptions';

interface EvidencePreviewProps {
  docTitle: string;
  project: ProjectData;
  items: EvidenceItem[];
  /** Opsi export dari panel "Opsi Export PDF". Kosong = pengaturan standar. */
  options?: ExportOptions;
  /** Jika true (khusus evidence2 / OPM), foto pertama tampil 1 baris penuh (ODC) di atas grid. */
  featuredFirst?: boolean;
  /** @deprecated Logo sekarang tetap (lihat src/config/brand.ts). Prop ini diabaikan. */
  logoLeftSrc?: string;
  /** @deprecated Logo sekarang tetap (lihat src/config/brand.ts). Prop ini diabaikan. */
  logoRightSrc?: string;
}

// Tinggi maksimal kotak foto (px, pada lebar halaman 794px).
const FRAME_HEIGHT_PX: Record<2 | 3, number> = { 2: 240, 3: 200 };
// Tinggi khusus halaman 1 saat ada 1 baris ODC + 2 baris grid (total 3 baris) agar tetap muat 1 A4.
const OPM_FEATURED_HEIGHT_PX = 190;
const OPM_GRID_HEIGHT_PX: Record<2 | 3, number> = { 2: 180, 3: 165 };

interface PageChunk {
  featured?: EvidenceItem;
  gridItems: EvidenceItem[];
}

function buildPages(items: EvidenceItem[], perPage: number, featuredFirst: boolean): PageChunk[] {
  if (items.length === 0) return [{ gridItems: [] }];

  if (!featuredFirst) {
    const pages: PageChunk[] = [];
    for (let i = 0; i < items.length; i += perPage) {
      pages.push({ gridItems: items.slice(i, i + perPage) });
    }
    return pages;
  }

  // Halaman 1: 1 foto ODC (index 0) + maksimal `perPage` foto grid di bawahnya
  const pages: PageChunk[] = [
    {
      featured: items[0],
      gridItems: items.slice(1, 1 + perPage),
    },
  ];

  // Halaman 2 dst.: mengikuti pembagian standar `perPage`
  for (let i = 1 + perPage; i < items.length; i += perPage) {
    pages.push({ gridItems: items.slice(i, i + perPage) });
  }

  return pages;
}

export default function EvidencePreview({
  docTitle,
  project,
  items,
  options = DEFAULT_EXPORT_OPTIONS,
  featuredFirst = false,
}: EvidencePreviewProps) {
  const perPage = options.columns === 2 ? 4 : 6;
  const pages = buildPages(items, perPage, featuredFirst);

  return (
    <>
      {pages.map((page, pageIndex) => {
        const hasFeatured = !!page.featured;
        const columns: 2 | 3 =
          options.columns === 'auto'
            ? page.gridItems.length <= 4 && !hasFeatured
              ? 2
              : 3
            : options.columns;
        const frameHeight = hasFeatured ? OPM_GRID_HEIGHT_PX[columns] : FRAME_HEIGHT_PX[columns];
        const isLastPage = pageIndex === pages.length - 1;

        return (
          <div key={pageIndex}>
            <div className="pdf-page">
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

              <div
                className="pdf-photo-grid"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {page.featured && (
                  <div
                    key={page.featured.id}
                    className="pdf-photo-cell pdf-photo-cell-featured"
                    style={{ gridColumn: '1 / -1' }}
                  >
                    <div className="pdf-photo-frame" style={{ height: OPM_FEATURED_HEIGHT_PX }}>
                      {page.featured.dataUrl ? (
                        <img
                          src={page.featured.dataUrl}
                          alt={page.featured.label}
                          data-evidence-id={page.featured.id}
                          style={{ maxHeight: OPM_FEATURED_HEIGHT_PX }}
                        />
                      ) : (
                        <div className="pdf-photo-placeholder">Belum ada foto</div>
                      )}
                    </div>
                    <div className="pdf-photo-caption pdf-photo-caption-bold">
                      {(page.featured.label || '(Tanpa keterangan)').toUpperCase()}
                    </div>
                  </div>
                )}

                {page.gridItems.map((item) => (
                  <div key={item.id} className="pdf-photo-cell">
                    <div className="pdf-photo-frame" style={{ height: frameHeight }}>
                      {item.dataUrl ? (
                        <img
                          src={item.dataUrl}
                          alt={item.label}
                          data-evidence-id={item.id}
                          style={{ maxHeight: frameHeight }}
                        />
                      ) : (
                        <div className="pdf-photo-placeholder">Belum ada foto</div>
                      )}
                    </div>
                    <div className="pdf-photo-caption">
                      {(item.label || '(Tanpa keterangan)').toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>

              {options.showPageNumber && pages.length > 1 && (
                <div className="pdf-page-number">
                  Halaman {pageIndex + 1} dari {pages.length}
                </div>
              )}
            </div>

            {!isLastPage && <div className="pdf-page-gap">— Akhir Halaman {pageIndex + 1} —</div>}
          </div>
        );
      })}
    </>
  );
}
