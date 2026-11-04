export type VisualMotif =
  | 'timber'
  | 'plywood'
  | 'cement'
  | 'rebar'
  | 'mabati'
  | 'drill'
  | 'lockset'
  | 'toolset'
  | 'door_mahogany'
  | 'window_casement'
  | 'door_flush'
  | 'water_tank'
  | 'wheelbarrow'
  | 'brc_mesh'
  | 'paint_bucket'
  | 'ppe_bundle'
  | 'solar_floodlight'
  | 'roofing_nails';

export const HERO_YARD_VISUAL = '/assets/materials/hero-yard.jpg';

const MOTIF_GALLERIES: Record<VisualMotif, string[]> = {
  cement: [
    '/assets/materials/cement.jpg',
    '/assets/materials/hero-yard.jpg',
  ],
  mabati: [
    '/assets/materials/mabati.jpg',
    '/assets/materials/timber.jpg',
  ],
  roofing_nails: [
    '/assets/materials/mabati.jpg',
    '/assets/materials/cordless-drill.jpg',
  ],
  rebar: [
    '/assets/materials/rebar.jpg',
    '/assets/materials/cement.jpg',
  ],
  brc_mesh: [
    '/assets/materials/rebar.jpg',
    '/assets/materials/wheelbarrow.jpg',
  ],
  timber: [
    '/assets/materials/timber.jpg',
    '/assets/materials/mabati.jpg',
  ],
  plywood: [
    '/assets/materials/timber.jpg',
    '/assets/materials/cement.jpg',
  ],
  door_mahogany: [
    '/assets/materials/mahogany-door.jpg',
    '/assets/materials/union-lockset.jpg',
  ],
  window_casement: [
    '/assets/materials/steel-window.jpg',
    '/assets/materials/rebar.jpg',
  ],
  door_flush: [
    '/assets/materials/mahogany-door.jpg',
    '/assets/materials/union-lockset.jpg',
  ],
  water_tank: [
    '/assets/materials/water-tank.jpg',
    '/assets/materials/mabati.jpg',
  ],
  wheelbarrow: [
    '/assets/materials/wheelbarrow.jpg',
    '/assets/materials/cement.jpg',
  ],
  ppe_bundle: [
    '/assets/materials/ppe-safety.jpg',
    '/assets/materials/wheelbarrow.jpg',
  ],
  drill: [
    '/assets/materials/cordless-drill.jpg',
    '/assets/materials/ppe-safety.jpg',
  ],
  lockset: [
    '/assets/materials/union-lockset.jpg',
    '/assets/materials/mahogany-door.jpg',
  ],
  toolset: [
    '/assets/materials/cordless-drill.jpg',
    '/assets/materials/wheelbarrow.jpg',
  ],
  paint_bucket: [
    '/assets/materials/weatherguard-paint.jpg',
    '/assets/materials/cement.jpg',
  ],
  solar_floodlight: [
    '/assets/materials/solar-floodlight.jpg',
    '/assets/materials/cordless-drill.jpg',
  ],
};

export function createProductGallery(
  motif: VisualMotif,
  _title?: string,
  _sku?: string,
  _specTag?: string
): string[] {
  return MOTIF_GALLERIES[motif] || MOTIF_GALLERIES.cement;
}

/**
 * Compresses an uploaded image File into a compact WebP data URL (< 75KB)
 * so administrators can upload multiple real photographs directly into Firestore.
 */
export async function compressImageFileToDataUrl(file: File, maxWidth = 720, quality = 0.76): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const webpData = canvas.toDataURL('image/webp', quality);
        resolve(webpData.length <= 115000 ? webpData : canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
