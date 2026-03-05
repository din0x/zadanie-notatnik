import http from 'http';
import url from './url.js';

/**
 * @typedef {Object} Response
 * @property {number} code
 * @property {"text/plain" | "application/json" | "text/html"} type
 * @property {string} content
 */

/**
 * @typedef {[string, function(object, http.IncomingMessage): Response][]} Routes
 */

/**
 * @param {number} port 
 * @param {string} hostname 
 * @param {Routes} routes 
 */
const run = (port, hostname, routes) => {
    const server = http.createServer((req, res) => {
        for (const [pattern, handler] of routes) {
            console.log(req);
            const match = url.matchUrl(pattern, req.url ?? "/");
    
            console.log(`match('${pattern}', '${req.url}'): ${match}`)
    
            if (match !== null) {
                const ret = handler(match, req);
                res.statusCode = ret.code;
                res.setHeader("Content-Type", ret.type);
                res.end(ret.content);
    
                return;
            }
        }
    
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404: Url not found');
    });
    
    server.listen(port, hostname, () => {
      console.log(`Server running at http://${hostname}:${port}/`);
    });
};

export default { run };
