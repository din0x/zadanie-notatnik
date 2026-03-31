import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const NOTES_DIR  = 'notes';
const PUBLIC_DIR = 'public';
const CATS_FILE = 'categories.json';
const PORT = 6767;

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });

/**
 * @returns {Array<{id: string, name: string, color: string, createdAt: string}>}
 */
const readCategories = () => {
    try { return JSON.parse(fs.readFileSync(CATS_FILE, 'utf8')); }
    catch { return []; }
};

/**
 * @param {Array} cats
 */
const writeCategories = (cats) =>
    fs.writeFileSync(CATS_FILE, JSON.stringify(cats, null, 4));

/**
 * @param {string} title
 * @returns {string}
 */
const slugify = (title) =>
    title
        .toLowerCase()
        .replace(/[^a-z0-9ąćęłńóśźż\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 80) || 'notatka';

/**
 * @returns {string}
 */
const generateId = () =>
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

/**
 * @param {string} id
 * @returns {string|null}
 */
const getNoteFilePath = (id) => {
    const files = fs.readdirSync(NOTES_DIR);
    const file  = files.find(f => f.startsWith(id + '_') || f === id + '.json');
    return file ? path.join(NOTES_DIR, file) : null;
};

/**
 * @param {string} filePath
 * @returns {object|null}
 */
const readNote = (filePath) => {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return null; }
};

/**
 * @returns {Array}
 */
const getAllNotes = () => {
    if (!fs.existsSync(NOTES_DIR)) return [];
    return fs
        .readdirSync(NOTES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => readNote(path.join(NOTES_DIR, f)))
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

/**
 * @param {object} n
 * @returns {object}
 */
const noteToListItem = (n) => ({
    id:          n.id,
    title:       n.title,
    preview:     (n.content || '').replace(/\n/g, ' ').substring(0, 140),
    updatedAt:   n.updatedAt,
    createdAt:   n.createdAt,
    categoryIds: Array.isArray(n.categoryIds) ? n.categoryIds : [],
});

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {*} data
 */
const sendJSON = (res, status, data) => {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
};

/**
 * @param {http.ServerResponse} res
 * @param {string} filePath
 */
const sendFile = (res, filePath) => {
    const mime = {
        '.html': 'text/html',
        '.css':  'text/css',
        '.js':   'application/javascript',
    };
    try {
        res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'text/plain' });
        res.end(fs.readFileSync(filePath));
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
};

/**
 * @param {http.IncomingMessage} req
 * @returns {Promise<object>}
 */
const parseBody = (req) =>
    new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({}); }
        });
        req.on('error', reject);
    });


http.createServer(async (req, res) => {
    const { pathname } = url.parse(req.url, true);
    const method = req.method;

    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    if (pathname.startsWith('/api/')) {

        if (pathname === '/api/categories' && method === 'GET')
            return sendJSON(res, 200, readCategories());

        if (pathname === '/api/categories' && method === 'POST') {
            const body = await parseBody(req);
            const name = (body.name || '').trim();

            if (!name) return sendJSON(res, 400, { error: 'Brak nazwy kategorii' });

            const cats = readCategories();

            if (cats.find(c => c.name.toLowerCase() === name.toLowerCase()))
                return sendJSON(res, 409, { error: 'Kategoria już istnieje' });

            const cat = {
                id:        generateId(),
                name,
                color:     body.color || '#6b7280',
                createdAt: new Date().toISOString(),
            };

            cats.push(cat);
            writeCategories(cats);
            return sendJSON(res, 201, cat);
        }

        const catMatch = pathname.match(/^\/api\/categories\/([^/]+)$/);

        if (catMatch && method === 'PUT') {
            const cats = readCategories();
            const idx  = cats.findIndex(c => c.id === catMatch[1]);

            if (idx === -1) return sendJSON(res, 404, { error: 'Nie znaleziono' });

            const body = await parseBody(req);
            if (body.name)  cats[idx].name  = body.name.trim();

            writeCategories(cats);
            return sendJSON(res, 200, cats[idx]);
        }

        if (catMatch && method === 'DELETE') {
            let cats = readCategories();
            if (!cats.find(c => c.id === catMatch[1]))
                return sendJSON(res, 404, { error: 'Nie znaleziono' });

            cats = cats.filter(c => c.id !== catMatch[1]);
            writeCategories(cats);

            for (const note of getAllNotes()) {
                if (Array.isArray(note.categoryIds) && note.categoryIds.includes(catMatch[1])) {
                    const fp      = getNoteFilePath(note.id);
                    const updated = { ...note, categoryIds: note.categoryIds.filter(id => id !== catMatch[1]) };
                    if (fp) fs.writeFileSync(fp, JSON.stringify(updated, null, 4));
                }
            }
            return sendJSON(res, 200, { success: true });
        }

        if (pathname === '/api/notes' && method === 'GET')
            return sendJSON(res, 200, getAllNotes().map(noteToListItem));

        const noteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);

        if (noteMatch && method === 'GET') {
            const fp = getNoteFilePath(noteMatch[1]);
            if (!fp) return sendJSON(res, 404, { error: 'Nie znaleziono' });
            return sendJSON(res, 200, readNote(fp));
        }

        if (pathname === '/api/notes' && method === 'POST') {
            const body = await parseBody(req);
            const id   = generateId();
            const now  = new Date().toISOString();
            const note = {
                id,
                title:       (body.title || 'Bez tytułu').trim(),
                content:     (body.content || '').trim(),
                color:       body.color || '#ffffff',
                categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : [],
                createdAt:   now,
                updatedAt:   now,
            };
            fs.writeFileSync(
                path.join(NOTES_DIR, `${id}_${slugify(note.title)}.json`),
                JSON.stringify(note, null, 4)
            );
            return sendJSON(res, 201, note);
        }

        if (noteMatch && method === 'PUT') {
            const fp = getNoteFilePath(noteMatch[1]);
            if (!fp) return sendJSON(res, 404, { error: 'Nie znaleziono' });

            const existing = readNote(fp);
            const body     = await parseBody(req);
            const title    = (body.title ?? existing.title).trim();
            const updated  = {
                ...existing,
                title,
                content:     body.content     ?? existing.content,
                color:       body.color       ?? existing.color,
                categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : existing.categoryIds,
                updatedAt:   new Date().toISOString(),
            };

            fs.unlinkSync(fp);
            fs.writeFileSync(
                path.join(NOTES_DIR, `${noteMatch[1]}_${slugify(title)}.json`),
                JSON.stringify(updated, null, 4)
            );
            return sendJSON(res, 200, updated);
        }

        if (noteMatch && method === 'DELETE') {
            const fp = getNoteFilePath(noteMatch[1]);
            if (!fp) return sendJSON(res, 404, { error: 'Nie znaleziono' });
            fs.unlinkSync(fp);
            return sendJSON(res, 200, { success: true });
        }

        return sendJSON(res, 404, { error: 'Endpoint nie istnieje' });
    }

    const staticMap = {
        '/': 'index.html',
        '/index.html': 'index.html',
        '/style.css': 'style.css',
        '/app.js': 'app.js',
    };

    if (staticMap[pathname])
        return sendFile(res, path.join(PUBLIC_DIR, staticMap[pathname]));

    res.writeHead(404);
    res.end('Not found');

}).listen(PORT, () => console.log(`Server running at http://localhost:${PORT}\n`));
