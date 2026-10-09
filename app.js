import {
  distributeToRows,
  buildRows,
  buildRowsFromDistribution,
  getLayoutPresets,
  swapCellsPhotos,
  reorderRowsPhotos,
  calculateCells,
} from './layout.js';
import { exportCollage } from './canvas-export.js';

const RATIOS = [
  { name: '1:1',  w: 1,  h: 1,  res: [1080, 1080] },
  { name: '4:5',  w: 4,  h: 5,  res: [1080, 1350] },
  { name: '9:16', w: 9,  h: 16, res: [1080, 1920] },
  { name: '16:9', w: 16, h: 9,  res: [1920, 1080] },
  { name: 'Custom', w: 4, h: 3, res: null },
];

const MIN_WEIGHT = 0.2;
const AUTOSAVE_KEY = 'kolasein_autosave';

const state = {
  photos: new Map(), // id -> { id, name, img, url, dataUrl, panX, panY }
  photoOrder: [],    // [id1, id2, ...]
  nextId: 1,
  rows: [],
  ratio: RATIOS[0],
  activePresetId: 'auto',
  gap: 4,
  bgColor: '#e0e0e0',
  cells: [],
  frameWidth: 0,
  frameHeight: 0,
};

// Persistent DOM references
let cellEls = [];
let vHandles = [];
let hHandles = [];
let autosaveTimer = null;

const $ = id => document.getElementById(id);

const uploadScreen        = $('upload-screen');
const editorScreen        = $('editor-screen');
const dropZone            = $('drop-zone');
const fileInput           = $('file-input');
const uploadLoadBtn       = $('upload-load-btn');
const uploadProjectInput  = $('upload-project-input');
const restoreBanner       = $('restore-banner');
const restoreInfo         = $('restore-info');
const restoreBtn          = $('restore-btn');

const addFileInput        = $('add-file-input');
const addMoreBtn          = $('add-more-btn');
const photoCountEl        = $('photo-count');
const mobilePhotoCountEl  = $('mobile-photo-count');
const thumbnailsEl        = $('thumbnails');
const layoutPresetsEl     = $('layout-presets');

let selectedThumbId = null;

const ratioOptions        = $('ratio-options');
const customRatio         = $('custom-ratio');
const customW             = $('custom-w');
const customH             = $('custom-h');

const gapSlider           = $('gap-slider');
const gapValue            = $('gap-value');
const bgColorInput        = $('bg-color');
const bgColorLabel        = $('bg-color-label');

const saveProjectBtn      = $('save-project-btn');
const loadProjectBtn      = $('load-project-btn');
const editorProjectInput  = $('editor-project-input');
const resetProjectBtn     = $('reset-project-btn');

const frame               = $('collage-frame');
const canvasArea          = $('canvas-area');
const exportPng           = $('export-png');
const exportJpg           = $('export-jpg');


// ── Helper: File to DataURL ──

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = url;
  });
}


// ── Upload Setup ──

function setupUpload() {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', e => {
    handleIncomingFiles(e.target.files);
    e.target.value = '';
  });

  addFileInput.addEventListener('change', e => {
    handleIncomingFiles(e.target.files);
    e.target.value = '';
  });

  addMoreBtn.addEventListener('click', () => addFileInput.click());

  uploadLoadBtn.addEventListener('click', () => uploadProjectInput.click());
  uploadProjectInput.addEventListener('change', e => {
    if (e.target.files[0]) loadProjectFromFile(e.target.files[0]);
    e.target.value = '';
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleIncomingFiles(e.dataTransfer.files);
  });

  // Drop files anywhere in canvas area
  canvasArea.addEventListener('dragover', e => e.preventDefault());
  canvasArea.addEventListener('drop', e => {
    e.preventDefault();
    handleIncomingFiles(e.dataTransfer.files);
  });

  // Paste from clipboard
  document.addEventListener('paste', e => {
    const items = [...(e.clipboardData?.items || [])];
    const files = items
      .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
      .map(it => it.getAsFile())
      .filter(Boolean);
    if (files.length) handleIncomingFiles(files);
  });
}

async function handleIncomingFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;

  // Check if user dropped a project file
  const projectFile = files.find(f => f.name.endsWith('.kolasein') || f.name.endsWith('.nemuframe') || f.name.endsWith('.json'));
  if (projectFile) {
    await loadProjectFromFile(projectFile);
    return;
  }

  // Otherwise handle image files
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) return;

  for (const file of imageFiles) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadImageFromUrl(dataUrl);
      const id = state.nextId++;
      state.photos.set(id, {
        id,
        name: file.name,
        img,
        url: dataUrl,
        dataUrl,
        panX: 50,
        panY: 50,
      });
      state.photoOrder.push(id);
    } catch (err) {
      console.warn('Gagal memuat file:', file.name, err);
    }
  }

  if (state.photos.size > 0) {
    applyActiveOrAutoLayout();
    showEditor();
    renderThumbnails();
    renderLayoutPresets();
    renderCollage();
    scheduleAutosave();
  }
}

function removePhoto(id) {
  state.photos.delete(id);
  state.photoOrder = state.photoOrder.filter(item => item !== id);

  if (state.photos.size === 0) {
    showUpload();
    clearAutosave();
    return;
  }

  applyActiveOrAutoLayout();
  renderThumbnails();
  renderLayoutPresets();
  renderCollage();
  scheduleAutosave();
}


// ── Screens ──

function showEditor() {
  uploadScreen.hidden = true;
  editorScreen.hidden = false;
  updateFrameSize();
}

function showUpload() {
  editorScreen.hidden = true;
  uploadScreen.hidden = false;
  checkAutosave();
}


// ── Layout Calculation & Presets ──

function applyActiveOrAutoLayout() {
  const count = state.photoOrder.length;
  const presets = getLayoutPresets(count);

  let preset = presets.find(p => p.id === state.activePresetId);
  if (!preset) {
    preset = presets[0] || { dist: distributeToRows(count) };
    state.activePresetId = preset.id || 'auto';
  }

  state.rows = buildRowsFromDistribution(state.photoOrder, preset.dist);
}

function applyLayoutPreset(presetId) {
  const count = state.photoOrder.length;
  const presets = getLayoutPresets(count);
  const target = presets.find(p => p.id === presetId);
  if (!target) return;

  state.activePresetId = target.id;
  state.rows = buildRowsFromDistribution(state.photoOrder, target.dist);

  renderLayoutPresets();
  renderCollage();
  scheduleAutosave();
}

function renderLayoutPresets() {
  layoutPresetsEl.innerHTML = '';
  const count = state.photoOrder.length;
  if (count <= 1) {
    layoutPresetsEl.innerHTML = '<span class="section-hint">Butuh minimal 2 foto untuk preset layout.</span>';
    return;
  }

  const presets = getLayoutPresets(count);

  for (const preset of presets) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    if (preset.id === state.activePresetId) {
      btn.classList.add('active');
    }
    btn.setAttribute('aria-label', `Preset layout ${preset.name}`);

    // Create visual miniature icon
    const icon = document.createElement('div');
    icon.className = 'preset-icon';
    for (const cols of preset.dist) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'preset-icon-row';
      for (let c = 0; c < cols; c++) {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'preset-icon-cell';
        rowDiv.appendChild(cellDiv);
      }
      icon.appendChild(rowDiv);
    }

    const label = document.createElement('span');
    label.textContent = preset.name;

    btn.appendChild(icon);
    btn.appendChild(label);

    btn.addEventListener('click', () => applyLayoutPreset(preset.id));
    layoutPresetsEl.appendChild(btn);
  }
}


// ── Drag & Drop Reordering (Thumbnails & Cells) ──

function movePhotoOrder(sourceId, targetId) {
  if (sourceId === targetId) return;

  const srcIdx = state.photoOrder.indexOf(sourceId);
  const tgtIdx = state.photoOrder.indexOf(targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  state.photoOrder.splice(srcIdx, 1);
  state.photoOrder.splice(tgtIdx, 0, sourceId);

  // Reorder photoIds within current rows without changing weights
  state.rows = reorderRowsPhotos(state.rows, state.photoOrder);

  renderThumbnails();
  renderCollage();
  scheduleAutosave();
}

function swapPhotos(idA, idB) {
  if (idA === idB) return;

  const idxA = state.photoOrder.indexOf(idA);
  const idxB = state.photoOrder.indexOf(idB);
  if (idxA !== -1 && idxB !== -1) {
    const temp = state.photoOrder[idxA];
    state.photoOrder[idxA] = state.photoOrder[idxB];
    state.photoOrder[idxB] = temp;
  }

  state.rows = swapCellsPhotos(state.rows, idA, idB);

  renderThumbnails();
  renderCollage();
  scheduleAutosave();
}

function renderThumbnails() {
  thumbnailsEl.innerHTML = '';
  photoCountEl.textContent = state.photoOrder.length;
  if (mobilePhotoCountEl) {
    mobilePhotoCountEl.textContent = state.photoOrder.length;
  }

  state.photoOrder.forEach((id, index) => {
    const photo = state.photos.get(id);
    if (!photo) return;

    const div = document.createElement('div');
    div.className = 'thumbnail';
    if (selectedThumbId === id) div.classList.add('selected');
    div.setAttribute('role', 'listitem');
    div.setAttribute('draggable', 'true');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Foto ${index + 1} dari ${state.photoOrder.length}`);
    div.dataset.photoId = id;

    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = `Foto ${index + 1}`;
    img.draggable = false;

    const badge = document.createElement('span');
    badge.className = 'thumb-order-badge';
    badge.textContent = `${index + 1}`;

    const actions = document.createElement('div');
    actions.className = 'thumb-actions';

    // Move left button
    if (index > 0) {
      const leftBtn = document.createElement('button');
      leftBtn.className = 'move-thumb-btn';
      leftBtn.textContent = '‹';
      leftBtn.setAttribute('aria-label', `Geser foto ${index + 1} ke kiri`);
      leftBtn.addEventListener('click', e => {
        e.stopPropagation();
        movePhotoOrder(id, state.photoOrder[index - 1]);
      });
      actions.appendChild(leftBtn);
    }

    // Move right button
    if (index < state.photoOrder.length - 1) {
      const rightBtn = document.createElement('button');
      rightBtn.className = 'move-thumb-btn';
      rightBtn.textContent = '›';
      rightBtn.setAttribute('aria-label', `Geser foto ${index + 1} ke kanan`);
      rightBtn.addEventListener('click', e => {
        e.stopPropagation();
        movePhotoOrder(id, state.photoOrder[index + 1]);
      });
      actions.appendChild(rightBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-thumb';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `Hapus foto ${index + 1}`);
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      removePhoto(id);
    });
    actions.appendChild(removeBtn);

    div.appendChild(img);
    div.appendChild(badge);
    div.appendChild(actions);

    // Mobile tap-to-swap: tap photo A then tap photo B to swap
    div.addEventListener('click', e => {
      if (e.target.closest('.remove-thumb') || e.target.closest('.move-thumb-btn')) return;
      if (selectedThumbId === null) {
        selectedThumbId = id;
        thumbnailsEl.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('selected'));
        div.classList.add('selected');
      } else if (selectedThumbId === id) {
        selectedThumbId = null;
        div.classList.remove('selected');
      } else {
        const firstId = selectedThumbId;
        selectedThumbId = null;
        thumbnailsEl.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('selected'));
        swapPhotos(firstId, id);
      }
    });

    // HTML5 Drag and drop events for thumbnail reordering
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(id));
      e.dataTransfer.effectAllowed = 'move';
      div.classList.add('dragging');
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
      thumbnailsEl.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('drag-target'));
    });

    div.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      div.classList.add('drag-target');
    });

    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-target');
    });

    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('drag-target');
      const sourceId = parseInt(e.dataTransfer.getData('text/plain'));
      if (sourceId && sourceId !== id) {
        movePhotoOrder(sourceId, id);
      }
    });

    // Keyboard support: Alt+ArrowLeft or Alt+ArrowRight to reorder
    div.addEventListener('keydown', e => {
      if (e.altKey && e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        movePhotoOrder(id, state.photoOrder[index - 1]);
      } else if (e.altKey && e.key === 'ArrowRight' && index < state.photoOrder.length - 1) {
        e.preventDefault();
        movePhotoOrder(id, state.photoOrder[index + 1]);
      }
    });

    thumbnailsEl.appendChild(div);
  });
}


// ── Aspect Ratio Controls ──

function setupRatios() {
  RATIOS.forEach((r, i) => {
    const btn = document.createElement('button');
    btn.className = 'ratio-btn';
    btn.textContent = r.name;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    btn.addEventListener('click', () => selectRatio(r, btn));
    ratioOptions.appendChild(btn);
  });

  customW.addEventListener('input', applyCustomRatio);
  customH.addEventListener('input', applyCustomRatio);
}

function selectRatio(ratio, btn) {
  state.ratio = ratio;
  ratioOptions.querySelectorAll('.ratio-btn').forEach(b => b.setAttribute('aria-checked', 'false'));
  if (btn) btn.setAttribute('aria-checked', 'true');

  if (ratio.name === 'Custom') {
    customRatio.hidden = false;
    applyCustomRatio();
  } else {
    customRatio.hidden = true;
    updateFrameSize();
    renderCollage();
    scheduleAutosave();
  }
}

function applyCustomRatio() {
  const w = Math.max(1, parseInt(customW.value) || 4);
  const h = Math.max(1, parseInt(customH.value) || 3);
  const short = 1080;
  state.ratio = {
    name: 'Custom',
    w,
    h,
    res: w >= h ? [Math.round(short * w / h), short] : [short, Math.round(short * h / w)],
  };
  updateFrameSize();
  renderCollage();
  scheduleAutosave();
}


// ── Gap and Background Controls ──

function setupControls() {
  gapSlider.addEventListener('input', () => {
    state.gap = parseInt(gapSlider.value);
    gapValue.textContent = `${state.gap}px`;
    renderCollage();
    scheduleAutosave();
  });

  bgColorInput.addEventListener('input', () => {
    state.bgColor = bgColorInput.value;
    bgColorLabel.textContent = bgColorInput.value;
    frame.style.backgroundColor = state.bgColor;
    scheduleAutosave();
  });
}


// ── Export Setup ──

function setupExport() {
  exportPng.addEventListener('click', () => doExport('png'));
  exportJpg.addEventListener('click', () => doExport('jpg'));
}

function doExport(format) {
  let res = state.ratio.res;
  if (!res) {
    const s = 1080;
    const { w, h } = state.ratio;
    res = w >= h ? [Math.round(s * w / h), s] : [s, Math.round(s * h / w)];
  }
  exportCollage(state.photos, state.rows, res, state.frameWidth, state.gap, format, state.bgColor);
}


// ── Project Save & Load ──

function setupProject() {
  saveProjectBtn.addEventListener('click', saveProjectToFile);
  loadProjectBtn.addEventListener('click', () => editorProjectInput.click());
  editorProjectInput.addEventListener('change', e => {
    if (e.target.files[0]) loadProjectFromFile(e.target.files[0]);
    e.target.value = '';
  });

  resetProjectBtn.addEventListener('click', () => {
    const ok = window.confirm('Reset kolase dan mulai dari awal? Proyek yang belum disimpan ke file akan terhapus.');
    if (!ok) return;
    clearProjectState();
    showUpload();
  });

  restoreBtn.addEventListener('click', () => {
    loadProjectFromAutosave();
  });
}

function getProjectPayload() {
  return {
    app: 'Kolasein',
    version: 1,
    savedAt: new Date().toISOString(),
    ratio: {
      name: state.ratio.name,
      w: state.ratio.w,
      h: state.ratio.h,
      res: state.ratio.res,
    },
    customW: parseInt(customW.value) || 4,
    customH: parseInt(customH.value) || 3,
    gap: state.gap,
    bgColor: state.bgColor,
    activePresetId: state.activePresetId,
    photoOrder: state.photoOrder,
    rows: state.rows.map(r => ({
      weight: r.weight,
      items: r.items.map(it => ({ photoId: it.photoId, weight: it.weight })),
    })),
    photos: state.photoOrder.map(id => {
      const p = state.photos.get(id);
      return {
        id: p.id,
        name: p.name,
        dataUrl: p.dataUrl,
        panX: p.panX,
        panY: p.panY,
      };
    }),
  };
}

function saveProjectToFile() {
  if (state.photos.size === 0) return;

  const payload = getProjectPayload();
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kolasein-project-${dateStr}.kolasein`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadProjectFromFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await applyLoadedProject(data);
  } catch (err) {
    alert('Gagal membuka file proyek. Pastikan file valid.');
    console.error(err);
  }
}

async function applyLoadedProject(data) {
  if (!data || !Array.isArray(data.photos) || data.photos.length === 0) {
    throw new Error('Format proyek tidak valid.');
  }

  // Clear current state
  state.photos.clear();
  state.photoOrder = [];

  let maxId = 0;
  for (const item of data.photos) {
    const img = await loadImageFromUrl(item.dataUrl);
    const id = item.id || ++maxId;
    if (id > maxId) maxId = id;

    state.photos.set(id, {
      id,
      name: item.name || `photo-${id}`,
      img,
      url: item.dataUrl,
      dataUrl: item.dataUrl,
      panX: item.panX ?? 50,
      panY: item.panY ?? 50,
    });
  }

  state.nextId = maxId + 1;
  state.photoOrder = Array.isArray(data.photoOrder) && data.photoOrder.length === data.photos.length
    ? data.photoOrder
    : [...state.photos.keys()];

  // Restore settings
  state.gap = typeof data.gap === 'number' ? data.gap : 4;
  gapSlider.value = state.gap;
  gapValue.textContent = `${state.gap}px`;

  state.bgColor = data.bgColor || '#e0e0e0';
  bgColorInput.value = state.bgColor;
  bgColorLabel.textContent = state.bgColor;

  state.activePresetId = data.activePresetId || 'auto';

  // Restore Ratio
  if (data.ratio) {
    const matched = RATIOS.find(r => r.name === data.ratio.name);
    if (matched && matched.name !== 'Custom') {
      state.ratio = matched;
      ratioOptions.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.setAttribute('aria-checked', btn.textContent === matched.name ? 'true' : 'false');
      });
      customRatio.hidden = true;
    } else {
      customW.value = data.customW || data.ratio.w || 4;
      customH.value = data.customH || data.ratio.h || 3;
      const customBtn = [...ratioOptions.querySelectorAll('.ratio-btn')].find(b => b.textContent === 'Custom');
      if (customBtn) selectRatio(RATIOS.find(r => r.name === 'Custom'), customBtn);
    }
  }

  // Restore Rows
  if (Array.isArray(data.rows) && data.rows.length > 0) {
    state.rows = data.rows;
  } else {
    applyActiveOrAutoLayout();
  }

  showEditor();
  renderThumbnails();
  renderLayoutPresets();
  renderCollage();
  scheduleAutosave();
}

function clearProjectState() {
  state.photos.clear();
  state.photoOrder = [];
  state.rows = [];
  state.cells = [];
  state.nextId = 1;
  clearAutosave();
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (state.photos.size === 0) return;
    try {
      const payload = getProjectPayload();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      // LocalStorage full (e.g. large images)
      console.warn('Auto-save ke localStorage terlewati:', e.message);
    }
  }, 400);
}

function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
  if (restoreBanner) restoreBanner.hidden = true;
}

function checkAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY) || localStorage.getItem('nemuframe_autosave');
    if (!raw) {
      if (restoreBanner) restoreBanner.hidden = true;
      return;
    }
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.photos) && data.photos.length > 0) {
      restoreBanner.hidden = false;
      const date = new Date(data.savedAt);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      restoreInfo.textContent = `${data.photos.length} foto tersimpan (${timeStr})`;
    } else {
      restoreBanner.hidden = true;
    }
  } catch (err) {
    if (restoreBanner) restoreBanner.hidden = true;
  }
}

async function loadProjectFromAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY) || localStorage.getItem('nemuframe_autosave');
    if (!raw) return;
    const data = JSON.parse(raw);
    await applyLoadedProject(data);
  } catch (err) {
    alert('Gagal memulihkan draf tersimpan.');
  }
}


// ── Frame Sizing ──

function updateFrameSize() {
  const area = canvasArea.getBoundingClientRect();
  const isMobile = window.innerWidth <= 800;
  const pad = isMobile ? 12 : 32;
  const hintH = isMobile ? 24 : 40;
  const availW = area.width - pad * 2;
  const availH = area.height - pad * 2 - hintH;

  if (availW <= 0 || availH <= 0) return;

  const { w: rw, h: rh } = state.ratio;
  const scale = Math.min(availW / rw, availH / rh);

  state.frameWidth = Math.floor(rw * scale);
  state.frameHeight = Math.floor(rh * scale);

  frame.style.width = `${state.frameWidth}px`;
  frame.style.height = `${state.frameHeight}px`;
  frame.style.backgroundColor = state.bgColor;
}


// ── Collage Render (Full Rebuild) ──

function renderCollage() {
  frame.innerHTML = '';
  cellEls = [];
  vHandles = [];
  hHandles = [];

  if (!state.rows.length || state.frameWidth <= 0) return;

  state.cells = calculateCells(state.rows, state.frameWidth, state.frameHeight, state.gap);

  for (const cell of state.cells) {
    const photo = state.photos.get(cell.photoId);
    if (!photo) continue;

    const div = document.createElement('div');
    div.className = 'collage-cell';
    div.tabIndex = 0;
    div.setAttribute('role', 'img');
    div.setAttribute('aria-label', `Foto ${cell.photoId}`);
    div.dataset.photoId = cell.photoId;

    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = '';
    img.draggable = false;
    img.style.objectPosition = `${photo.panX}% ${photo.panY}%`;

    // Swap drag grip handle on top-left
    const gripBtn = document.createElement('button');
    gripBtn.className = 'cell-grip';
    gripBtn.textContent = '⋮⋮';
    gripBtn.setAttribute('title', 'Tukar posisi foto');
    gripBtn.setAttribute('aria-label', `Tukar posisi foto ${cell.photoId}`);
    gripBtn.setAttribute('draggable', 'true');

    // Remove button on top-right
    const removeBtn = document.createElement('button');
    removeBtn.className = 'cell-remove';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `Hapus foto ${cell.photoId}`);
    removeBtn.addEventListener('pointerdown', e => e.stopPropagation());
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      removePhoto(cell.photoId);
    });

    div.appendChild(img);
    div.appendChild(gripBtn);
    div.appendChild(removeBtn);
    frame.appendChild(div);
    cellEls.push(div);

    // Tap to select cell on touch devices (reveals control buttons)
    div.addEventListener('click', e => {
      if (e.target.closest('.cell-remove') || e.target.closest('.cell-grip')) return;
      const wasSelected = div.classList.contains('cell-selected');
      frame.querySelectorAll('.collage-cell').forEach(c => c.classList.remove('cell-selected'));
      if (!wasSelected) {
        div.classList.add('cell-selected');
      }
    });

    // Grip drag events for cell-to-cell swap
    gripBtn.addEventListener('dragstart', e => {
      e.stopPropagation();
      e.dataTransfer.setData('text/cell-photo-id', String(cell.photoId));
      e.dataTransfer.effectAllowed = 'move';
      document.body.classList.add('swapping');
    });

    gripBtn.addEventListener('dragend', () => {
      document.body.classList.remove('swapping');
      frame.querySelectorAll('.collage-cell').forEach(c => c.classList.remove('cell-drop-target'));
    });

    // Cell drop targets for swap
    div.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/cell-photo-id') || e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        div.classList.add('cell-drop-target');
      }
    });

    div.addEventListener('dragleave', () => {
      div.classList.remove('cell-drop-target');
    });

    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('cell-drop-target');
      const draggedCellId = parseInt(e.dataTransfer.getData('text/cell-photo-id') || e.dataTransfer.getData('text/plain'));
      if (draggedCellId && draggedCellId !== cell.photoId) {
        swapPhotos(draggedCellId, cell.photoId);
      }
    });
  }

  // Vertical handles (between cells in same row)
  for (let ri = 0; ri < state.rows.length; ri++) {
    const row = state.rows[ri];
    for (let ci = 0; ci < row.items.length - 1; ci++) {
      const el = document.createElement('div');
      el.className = 'resize-handle vertical';
      el.setAttribute('role', 'separator');
      el.setAttribute('aria-orientation', 'vertical');
      el.tabIndex = 0;
      frame.appendChild(el);
      vHandles.push({ el, rowIdx: ri, leftIdx: ci, rightIdx: ci + 1 });
    }
  }

  // Horizontal handles (between rows)
  for (let ri = 0; ri < state.rows.length - 1; ri++) {
    const el = document.createElement('div');
    el.className = 'resize-handle horizontal';
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-orientation', 'horizontal');
    el.tabIndex = 0;
    frame.appendChild(el);
    hHandles.push({ el, topIdx: ri, bottomIdx: ri + 1 });
  }

  positionElements();
  attachInteractions();
}


// ── Position Update (No DOM rebuild, smooth during drag) ──

function positionElements() {
  state.cells = calculateCells(state.rows, state.frameWidth, state.frameHeight, state.gap);

  state.cells.forEach((cell, i) => {
    const el = cellEls[i];
    if (!el) return;
    el.style.left   = `${cell.x}px`;
    el.style.top    = `${cell.y}px`;
    el.style.width  = `${cell.width}px`;
    el.style.height = `${cell.height}px`;
  });

  const HANDLE_W = window.innerWidth <= 800 ? 38 : 24;

  // Vertical handles
  let vi = 0;
  for (let ri = 0; ri < state.rows.length; ri++) {
    const rowCells = state.cells.filter(c => c.rowIndex === ri);
    for (let ci = 0; ci < rowCells.length - 1; ci++) {
      const h = vHandles[vi];
      if (!h) { vi++; continue; }
      const left = rowCells[ci];
      const gapCenter = left.x + left.width + state.gap / 2;
      h.el.style.left   = `${gapCenter - HANDLE_W / 2}px`;
      h.el.style.top    = `${left.y}px`;
      h.el.style.width  = `${HANDLE_W}px`;
      h.el.style.height = `${left.height}px`;
      vi++;
    }
  }

  // Horizontal handles
  for (let i = 0; i < hHandles.length; i++) {
    const h = hHandles[i];
    const topCells = state.cells.filter(c => c.rowIndex === h.topIdx);
    if (!topCells.length) continue;
    const topY = topCells[0].y + topCells[0].height;
    const gapCenter = topY + state.gap / 2;
    h.el.style.left   = '0';
    h.el.style.top    = `${gapCenter - HANDLE_W / 2}px`;
    h.el.style.width  = `${state.frameWidth}px`;
    h.el.style.height = `${HANDLE_W}px`;
  }
}


// ── Interactions (Crop Pan, Border Resize, Keyboard) ──

function attachInteractions() {
  // Cell pan (crop positioning)
  cellEls.forEach((el, i) => {
    const cell = state.cells[i];
    if (!cell) return;
    const photo = state.photos.get(cell.photoId);
    if (!photo) return;
    attachPan(el, photo, i);
  });

  // Vertical resize
  vHandles.forEach(h => attachVerticalResize(h));

  // Horizontal resize
  hHandles.forEach(h => attachHorizontalResize(h));

  // Keyboard navigation on handles
  vHandles.forEach(h => {
    h.el.addEventListener('keydown', e => {
      const step = 0.1;
      const row = state.rows[h.rowIdx];
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        row.items[h.leftIdx].weight = Math.max(MIN_WEIGHT, row.items[h.leftIdx].weight - step);
        row.items[h.rightIdx].weight += step;
        positionElements();
        scheduleAutosave();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        row.items[h.rightIdx].weight = Math.max(MIN_WEIGHT, row.items[h.rightIdx].weight - step);
        row.items[h.leftIdx].weight += step;
        positionElements();
        scheduleAutosave();
      }
    });
  });

  hHandles.forEach(h => {
    h.el.addEventListener('keydown', e => {
      const step = 0.1;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.rows[h.topIdx].weight = Math.max(MIN_WEIGHT, state.rows[h.topIdx].weight - step);
        state.rows[h.bottomIdx].weight += step;
        positionElements();
        scheduleAutosave();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.rows[h.bottomIdx].weight = Math.max(MIN_WEIGHT, state.rows[h.bottomIdx].weight - step);
        state.rows[h.topIdx].weight += step;
        positionElements();
        scheduleAutosave();
      }
    });
  });

  // Keyboard pan + delete on cells
  cellEls.forEach((el, i) => {
    const cell = state.cells[i];
    if (!cell) return;
    const photo = state.photos.get(cell.photoId);
    if (!photo) return;

    el.addEventListener('keydown', e => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removePhoto(cell.photoId);
        return;
      }

      const panStep = 3;
      let changed = false;
      if (e.key === 'ArrowLeft')  { photo.panX = clamp(photo.panX - panStep, 0, 100); changed = true; }
      if (e.key === 'ArrowRight') { photo.panX = clamp(photo.panX + panStep, 0, 100); changed = true; }
      if (e.key === 'ArrowUp')    { photo.panY = clamp(photo.panY - panStep, 0, 100); changed = true; }
      if (e.key === 'ArrowDown')  { photo.panY = clamp(photo.panY + panStep, 0, 100); changed = true; }

      if (changed) {
        e.preventDefault();
        el.querySelector('img').style.objectPosition = `${photo.panX}% ${photo.panY}%`;
        scheduleAutosave();
      }
    });
  });
}

function attachPan(cellEl, photo, cellIndex) {
  let startX, startY, startPanX, startPanY;

  cellEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.cell-remove') || e.target.closest('.cell-grip')) return;
    e.preventDefault();
    cellEl.setPointerCapture(e.pointerId);
    document.body.classList.add('panning');

    startX = e.clientX;
    startY = e.clientY;
    startPanX = photo.panX;
    startPanY = photo.panY;

    const onMove = ev => {
      const cell = state.cells[cellIndex];
      if (!cell) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const ir = photo.img.naturalWidth / photo.img.naturalHeight;
      const cr = cell.width / cell.height;

      let sensX = 0, sensY = 0;
      if (ir > cr) {
        const overflow = cell.height * ir - cell.width;
        if (overflow > 0) sensX = 100 / overflow;
      } else {
        const overflow = cell.width / ir - cell.height;
        if (overflow > 0) sensY = 100 / overflow;
      }

      photo.panX = clamp(startPanX - dx * sensX, 0, 100);
      photo.panY = clamp(startPanY - dy * sensY, 0, 100);
      cellEl.querySelector('img').style.objectPosition = `${photo.panX}% ${photo.panY}%`;
    };

    const onUp = ev => {
      cellEl.releasePointerCapture(ev.pointerId);
      document.body.classList.remove('panning');
      cellEl.removeEventListener('pointermove', onMove);
      cellEl.removeEventListener('pointerup', onUp);
      scheduleAutosave();
    };

    cellEl.addEventListener('pointermove', onMove);
    cellEl.addEventListener('pointerup', onUp);
  });
}

function attachVerticalResize(handle) {
  let startX, startLeftW, startRightW;

  handle.el.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    handle.el.setPointerCapture(e.pointerId);
    document.body.classList.add('resize-col');

    const row = state.rows[handle.rowIdx];
    startX = e.clientX;
    startLeftW = row.items[handle.leftIdx].weight;
    startRightW = row.items[handle.rightIdx].weight;

    const onMove = ev => {
      const dx = ev.clientX - startX;
      const row = state.rows[handle.rowIdx];
      const totalW = row.items.reduce((s, it) => s + it.weight, 0);
      const gapTotal = state.gap * (row.items.length - 1);
      const availPx = state.frameWidth - gapTotal;
      if (availPx <= 0) return;
      const wPerPx = totalW / availPx;

      let newL = startLeftW + dx * wPerPx;
      let newR = startRightW - dx * wPerPx;

      if (newL < MIN_WEIGHT) { newR += (newL - MIN_WEIGHT); newL = MIN_WEIGHT; }
      if (newR < MIN_WEIGHT) { newL += (newR - MIN_WEIGHT); newR = MIN_WEIGHT; }

      row.items[handle.leftIdx].weight = Math.max(MIN_WEIGHT, newL);
      row.items[handle.rightIdx].weight = Math.max(MIN_WEIGHT, newR);
      positionElements();
    };

    const onUp = ev => {
      handle.el.releasePointerCapture(ev.pointerId);
      document.body.classList.remove('resize-col');
      handle.el.removeEventListener('pointermove', onMove);
      handle.el.removeEventListener('pointerup', onUp);
      scheduleAutosave();
    };

    handle.el.addEventListener('pointermove', onMove);
    handle.el.addEventListener('pointerup', onUp);
  });
}

function attachHorizontalResize(handle) {
  let startY, startTopW, startBottomW;

  handle.el.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    handle.el.setPointerCapture(e.pointerId);
    document.body.classList.add('resize-row');

    startY = e.clientY;
    startTopW = state.rows[handle.topIdx].weight;
    startBottomW = state.rows[handle.bottomIdx].weight;

    const onMove = ev => {
      const dy = ev.clientY - startY;
      const totalW = state.rows.reduce((s, r) => s + r.weight, 0);
      const gapTotal = state.gap * (state.rows.length - 1);
      const availPx = state.frameHeight - gapTotal;
      if (availPx <= 0) return;
      const wPerPx = totalW / availPx;

      let newT = startTopW + dy * wPerPx;
      let newB = startBottomW - dy * wPerPx;

      if (newT < MIN_WEIGHT) { newB += (newT - MIN_WEIGHT); newT = MIN_WEIGHT; }
      if (newB < MIN_WEIGHT) { newT += (newB - MIN_WEIGHT); newB = MIN_WEIGHT; }

      state.rows[handle.topIdx].weight = Math.max(MIN_WEIGHT, newT);
      state.rows[handle.bottomIdx].weight = Math.max(MIN_WEIGHT, newB);
      positionElements();
    };

    const onUp = ev => {
      handle.el.releasePointerCapture(ev.pointerId);
      document.body.classList.remove('resize-row');
      handle.el.removeEventListener('pointermove', onMove);
      handle.el.removeEventListener('pointerup', onUp);
      scheduleAutosave();
    };

    handle.el.addEventListener('pointermove', onMove);
    handle.el.addEventListener('pointerup', onUp);
  });
}


// ── Window Resize ──

function setupResize() {
  const ro = new ResizeObserver(() => {
    if (editorScreen.hidden) return;
    updateFrameSize();
    renderCollage();
  });
  ro.observe(canvasArea);
}


// ── Util ──

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}


// ── Mobile Navigation Tabs ──

function setupMobileTabs() {
  const tabBtns = document.querySelectorAll('.mobile-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.sidebar-tab-content').forEach(tab => {
        if (tab.id === targetId) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    });
  });
}


// ── Init ──

function init() {
  setupUpload();
  setupRatios();
  setupControls();
  setupProject();
  setupExport();
  setupResize();
  setupMobileTabs();
  checkAutosave();
}

init();
