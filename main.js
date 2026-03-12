import { IncomingMessage } from 'http';
import server from './server.js';
import fs from 'fs';

/**
 * @param {number} code
 * @param {string} s
 * @returns {import('./server.js').Response}
 */
const text = (code, s) => ({ code, type: "text/plain", content: s });

const html = (code, s) => ({ code, type: "text/html", content: s });

const js = (code, s) => ({ code, type: "text/javascript", content: s });

const css = (code, s) => ({ code, type: "text/css", content: s });

/**
 * @param {number} code
 * @param {object} s
 * @returns {import('./server.js').Response}
 */
const json = (code, object) => ({ code, type: "application/json", content: JSON.stringify(object) });

const getPath = id => `notes/${id}.txt`;

/**
 * @param {any} param0 
 * @param {IncomingMessage} req 
 * @returns 
 */
const write = async ({ id }, req) => {
    try {
        let body = '';

        for await (const chunk of req) {
            body += chunk;
        }

        const path = getPath(id);
        fs.writeFileSync(path, body, { encoding: "utf8", flag: 'w' });
        console.log(`written to note ${id}`)
        return text(200, body);
    } catch (err) {
        return text(400, `Could not find note with id ${id}, ${err}`);
    }
};

const read = async ({ id }, req) => {
    try {
        const path = getPath(id);
        const s = fs.readFileSync(path, { encoding: "utf8" });
        return text(200, s);
    } catch (err) {
        return text(400, `Could not find note with id ${id}, ${err}`);
    }
};

const get = async ({}, _) => {
    const notes = fs.readdirSync("notes").map(s => parseInt(s));
    return json(200, notes)
}

const index = fs.readFileSync('client/index.html');
const script = fs.readFileSync('client/script.js');
const style = fs.readFileSync('client/css.css');

/**
 * @type {import('./server.js').Routes}
 */
const routes = [
    ["/", ({}, _) => html(200, index)],
    ["/script.js", ({}, _) => js(200, script)],
    ["/css.css", ({}, _) => css(200, style)],

    ["/api/get", get],
    ["/api/write/{id}", write],
    ["/api/read/{id}", read],

    ["/health", ({}, _) => text(200, "/health")],
];

server.run(3000, 'localhost', routes);
