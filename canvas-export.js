import { calculateCells } from './layout.js';

function drawCoverImage(ctx, img, dx, dy, dw, dh, panX, panY) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = dw / dh;

  let sx, sy, sw, sh;

  if (ir > cr) {
    sh = img.naturalHeight;
    sw = sh * cr;
    sy = 0;
    sx = (img.naturalWidth - sw) * (panX / 100);
  } else {
    sw = img.naturalWidth;
    sh = sw / cr;
    sx = 0;
    sy = (img.naturalHeight - sh) * (panY / 100);
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

export function exportCollage(photosMap, rows, resolution, previewWidth, gap, format, bgColor) {
  const [targetW, targetH] = resolution;
  const scale = targetW / previewWidth;
  const exportGap = Math.round(gap * scale);

  const cells = calculateCells(rows, targetW, targetH, exportGap);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, targetW, targetH);

  for (const cell of cells) {
    const photo = photosMap.get(cell.photoId);
    if (!photo || !photo.img) continue;
    drawCoverImage(ctx, photo.img, cell.x, cell.y, cell.width, cell.height, photo.panX, photo.panY);
  }

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 0.92 : undefined;

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kolasein-${targetW}x${targetH}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, mime, quality);
}
