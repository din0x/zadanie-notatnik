function splitPath(path) {
  if (!path || path === "/") return [];
  return path.replace(/^\/|\/$/g, "").split("/");
}

function matchUrl(pattern, url) {
  const patternParts = splitPath(pattern);
  const urlParts = splitPath(url);

  if (patternParts.length !== urlParts.length) return null;

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const u = urlParts[i];

    const match = p.match(/^\{(.+)\}$/);

    if (match) {
      params[match[1]] = u;
    } else if (p !== u) {
      return null;
    }
  }

  return params;
}

console.log(matchUrl("/", ""));

export default {
    matchUrl
}
