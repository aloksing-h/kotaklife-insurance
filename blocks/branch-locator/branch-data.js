/*
 * Branch Locator data adapter
 *
 * The block only talks to a branch source created here (createBranchSource), never to the
 * data itself, so switching from the sample JSON to the client API is a configuration
 * change in this file (or a configureBranchData call), not a change to the block.
 *
 * Two ways of working, chosen by the configuration:
 *
 * 1. List (default, used now): one request loads every branch (the authored "Branch data
 *    URL", for example the sample /drafts/contact-us/branches-sample.json or an AEM
 *    spreadsheet) and the searches run in the browser.
 *
 * 2. Search requests (for an API that searches on the server): set endpoints.pincode,
 *    endpoints.area and/or endpoints.near. Each one is a request template; {pincode},
 *    {state}, {city}, {latitude} and {longitude} are filled in (URL-encoded in the URL).
 *    endpoints.states and endpoints.cities ({state}) can fill the dropdowns; their rows
 *    are names, or objects with a name / value. Anything without an endpoint still uses
 *    the list.
 *
 *   import { configureBranchData } from '../blocks/branch-locator/branch-data.js';
 *   configureBranchData({
 *     headers: { 'x-api-key': '...' },              // sent with every request
 *     rows: (json) => json.result.branches,          // where the rows are in a response
 *     fields: { name: ['branch_name'], pincode: ['pin_code'] },
 *     endpoints: {
 *       pincode: { url: 'https://api.example.com/branches?pincode={pincode}' },
 *       area: { url: 'https://api.example.com/branches', method: 'POST',
 *               body: { state: '{state}', city: '{city}' } },
 *     },
 *   });
 *
 * Every branch is normalised to:
 *   { id, name, address, city, state, pincode, phones: [], latitude, longitude }
 */

const settings = {
  // the accepted column / property names of each branch field, compared case-insensitively
  fields: {
    id: ['id', 'branchId', 'code', 'branchCode'],
    name: ['name', 'branch', 'branchName', 'branch name'],
    address: ['address', 'branchAddress', 'branch address'],
    city: ['city', 'district'],
    state: ['state', 'region'],
    pincode: ['pincode', 'pin', 'postalCode', 'zip'],
    phone: ['phone', 'phoneNumber', 'phone number', 'contact'],
    phone2: ['phone2', 'alternatePhone', 'tollFree', 'toll free'],
    latitude: ['latitude', 'lat'],
    longitude: ['longitude', 'lng', 'lon', 'long'],
  },
  // finds the rows in a response: an array, or { data: [] } as AEM spreadsheets return it.
  // Returning anything other than an array is treated as a failed response.
  rows: (json) => {
    if (Array.isArray(json)) return json;
    return json?.data ?? json?.branches ?? json?.items;
  },
  // optional extra step per row, before it is normalised (for example to join fields)
  transform: null,
  // request defaults: method, headers, credentials (sent with every request)
  method: 'GET',
  headers: {},
  credentials: 'same-origin',
  // a request that takes longer fails with the "not available" message
  timeout: 15000,
  // optional search requests (see above); null means "search in the loaded list"
  endpoints: {
    pincode: null, area: null, near: null, states: null, cities: null,
  },
  // coordinates outside this area (India) are data errors: the branch is listed without a
  // pin, and its directions use the address. null accepts any valid coordinates.
  bounds: {
    south: 6, west: 68, north: 37.5, east: 97.5,
  },
  // Near Me: the closest branches within this distance (km), at most this many
  near: { radius: 50, limit: 18 },
  // opens directions to a branch; {destination} is replaced with its coordinates or address
  directions: 'https://www.google.com/maps/dir/?api=1&destination={destination}',
};

/**
 * Changes how branches are loaded and read; anything not given keeps its default.
 * @param {object} config any of the settings above
 */
export function configureBranchData(config = {}) {
  Object.assign(settings, config, {
    fields: { ...settings.fields, ...(config.fields || {}) },
    endpoints: { ...settings.endpoints, ...(config.endpoints || {}) },
    near: { ...settings.near, ...(config.near || {}) },
  });
}

function pick(row, names) {
  const keys = Object.keys(row);
  const key = keys.find((k) => names.some((name) => name.toLowerCase() === k.toLowerCase()));
  const value = key === undefined ? '' : row[key];
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * Turns one row of the data into a branch (null when it has no name).
 * @param {object} row
 * @param {number} index
 * @returns {object|null}
 */
function toBranch(row, index) {
  const source = typeof settings.transform === 'function' ? settings.transform(row) : row;
  if (!source || typeof source !== 'object') return null;
  const value = (field) => pick(source, settings.fields[field]);
  const name = value('name');
  if (!name) return null;
  const latitude = parseFloat(value('latitude'));
  const longitude = parseFloat(value('longitude'));
  const { bounds } = settings;
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    && (!bounds || (latitude >= bounds.south && latitude <= bounds.north
      && longitude >= bounds.west && longitude <= bounds.east));
  return {
    id: value('id') || `branch-${index + 1}`,
    name,
    address: value('address'),
    city: value('city'),
    state: value('state'),
    pincode: value('pincode').replace(/\s/g, ''),
    phones: [...new Set([value('phone'), value('phone2')].filter(Boolean))],
    latitude: valid ? latitude : null,
    longitude: valid ? longitude : null,
  };
}

/**
 * Fills {placeholders} in a request template.
 * @param {*} template a string, or an object / array of strings
 * @param {object} params
 * @param {(value: string) => string} encode
 */
function fill(template, params, encode = (value) => value) {
  if (typeof template === 'string') {
    return template.replace(/\{(\w+)\}/g, (_, key) => encode(params[key] ?? ''));
  }
  if (Array.isArray(template)) return template.map((item) => fill(item, params, encode));
  if (template && typeof template === 'object') {
    return Object.fromEntries(Object.entries(template)
      .map(([key, item]) => [key, fill(item, params, encode)]));
  }
  return template;
}

/**
 * Sends one request and returns the rows of its response.
 * @param {{ url: string, method?: string, headers?: object, body?: * }} endpoint
 * @param {object} [params] values for the template placeholders
 * @returns {Promise<object[]>}
 */
async function requestRows(endpoint, params = {}) {
  if (!endpoint?.url) throw new Error('branch-locator: no branch data URL');
  const method = (endpoint.method || settings.method).toUpperCase();
  const headers = { ...settings.headers, ...(endpoint.headers || {}) };
  const options = { method, headers, credentials: endpoint.credentials || settings.credentials };
  if (endpoint.body !== undefined && method !== 'GET') {
    const body = fill(endpoint.body, params);
    if (typeof body === 'string') {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
      if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeout);
  try {
    const response = await fetch(fill(endpoint.url, params, encodeURIComponent), {
      ...options, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`branch-locator: loading branches failed (${response.status})`);
    const rows = settings.rows(await response.json());
    if (!Array.isArray(rows)) throw new Error('branch-locator: unexpected branch data');
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

/** a request whose rows are branches */
async function request(endpoint, params) {
  return (await requestRows(endpoint, params)).map(toBranch).filter(Boolean);
}

/** a request whose rows are names (states, cities) */
async function requestNames(endpoint, params) {
  const names = (await requestRows(endpoint, params))
    .map((row) => (typeof row === 'object' && row !== null ? (row.name ?? row.value) : row))
    .map((name) => String(name ?? '').trim())
    .filter(Boolean);
  return [...new Set(names)];
}

/**
 * Loads the full branch list.
 * @param {string} source URL of the branch data
 * @returns {Promise<object[]>}
 */
export async function loadBranches(source) {
  return request({ url: source });
}

const byText = (a, b) => a.localeCompare(b, 'en-IN');

/**
 * Returns the states that have branches, in alphabetical order.
 * @param {object[]} branches
 * @returns {string[]}
 */
export function statesOf(branches) {
  return [...new Set(branches.map((branch) => branch.state).filter(Boolean))].sort(byText);
}

/**
 * Returns the cities of a state that have branches, in alphabetical order.
 * @param {object[]} branches
 * @param {string} state
 * @returns {string[]}
 */
export function citiesOf(branches, state) {
  const cities = branches.filter((branch) => branch.state === state).map((branch) => branch.city);
  return [...new Set(cities.filter(Boolean))].sort(byText);
}

/**
 * Finds the branches of a pincode; when there are none, the branches of the same postal
 * district (the first three digits).
 * @param {object[]} branches
 * @param {string} pincode
 * @returns {{ branches: object[], exact: boolean }}
 */
export function searchByPincode(branches, pincode) {
  const exact = branches.filter((branch) => branch.pincode === pincode);
  if (exact.length) return { branches: exact, exact: true };
  const district = pincode.slice(0, 3);
  return {
    branches: branches.filter((branch) => branch.pincode.startsWith(district)),
    exact: false,
  };
}

/**
 * Finds the branches of a state, and of a city when one is given.
 * @param {object[]} branches
 * @param {string} state
 * @param {string} [city]
 * @returns {object[]}
 */
export function searchByArea(branches, state, city) {
  return branches.filter((branch) => branch.state === state && (!city || branch.city === city));
}

function distance(from, branch) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(branch.latitude - from.latitude);
  const dLon = rad(branch.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(from.latitude)) * Math.cos(rad(branch.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the branches nearest to a location, closest first.
 * @param {object[]} branches
 * @param {{ latitude: number, longitude: number }} from
 * @param {{ limit?: number, radius?: number }} [options] radius in kilometres
 * @returns {object[]}
 */
export function nearestBranches(branches, from, options = {}) {
  const { limit, radius } = { ...settings.near, ...options };
  return branches
    .filter((branch) => branch.latitude !== null && branch.longitude !== null)
    .map((branch) => ({ ...branch, distance: distance(from, branch) }))
    .filter((branch) => branch.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Returns the link that opens directions to a branch.
 * @param {object} branch
 * @returns {string}
 */
export function directionsUrl(branch) {
  const destination = branch.latitude !== null && branch.longitude !== null
    ? `${branch.latitude},${branch.longitude}`
    : [branch.name, branch.address].filter(Boolean).join(', ');
  return settings.directions.replace('{destination}', encodeURIComponent(destination));
}

/**
 * The branch source of one block: loads the data once and answers the searches, through
 * the search endpoints when they are configured, otherwise from the loaded list.
 * @param {string} source the authored branch data URL
 */
export function createBranchSource(source) {
  let list = null;
  const load = () => {
    // a failed load is tried again on the next search
    list = list || request({ url: source }).catch((error) => {
      list = null;
      throw error;
    });
    return list;
  };
  // the endpoints are read when searching, so a later configureBranchData call still applies
  return {
    /** resolves with every branch (rejects when the data cannot be loaded) */
    load,
    async states() {
      if (settings.endpoints.states) return requestNames(settings.endpoints.states);
      return statesOf(await load());
    },
    async cities(state) {
      if (settings.endpoints.cities) return requestNames(settings.endpoints.cities, { state });
      return citiesOf(await load(), state);
    },
    /** @returns {Promise<{ branches: object[], exact: boolean }>} */
    async byPincode(pincode) {
      if (settings.endpoints.pincode) {
        return { branches: await request(settings.endpoints.pincode, { pincode }), exact: true };
      }
      return searchByPincode(await load(), pincode);
    },
    async byArea(state, city = '') {
      if (settings.endpoints.area) return request(settings.endpoints.area, { state, city });
      return searchByArea(await load(), state, city);
    },
    async near({ latitude, longitude }) {
      if (settings.endpoints.near) {
        const found = await request(settings.endpoints.near, { latitude, longitude });
        return nearestBranches(found, { latitude, longitude }, { radius: Infinity });
      }
      return nearestBranches(await load(), { latitude, longitude });
    },
  };
}
