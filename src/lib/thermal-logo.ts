export type LogoRaster = { width: number; height: number; pixels: Uint8Array };
export type LoadedLogo = { image: HTMLImageElement; width: number; height: number };

/** Muat logo data URL dan skala agar tidak melebihi lebar printer. */
export function loadLogoImage(dataUrl: string, maxWidth: number): Promise<LoadedLogo | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(1, image.width));
      resolve({
        image,
        width: Math.max(1, Math.round(image.width * scale)),
        height: Math.max(1, Math.round(image.height * scale)),
      });
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

/**
 * Ubah logo menjadi bitmap hitam-putih untuk perintah raster ESC/POS.
 * Piksel transparan dianggap putih; ambang 0.65 menjaga garis logo tetap tegas.
 */
export async function loadLogoRaster(dataUrl: string, maxWidth: number): Promise<LogoRaster | null> {
  const loaded = await loadLogoImage(dataUrl, maxWidth);
  if (!loaded) return null;
  const { image, width, height } = loaded;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const pixels = new Uint8Array(width * height);
  for (let index = 0; index < pixels.length; index++) {
    const offset = index * 4;
    if (data[offset + 3] < 128) continue;
    const luminance = (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) / 255;
    pixels[index] = luminance < 0.65 ? 1 : 0;
  }
  return { width, height, pixels };
}
