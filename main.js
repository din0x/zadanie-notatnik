import server from './server.js';

/**
 * @param {number} code
 * @param {string} s
 * @returns {import('./server.js').Response}
 */
const text = (code, s) => ({ code, type: "text/plain", content: s });

/**
 * @param {number} code
 * @param {object} s
 * @returns {import('./server.js').Response}
 */
const json = (code, object) => ({ code, type: "application/json", content: JSON.stringify(object) });

let id = 0;

const create = ({}, _) => {
    return json(200, {
        id: id++,
    });
};

const write = ({ id }, req) => {
    
}

/**
 * @type {import('./server.js').Routes}
 */
const routes = [
    ["/", ({}, _) => text(200, "hello world")],
    ["/api/get/{id}", ({ id }, _) => text(200, `Note(${id})\n`)],
    ["/api/create", create],
    ["/health", ({}, _) => text(200, "/health")],
];

server.run(3000, 'localhost', routes);
