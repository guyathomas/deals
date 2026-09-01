import { filterChanges } from './lib/changes';
import { resolveApiRoute } from './lib/routes';

// Set at build time by the GitHub Pages workflow: read prescraped JSON
// instead of talking to the express API.
export const isStatic = import.meta.env.VITE_STATIC_DATA === 'true';

const staticRoot = `${import.meta.env.BASE_URL}api`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

function staticFile(name) {
  return getJson(`${staticRoot}/${name}`);
}

async function getStatic(path) {
  const [pathname, query = ''] = path.split('?');
  const route = resolveApiRoute(pathname, new URLSearchParams(query));
  const data = await staticFile(route.file);
  return route.filter ? filterChanges(data, route.filter) : data;
}

export function apiGet(path) {
  return isStatic ? getStatic(path) : getJson(path);
}

export function getMeta() {
  return isStatic ? staticFile('meta.json') : Promise.resolve(null);
}
