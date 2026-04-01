const API      = '/api/notes';
const CATS_API = '/api/categories';

const CAT_COLORS = [
    '#388bfd', '#3fb950', '#f85149', '#e3b341',
    '#a371f7', '#f78166', '#39c5cf', '#db6d28',
    '#58a6ff', '#56d364', '#ffa198', '#ffdf5d',
];

/** @type {Array<object>} */
let allNotes = [];

/** @type {Array<{id: string, name: string, color: string}>} */
let allCategories = [];

/** @type {string|null} */
let activeId = null;

let isDirty = false;

/** @type {ReturnType<typeof setTimeout>|null} */
let saveTimeout = null;

/** @type {string|null} */
let editingCatId = null;

/** @type {string|null} */
let deletingCatId = null;

let catDropdownOpen = false;

const viewList        = /** @type {HTMLElement} */ (document.getElementById('viewList'));
const viewEditor      = /** @type {HTMLElement} */ (document.getElementById('viewEditor'));
const notesList       = /** @type {HTMLUListElement} */ (document.getElementById('notesList'));
const notesEmpty      = /** @type {HTMLElement} */ (document.getElementById('notesEmpty'));
const notesCount      = /** @type {HTMLElement} */ (document.getElementById('notesCount'));
const searchInput     = /** @type {HTMLInputElement} */ (document.getElementById('searchInput'));
const sortSelect      = /** @type {HTMLSelectElement} */ (document.getElementById('sortSelect'));
const catFilterSelect = /** @type {HTMLSelectElement} */ (document.getElementById('catFilterSelect'));
const btnNew          = /** @type {HTMLButtonElement} */ (document.getElementById('btnNew'));
const btnManageCats   = /** @type {HTMLButtonElement} */ (document.getElementById('btnManageCats'));

const btnBack          = /** @type {HTMLButtonElement} */ (document.getElementById('btnBack'));
const btnSave          = /** @type {HTMLButtonElement} */ (document.getElementById('btnSave'));
const btnDeleteNote    = /** @type {HTMLButtonElement} */ (document.getElementById('btnDeleteNote'));
const noteTitle        = /** @type {HTMLInputElement} */ (document.getElementById('noteTitle'));
const noteContent      = /** @type {HTMLTextAreaElement} */ (document.getElementById('noteContent'));
const charCount        = /** @type {HTMLElement} */ (document.getElementById('charCount'));
const noteInfo         = /** @type {HTMLElement} */ (document.getElementById('noteInfo'));
const catPillsEditor   = /** @type {HTMLElement} */ (document.getElementById('catPillsEditor'));
const btnAddCatPill    = /** @type {HTMLButtonElement} */ (document.getElementById('btnAddCatPill'));
const catDropdown      = /** @type {HTMLElement} */ (document.getElementById('catDropdown'));
const catDropdownInner = /** @type {HTMLElement} */ (document.getElementById('catDropdownInner'));

const overlayDeleteNote    = document.getElementById('overlayDeleteNote');
const btnCancelDeleteNote  = document.getElementById('btnCancelDeleteNote');
const btnConfirmDeleteNote = document.getElementById('btnConfirmDeleteNote');

const overlayCatManager  = document.getElementById('overlayCatManager');
const btnCloseCatManager = document.getElementById('btnCloseCatManager');
const catManagerList     = document.getElementById('catManagerList');
const catManagerForm     = document.getElementById('catManagerForm');
const catFormName        = /** @type {HTMLInputElement} */ (document.getElementById('catFormName'));
const catFormColors      = document.getElementById('catFormColors');
const btnCancelCatForm   = document.getElementById('btnCancelCatForm');
const btnSaveCatForm     = document.getElementById('btnSaveCatForm');
const btnOpenCatForm     = document.getElementById('btnOpenCatForm');

const overlayDeleteCat    = document.getElementById('overlayDeleteCat');
const btnCancelDeleteCat  = document.getElementById('btnCancelDeleteCat');
const btnConfirmDeleteCat = document.getElementById('btnConfirmDeleteCat');

const toast = /** @type {HTMLElement} */ (document.getElementById('toast'));

/**
 * @param {string} msg
 * @param {number} [dur=2400]
 */
const showToast = (msg, dur = 2400) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), dur);
};

/**
 * @param {string} iso
 * @returns {string}
 */
const formatDate = (iso) => {
    const d    = new Date(iso);
    const now  = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) {
        return 'przed chwilą';
    }
    if (diff < 3600) {
        return `${Math.floor(diff / 60)} min temu`;
    }
    if (diff < 86400) {
        return `${Math.floor(diff / 3600)} godz. temu`;
    }

    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * @param {string} str
 * @returns {string}
 */
const escHtml = (str) =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * @param {boolean} val
 */
const setDirty = (val) => {
    isDirty = val;
    btnSave.textContent = val ? 'Zapisz *' : 'Zapisz';
};

/**
 * @param {string|null} id
 * @returns {{id: string, name: string, color: string}|null}
 */
const getCategoryById = (id) =>
    allCategories.find(c => c.id === id) ?? null;

/**
 * @returns {string[]}
 */
const getEditorCategoryIds = () =>
    [...catPillsEditor.querySelectorAll('.cat-pill-editor')]
        .map(el => el.dataset.catId)
        .filter(Boolean);

const showListView = () => {
    viewList.style.display   = 'flex';
    viewEditor.style.display = 'none';
};

const showEditorView = () => {
    viewList.style.display   = 'none';
    viewEditor.style.display = 'flex';
};

/**
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<any>}
 */
const apiFetch = async (url, opts = {}) => {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
};

/** @returns {Promise<Array>} */
const fetchNotes      = ()       => apiFetch(API);

/** @param {string} id @returns {Promise<object>} */
const fetchNote       = (id)     => apiFetch(`${API}/${id}`);

/** @param {object} data @returns {Promise<object>} */
const createNote      = (data)   => apiFetch(API, { method: 'POST', body: JSON.stringify(data) });

/** @param {string} id @param {object} data @returns {Promise<object>} */
const updateNote      = (id, d)  => apiFetch(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(d) });

/** @param {string} id @returns {Promise<object>} */
const deleteNote      = (id)     => apiFetch(`${API}/${id}`, { method: 'DELETE' });

/** @returns {Promise<Array>} */
const fetchCategories = ()       => apiFetch(CATS_API);

/** @param {object} data @returns {Promise<object>} */
const createCategory  = (data)   => apiFetch(CATS_API, { method: 'POST', body: JSON.stringify(data) });

/** @param {string} id @param {object} data @returns {Promise<object>} */
const updateCategory  = (id, d)  => apiFetch(`${CATS_API}/${id}`, { method: 'PUT', body: JSON.stringify(d) });

/** @param {string} id @returns {Promise<object>} */
const deleteCategory  = (id)     => apiFetch(`${CATS_API}/${id}`, { method: 'DELETE' });

/**
 * @param {Array} notes
 * @returns {Array}
 */
const sortNotes = (notes) => {
    const [field, dir] = sortSelect.value.split('-');

    return [...notes].sort((a, b) => {
        if (field === 'updatedAt' || field === 'createdAt') {
            const va = new Date(a[field]);
            const vb = new Date(b[field]);
            return dir === 'desc' ? vb - va : va - vb;
        }
        const va = (a[field] || '').toLowerCase();
        const vb = (b[field] || '').toLowerCase();
        return dir === 'asc' ? va.localeCompare(vb, 'pl') : vb.localeCompare(va, 'pl');
    });
};

/**
 * @param {Array} notes
 * @returns {Array}
 */
const filterNotes = (notes) => {
    const q      = searchInput.value.trim().toLowerCase();
    const catVal = catFilterSelect.value;
    let result   = notes;

    if (catVal === '__none__') {
        result = result.filter(n => !n.categoryIds || n.categoryIds.length === 0);
    } else if (catVal) {
        result = result.filter(n => Array.isArray(n.categoryIds) && n.categoryIds.includes(catVal));
    }

    if (q) {
        result = result.filter(n =>
            (n.title || '').toLowerCase().includes(q) ||
            (n.preview || '').toLowerCase().includes(q)
        );
    }

    return result;
};

const renderCatFilterOptions = () => {
    const prev = catFilterSelect.value;
    catFilterSelect.innerHTML = `
        <option value="">Wszystkie kategorie</option>
        <option value="__none__">Bez kategorii</option>
    `;
    allCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value       = cat.id;
        opt.textContent = cat.name;
        catFilterSelect.appendChild(opt);
    });
    if (prev) catFilterSelect.value = prev;
};

/**
 * @param {{name: string, color: string}} cat
 * @returns {string}
 */
const catBadgeHtml = (cat) => {
    const bg   = cat.color + '22';
    const text = cat.color;
    return `
        <span class="cat-badge" style="background:${bg};color:${text};border-color:${cat.color}44">
            <span class="cat-badge-dot" style="background:${cat.color}"></span>
            ${escHtml(cat.name)}
        </span>`;
};

const renderList = () => {
    const visible = filterNotes(sortNotes(allNotes));

    const count = visible.length;
    notesCount.textContent = count
        ? `${count} ${count === 1 ? 'notatka' : count < 5 ? 'notatki' : 'notatek'}`
        : 'Brak notatek';

    if (!count) {
        notesList.innerHTML = '';
        notesEmpty.style.display = 'flex';
        return;
    }

    notesEmpty.style.display = 'none';

    notesList.innerHTML = visible.map(n => {
        const cats   = (n.categoryIds || []).map(id => getCategoryById(id)).filter(Boolean);
        const badges = cats.map(catBadgeHtml).join('');

        return `
            <li class="note-row${n.id === activeId ? ' active' : ''}" data-id="${n.id}">
                <span class="note-row-name">
                    ${escHtml(n.title || 'Bez tytułu')}
                </span>
                <span class="note-row-cats">${badges}</span>
                <span class="note-row-date">${formatDate(n.updatedAt)}</span>
            </li>`;
    }).join('');

    notesList.querySelectorAll('.note-row').forEach(el => {
        el.addEventListener('click', () => openNote(el.dataset.id));
    });
};

/**
 * @param {string[]} categoryIds
 */
const renderEditorCatPills = (categoryIds) => {
    btnAddCatPill.hidden = categoryIds.length == allCategories.length;

    catPillsEditor.innerHTML = '';
    (categoryIds || []).forEach(id => {
        const cat = getCategoryById(id);
        if (!cat) return;

        const bg   = cat.color + '22';
        const text = cat.color;

        const pill = document.createElement('span');
        pill.className          = 'cat-pill-editor';
        pill.dataset.catId      = cat.id;
        pill.style.background   = bg;
        pill.style.color        = text;
        pill.style.borderColor  = cat.color + '55';
        pill.innerHTML = `
            ${escHtml(cat.name)}
            <button class="cat-pill-remove" title="Usuń kategorię" data-cat-id="${cat.id}">✕</button>`;
        catPillsEditor.appendChild(pill);
    });

    catPillsEditor.querySelectorAll('.cat-pill-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCategoryFromEditor(btn.dataset.catId);
        });
    });
};

/**
 * @param {string} catId
 */
const removeCategoryFromEditor = (catId) => {
    const current = getEditorCategoryIds().filter(id => id !== catId);
    renderEditorCatPills(current);
    scheduleAutoSave();
};

const toggleCatDropdown = () => {
    catDropdownOpen = !catDropdownOpen;
    catDropdown.style.display = catDropdownOpen ? 'flex' : 'none';

    if (!catDropdownOpen) return;

    const selected = getEditorCategoryIds();
    catDropdownInner.innerHTML = '';

    if (!allCategories.length) {
        catDropdownInner.innerHTML = `<span style="font-size:12px;color:var(--text-faint);padding:4px 6px">
            Brak kategorii — utwórz je w <strong>Kategorie</strong>
        </span>`;
        return;
    }

    allCategories.forEach(cat => {
        const isSelected = selected.includes(cat.id);

        if (isSelected) {
            return;
        }

        const bg   = cat.color + '33';
        const text = cat.color;

        const item = document.createElement('button');
        item.className = `cat-dropdown-item${isSelected ? ' selected' : ''}`;
        item.dataset.catId = cat.id;
        item.style.background  = bg;
        item.style.color       = text;
        item.style.borderColor = cat.color + '66';
        item.innerHTML = `
            <span class="cat-badge-dot" style="background:${cat.color}"></span>
            ${escHtml(cat.name)}
            ${isSelected ? ' ✓' : ''}`;

        item.addEventListener('click', () => {
            const cur = getEditorCategoryIds();
            const next = isSelected
                ? cur.filter(id => id !== cat.id)
                : [...cur, cat.id];
            renderEditorCatPills(next);
            toggleCatDropdown();
            scheduleAutoSave();
        });

        catDropdownInner.appendChild(item);
    });
};

/**
 * @param {object} note
 */
const populateEditor = (note) => {
    noteTitle.value             = note.title || '';
    noteContent.value           = note.content || '';

    renderEditorCatPills(note.categoryIds || []);
    updateCharCount();
    updateNoteInfo(note);
    setDirty(false);
};

const updateCharCount = () => {
    const n = noteContent.value.length;
    charCount.textContent = `${n.toLocaleString('pl-PL')} ${n === 1 ? 'znak' : 'znaków'}`;
};

/**
 * @param {object} note
 */
const updateNoteInfo = (note) => {
    if (!note) { noteInfo.textContent = ''; return; }
    const created = new Date(note.createdAt).toLocaleDateString('pl-PL', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
    noteInfo.textContent = `Utworzono: ${created}`;
};

/**
 * @param {string} [selected]
 */
const buildCatFormColors = (selected = CAT_COLORS[0]) => {
    catFormColors.innerHTML = '';
    CAT_COLORS.forEach(hex => {
        const sw = document.createElement('button');
        sw.className      = `cat-form-color-swatch${hex === selected ? ' selected' : ''}`;
        sw.style.background = hex;
        sw.title = hex;
        sw.addEventListener('click', () => {
            catFormColors.querySelectorAll('.cat-form-color-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
        });
        catFormColors.appendChild(sw);
    });
};

/**
 * @returns {string}
 */
const getCatFormColor = () => {
    const sel = catFormColors.querySelector('.cat-form-color-swatch.selected');
    return sel ? sel.title : CAT_COLORS[0];
};

const renderCatManagerList = () => {
    if (!allCategories.length) {
        catManagerList.innerHTML = `<li class="cat-manager-empty">Nie masz żadnych kategorii.</li>`;
        return;
    }

    catManagerList.innerHTML = allCategories.map(cat => `
        <li class="cat-manager-item" data-id="${cat.id}">
            <span class="cat-manager-dot" style="background:${cat.color}"></span>
            <span class="cat-manager-name">${escHtml(cat.name)}</span>
            <span class="cat-manager-actions">
                <button class="cat-mgr-btn edit" data-id="${cat.id}">Edytuj</button>
                <button class="cat-mgr-btn delete" data-id="${cat.id}">Usuń</button>
            </span>
        </li>
    `).join('');

    catManagerList.querySelectorAll('.cat-mgr-btn.edit').forEach(btn => {
        btn.addEventListener('click', () => openCatForm(btn.dataset.id));
    });

    catManagerList.querySelectorAll('.cat-mgr-btn.delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deletingCatId = btn.dataset.id;
            overlayDeleteCat.classList.add('visible');
        });
    });
};

/**
 * @param {string|null} catId
 */
const openCatForm = (catId = null) => {
    editingCatId = catId;
    const cat    = catId ? getCategoryById(catId) : null;

    catFormName.value = cat ? cat.name : '';
    buildCatFormColors(cat ? cat.color : CAT_COLORS[0]);
    catManagerForm.classList.add('open');
    setTimeout(() => catFormName.focus(), 60);
};

const closeCatForm = () => {
    catManagerForm.classList.remove('open');
    catFormName.value = '';
    editingCatId = null;
};

const saveCatForm = async () => {
    const name  = catFormName.value.trim();
    const color = getCatFormColor();

    if (!name) { catFormName.focus(); return; }

    try {
        if (editingCatId) {
            const updated = await updateCategory(editingCatId, { name, color });
            const idx     = allCategories.findIndex(c => c.id === editingCatId);
            if (idx !== -1) allCategories[idx] = updated;
            showToast('Kategoria zaktualizowana');
        } else {
            const cat = await createCategory({ name, color });
            allCategories.push(cat);
            showToast('Kategoria dodana');
        }

        closeCatForm();
        renderCatManagerList();
        renderCatFilterOptions();
        renderList();
    } catch (e) {
        showToast(`${e.message}`);
    }
};

const doDeleteCategory = async () => {
    overlayDeleteCat.classList.remove('visible');
    if (!deletingCatId) return;

    try {
        await deleteCategory(deletingCatId);
        allCategories = allCategories.filter(c => c.id !== deletingCatId);

        allNotes.forEach(n => {
            if (Array.isArray(n.categoryIds))
                n.categoryIds = n.categoryIds.filter(id => id !== deletingCatId);
        });

        deletingCatId = null;
        renderCatManagerList();
        renderCatFilterOptions();
        renderList();
        showToast('Kategoria usunięta');
    } catch {
        showToast('Błąd usuwania kategorii');
    }
};

/**
 * @param {string} id
 */
const openNote = async (id) => {
    if (isDirty && activeId) await saveCurrentNote(true);

    activeId = id;
    const note = await fetchNote(id);

    populateEditor(note);
    showEditorView();
};

const createNewNote = async () => {
    if (isDirty && activeId) await saveCurrentNote(true);

    try {
        const note = await createNote({
            title:       'Nowa notatka',
            content:     '',
            categoryIds: [],
        });

        allNotes.unshift({
            id:          note.id,
            title:       note.title,
            preview:     '',
            updatedAt:   note.updatedAt,
            createdAt:   note.createdAt,
            color:       note.color,
            categoryIds: note.categoryIds,
        });

        activeId = note.id;
        populateEditor(note);
        showEditorView();
        noteTitle.select();
        showToast('Nowa notatka');
    } catch {
        showToast('Błąd tworzenia notatki');
    }
};

/**
 * @param {boolean} silent
 */
const saveCurrentNote = async (silent = false) => {
    if (!activeId) return;

    const title       = noteTitle.value.trim() || 'Bez tytułu';
    const content     = noteContent.value;
    const categoryIds = getEditorCategoryIds();

    try {
        const updated = await updateNote(activeId, { title, content, categoryIds });

        const idx = allNotes.findIndex(n => n.id === activeId);
        if (idx !== -1) {
            allNotes[idx] = {
                ...allNotes[idx],
                title:       updated.title,
                preview:     (updated.content || '').replace(/\n/g, ' ').substring(0, 140),
                updatedAt:   updated.updatedAt,
                categoryIds: updated.categoryIds,
            };
        }

        updateNoteInfo(updated);
        setDirty(false);
        if (!silent) showToast('Zapisano');
    } catch {
        showToast('Błąd zapisu');
    }
};

const scheduleAutoSave = () => {
    setDirty(true);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveCurrentNote(true), 3000);
};

const doDeleteNote = async () => {
    overlayDeleteNote.classList.remove('visible');
    if (!activeId) return;

    try {
        await deleteNote(activeId);
        allNotes   = allNotes.filter(n => n.id !== activeId);
        activeId   = null;
        isDirty    = false;

        showListView();
        renderList();
        showToast('Notatka usunięta');
    } catch {
        showToast('Błąd usuwania');
    }
};

btnNew.addEventListener('click', createNewNote);
btnManageCats.addEventListener('click', () => {
    renderCatManagerList();
    overlayCatManager.classList.add('visible');
});
searchInput.addEventListener('input', renderList);
sortSelect.addEventListener('change', renderList);
catFilterSelect.addEventListener('change', renderList);

btnBack.addEventListener('click', async () => {
    if (isDirty) await saveCurrentNote(true);
    showListView();
    renderList();
});

btnSave.addEventListener('click', () => saveCurrentNote(false));

btnDeleteNote.addEventListener('click', () => {
    if (activeId) overlayDeleteNote.classList.add('visible');
});

noteTitle.addEventListener('input', () => {
    scheduleAutoSave();
});

noteContent.addEventListener('input', () => {
    updateCharCount();
    scheduleAutoSave();
});

btnAddCatPill.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCatDropdown();
});

document.addEventListener('click', (e) => {
    if (catDropdownOpen && !catDropdown.contains(e.target) && e.target !== btnAddCatPill) {
        catDropdownOpen = false;
        catDropdown.style.display = 'none';
    }
});

btnCancelDeleteNote.addEventListener('click',  () => overlayDeleteNote.classList.remove('visible'));
btnConfirmDeleteNote.addEventListener('click', doDeleteNote);
overlayDeleteNote.addEventListener('click', (e) => {
    if (e.target === overlayDeleteNote) overlayDeleteNote.classList.remove('visible');
});

btnCloseCatManager.addEventListener('click', () => overlayCatManager.classList.remove('visible'));
overlayCatManager.addEventListener('click', (e) => {
    if (e.target === overlayCatManager) overlayCatManager.classList.remove('visible');
});
btnOpenCatForm.addEventListener('click', () => openCatForm(null));
btnCancelCatForm.addEventListener('click', closeCatForm);
btnSaveCatForm.addEventListener('click', saveCatForm);
catFormName.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCatForm(); });

btnCancelDeleteCat.addEventListener('click',  () => overlayDeleteCat.classList.remove('visible'));
btnConfirmDeleteCat.addEventListener('click', doDeleteCategory);
overlayDeleteCat.addEventListener('click', (e) => {
    if (e.target === overlayDeleteCat) overlayDeleteCat.classList.remove('visible');
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentNote(false);
    }
    if (e.key === 'Escape') {
        overlayDeleteNote.classList.remove('visible');
        overlayCatManager.classList.remove('visible');
        overlayDeleteCat.classList.remove('visible');
        if (catDropdownOpen) {
            catDropdownOpen = false;
            catDropdown.style.display = 'none';
        }
    }
});

window.addEventListener('beforeunload', (e) => {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});

(async () => {
    try {
        [allNotes, allCategories] = await Promise.all([fetchNotes(), fetchCategories()]);
        renderCatFilterOptions();
        renderList();
    } catch {
        showToast('Nie można połączyć z serwerem');
        notesCount.textContent = 'Błąd połączenia';
    }
})();
