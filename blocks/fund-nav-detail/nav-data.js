/**
 * NAV data access for the fund NAV detail block.
 *
 * API swap point: replace the body of `fetchFundNav` with the real API call.
 * It must resolve to:
 * {
 *   id, name, code,          // fund identity
 *   nav, navDate,            // latest NAV and its ISO date (YYYY-MM-DD)
 *   returns5y,               // fund 5 year returns, in %
 *   asOf,                    // ISO date the data is valid for
 *   disclaimer,              // disclaimer text, e.g. "*Data as of 17th Aug, 2026. ..."
 *   history: [[isoDate, nav], ...]  // daily NAV, oldest first
 * }
 */

const MOCK_URL = '/blocks/fund-nav-detail/mock-nav-data.json';

let mockPromise;

function loadMock() {
  if (!mockPromise) {
    mockPromise = fetch(`${window.hlx?.codeBasePath || ''}${MOCK_URL}`).then((resp) => {
      if (!resp.ok) throw new Error(`NAV data request failed (${resp.status})`);
      return resp.json();
    });
  }
  return mockPromise;
}

const normalize = (value) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Loads the NAV details of one fund.
 * @param {{id?: string, name?: string, code?: string}} fund Fund identity, e.g. from a NAV card
 * @returns {Promise<object>}
 */
export default async function fetchFundNav(fund = {}) {
  const { funds } = await loadMock();
  const match = funds.find((f) => fund.id && f.id === fund.id)
    || funds.find((f) => fund.name && normalize(f.name) === normalize(fund.name))
    || funds.find((f) => fund.code && f.code === fund.code);
  if (match) return match;

  // Dummy data only: unknown funds reuse the first series under their own name and code
  return {
    ...funds[0],
    id: fund.id || funds[0].id,
    name: fund.name || funds[0].name,
    code: fund.code || funds[0].code,
  };
}
