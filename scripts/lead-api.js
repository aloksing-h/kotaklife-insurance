import invokeGateway from './gateway-api.js';

const DEFAULT_PRODUCT_CODE = 'U04';

/**
 * Splits a full name into FirstName / LastName for LeadSquare.
 * Single-word names get '.' as the last name.
 * @param {string} fullName
 * @returns {{ firstName: string, lastName: string }}
 */
export function splitFullName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] || '',
      lastName: '',
    };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(''),
  };
}

/**
 * Normalizes a date value to yyyy-mm-dd (also accepts dd-mm-yyyy input)
 * @param {string} value
 * @returns {string} normalized date or empty string
 */
function toLeadDate(value) {
  const trimmed = (value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/**
 * Formats a numeric annual income into the LeadSquare Lakhs format,
 * e.g. '500000' -> '5 Lakhs'. Non-numeric values (such as an already
 * authored range like '5-7 Lakhs') pass through unchanged.
 * @param {string} value
 * @returns {string}
 */
function toIncomeRange(value) {
  const trimmed = (value || '').trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  const lakhs = Number(trimmed) / 100000;
  const rounded = Number.isInteger(lakhs) ? lakhs : Number(lakhs.toFixed(2));
  return `${rounded} ${rounded === 1 ? 'Lakh' : 'Lakhs'}`;
}

/**
 * Collects LeadSquare attribute values from whichever supported fields
 * exist in the given form. Fields that are not present are omitted.
 * @param {HTMLFormElement} form
 * @returns {Object} map of LeadSquare attribute name to value
 */
export function collectLeadFields(form) {
  const fields = {};

  const nameInput = form.querySelector(
    'input[name="fullname"], input[name="fullName"], input[name="name"]',
  );
  if (nameInput?.value.trim()) {
    const {
      firstName,
      lastName,
    } = splitFullName(nameInput.value);
    fields.FirstName = firstName;
    fields.LastName = lastName;
  }

  fields.Phone = form.querySelector('input[type="tel"]')?.value.trim();
  fields.EmailAddress = form.querySelector('input[type="email"]')?.value.trim();
  fields.mx_DOB = toLeadDate(form.querySelector('.date-field input[name]')?.value);
  fields.mx_Gender = form.querySelector('input[type="radio"][name*="ender"]:checked')?.value;
  fields.mx_Income_Ranges = toIncomeRange(form.querySelector('select[name*="ncome"]')?.value);

  return fields;
}

/**
 * Builds the LeadSquare attribute payload. Base/UTM attributes are always
 * sent; form attributes are included only when a value is available.
 * @param {Object} fields map of LeadSquare attribute name to value
 * @param {Object} [options]
 * @param {string} [options.productCode] value for mx_Product_Code
 * @returns {Array<{ Value: string, Attribute: string }>}
 */
export function buildLeadPayload(fields, {
  productCode = DEFAULT_PRODUCT_CODE,
} = {}) {
  const searchParams = new URLSearchParams(window.location.search);
  const payload = [{
    Value: searchParams.get('Source') || 'ulip_organic',
    Attribute: 'Source',
  },
  {
    Value: window.location.href,
    Attribute: 'mx_utm_lp_url',
  },
  {
    Value: searchParams.get('mx_utm_campaign') || searchParams.get('utm_campaign') || 'top_menu',
    Attribute: 'mx_utm_campaign',
  },
  {
    Value: searchParams.get('SourceMedium') || searchParams.get('utm_medium') || 'website',
    Attribute: 'SourceMedium',
  },
  {
    Value: productCode || DEFAULT_PRODUCT_CODE,
    Attribute: 'mx_Product_Code',
  },

  {
    Value: searchParams.get('mx_UTM_Keyword') || searchParams.get('utm_term') || '',
    Attribute: 'mx_UTM_Keyword',
  },
  {
    Value: searchParams.get('mx_utm_gclid') || searchParams.get('gclid') || '',
    Attribute: 'mx_utm_gclid',
  },
  {
    Value: searchParams.get('mx_utm_devicemodel') || '',
    Attribute: 'mx_utm_devicemodel',
  },
  {
    Value: searchParams.get('mx_utm_ad_group') || searchParams.get('utm_adgroup') || '',
    Attribute: 'mx_utm_ad_group',
  },
  {
    Value: searchParams.get('mx_lead_source_1') || searchParams.get('utm_source') || 'ulip_organic',
    Attribute: 'mx_lead_source_1',
  },
  {
    Value: searchParams.get('SourceContent') || searchParams.get('utm_content') || '',
    Attribute: 'SourceContent',
  },
  {
    Value: searchParams.get('mx_Keyword') || searchParams.get('utm_term') || '',
    Attribute: 'mx_Keyword',
  },
  ];
  Object.entries(fields || {}).forEach(([attribute, value]) => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized) {
      payload.push({
        Value: String(normalized),
        Attribute: attribute,
      });
    }
  });
  return payload;
}

/**
 * Creates a lead in LeadSquare via the kli-create-lead gateway.
 * @param {Array<{ Value: string, Attribute: string }>} leadData LeadSquare
 *   attribute payload (see buildLeadPayload)
 * @returns {Promise<Object>} { status, correlationId, latencyMs, data }
 */
export default async function createLead(leadData) {
  return invokeGateway('kli-create-lead', leadData);
}
