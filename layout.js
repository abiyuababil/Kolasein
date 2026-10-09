export function distributeToRows(count) {
  if (count === 0) return [];
  if (count <= 3) return [count];

  const cols = Math.ceil(Math.sqrt(count));
  const numRows = Math.ceil(count / cols);
  const result = [];
  let remaining = count;

  for (let i = 0; i < numRows; i++) {
    const c = Math.ceil(remaining / (numRows - i));
    result.push(c);
    remaining -= c;
  }

  return result;
}

export function buildRows(photoIds) {
  const dist = distributeToRows(photoIds.length);
  return buildRowsFromDistribution(photoIds, dist);
}

export function buildRowsFromDistribution(photoIds, distribution) {
  const rows = [];
  let idx = 0;

  for (const count of distribution) {
    const items = [];
    for (let i = 0; i < count; i++) {
      if (idx < photoIds.length) {
        items.push({ photoId: photoIds[idx], weight: 1 });
        idx++;
      }
    }
    if (items.length > 0) {
      rows.push({ weight: 1, items });
    }
  }

  return rows;
}

export function getLayoutPresets(count) {
  if (count <= 0) return [];

  const presets = [];

  if (count === 2) {
    presets.push({ id: 'col-2', name: '2 Kolom (1:1)', dist: [2] });
    presets.push({ id: 'row-2', name: '2 Baris Bertumpuk', dist: [1, 1] });
  } else if (count === 3) {
    presets.push({ id: 'feat-top', name: '1 Atas, 2 Bawah', dist: [1, 2] });
    presets.push({ id: 'feat-bot', name: '2 Atas, 1 Bawah', dist: [2, 1] });
    presets.push({ id: 'col-3', name: '3 Kolom', dist: [3] });
    presets.push({ id: 'row-3', name: '3 Baris', dist: [1, 1, 1] });
  } else if (count === 4) {
    presets.push({ id: 'grid-2x2', name: 'Grid 2x2', dist: [2, 2] });
    presets.push({ id: 'feat-top', name: '1 Atas, 3 Bawah', dist: [1, 3] });
    presets.push({ id: 'feat-bot', name: '3 Atas, 1 Bawah', dist: [3, 1] });
    presets.push({ id: 'col-4', name: '4 Kolom', dist: [4] });
    presets.push({ id: 'row-4', name: '4 Baris', dist: [1, 1, 1, 1] });
  } else if (count === 5) {
    presets.push({ id: 'split-3-2', name: '3 Atas, 2 Bawah', dist: [3, 2] });
    presets.push({ id: 'split-2-3', name: '2 Atas, 3 Bawah', dist: [2, 3] });
    presets.push({ id: 'feat-top', name: '1 Atas, 4 Bawah', dist: [1, 4] });
    presets.push({ id: 'feat-bot', name: '4 Atas, 1 Bawah', dist: [4, 1] });
  } else if (count === 6) {
    presets.push({ id: 'grid-3x2', name: 'Grid 3x2 (2 Baris)', dist: [3, 3] });
    presets.push({ id: 'grid-2x3', name: 'Grid 2x3 (3 Baris)', dist: [2, 2, 2] });
    presets.push({ id: 'feat-top', name: '1 Atas, 5 Bawah', dist: [1, 5] });
    presets.push({ id: 'split-4-2', name: '4 Atas, 2 Bawah', dist: [4, 2] });
    presets.push({ id: 'split-2-4', name: '2 Atas, 4 Bawah', dist: [2, 4] });
  } else if (count === 7) {
    presets.push({ id: 'split-4-3', name: '4 Atas, 3 Bawah', dist: [4, 3] });
    presets.push({ id: 'split-3-4', name: '3 Atas, 4 Bawah', dist: [3, 4] });
    presets.push({ id: 'split-2-3-2', name: '2-3-2 Baris', dist: [2, 3, 2] });
  } else if (count === 8) {
    presets.push({ id: 'grid-4x2', name: 'Grid 4x2 (2 Baris)', dist: [4, 4] });
    presets.push({ id: 'grid-2x4', name: 'Grid 2x4 (4 Baris)', dist: [2, 2, 2, 2] });
    presets.push({ id: 'split-3-2-3', name: '3-2-3 Baris', dist: [3, 2, 3] });
  } else if (count === 9) {
    presets.push({ id: 'grid-3x3', name: 'Grid 3x3', dist: [3, 3, 3] });
    presets.push({ id: 'split-4-5', name: '4 Atas, 5 Bawah', dist: [4, 5] });
    presets.push({ id: 'split-5-4', name: '5 Atas, 4 Bawah', dist: [5, 4] });
  } else {
    const autoDist = distributeToRows(count);
    presets.push({ id: 'auto', name: 'Otomatis', dist: autoDist });
    const sqrt = Math.round(Math.sqrt(count));
    if (count % sqrt === 0) {
      const rows = count / sqrt;
      const dist = Array(rows).fill(sqrt);
      presets.push({ id: `grid-${sqrt}x${rows}`, name: `Grid ${sqrt}x${rows}`, dist });
    }
    presets.push({ id: 'feat-top', name: '1 Atas, Sisanya Bawah', dist: [1, count - 1] });
    presets.push({ id: 'split-half', name: '2 Baris Rata', dist: [Math.ceil(count / 2), Math.floor(count / 2)] });
  }

  // Deduplicate presets with identical distributions
  const unique = [];
  const seen = new Set();
  for (const p of presets) {
    const key = p.dist.join('-');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  return unique;
}

export function swapCellsPhotos(rows, photoIdA, photoIdB) {
  if (photoIdA === photoIdB) return rows;

  let itemA = null;
  let itemB = null;

  for (const row of rows) {
    for (const item of row.items) {
      if (item.photoId === photoIdA) itemA = item;
      if (item.photoId === photoIdB) itemB = item;
    }
  }

  if (itemA && itemB) {
    const temp = itemA.photoId;
    itemA.photoId = itemB.photoId;
    itemB.photoId = temp;
  }

  return rows;
}

export function reorderRowsPhotos(rows, newPhotoIdsOrder) {
  let idx = 0;
  for (const row of rows) {
    for (const item of row.items) {
      if (idx < newPhotoIdsOrder.length) {
        item.photoId = newPhotoIdsOrder[idx];
        idx++;
      }
    }
  }
  return rows;
}

export function calculateCells(rows, frameW, frameH, gap) {
  if (!rows.length) return [];

  const totalRowWeight = rows.reduce((s, r) => s + r.weight, 0);
  const gapSumY = gap * (rows.length - 1);
  const availH = frameH - gapSumY;

  const cells = [];
  let y = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rowH = (row.weight / totalRowWeight) * availH;

    const totalItemW = row.items.reduce((s, it) => s + it.weight, 0);
    const gapSumX = gap * (row.items.length - 1);
    const availW = frameW - gapSumX;

    let x = 0;
    for (let ci = 0; ci < row.items.length; ci++) {
      const item = row.items[ci];
      const cellW = (item.weight / totalItemW) * availW;

      cells.push({
        rowIndex: ri,
        colIndex: ci,
        x, y,
        width: cellW,
        height: rowH,
        photoId: item.photoId,
      });

      x += cellW + gap;
    }

    y += rowH + gap;
  }

  return cells;
}
