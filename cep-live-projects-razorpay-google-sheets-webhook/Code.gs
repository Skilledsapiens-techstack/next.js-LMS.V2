const SHEET_NAMES = {
  raw: 'Raw Razorpay Payments',
  cep: 'CEP - Import Ready',
  liveProjects: 'Live Projects - Import Ready',
  config: 'Mapping / Config',
  errors: 'Errors / Needs Review',
};

const IMPORT_HEADERS = [
  'fullName',
  'email',
  'altEmail',
  'phone',
  'collegeName',
  'programNames',
  'personalmentor',
  'you_are_from',
  'project_start_date',
  'duration',
  'payment_date',
  'payment_page_title',
];

const RAW_HEADERS = [
  'received_at',
  'source_form',
  'payment_page_id',
  'payment_page_title',
  'payment_date',
  'order_id',
  'item_name',
  'item_amount',
  'item_quantity',
  'item_payment_amount',
  'total_payment_amount',
  'currency',
  'payment_status',
  'payment_id',
  'first_role',
  'second_role',
  'third_role',
  'fourth_role',
  'fifth_role',
  'full_name',
  'email',
  'alt_email',
  'phone_number',
  'college_name',
  'you_are_from',
  'project_start_date',
  'duration',
  'tentative_end_date',
  'personalmentor',
  'raw_payload_json',
  'processing_status',
  'processing_note',
];

const ERROR_HEADERS = [
  'received_at',
  'payment_id',
  'order_id',
  'payment_page_title',
  'full_name',
  'email',
  'phone_number',
  'error_type',
  'error_message',
  'raw_payload_json',
  'review_status',
  'review_notes',
];

const CEP_ROLES = [
  'Equity Research & Financial Modeling Analyst (Sell Side Role)',
  'Portfolio Manager - Quantitative Finance (Buy Side Role)',
  'Mergers & Acquisitions (Investment Banking Role)',
  'Private Equity & Venture Capital (Buy Side Investment Role)',
  'Business Consulting & Strategy Role',
  'Associate Product Manager Role',
  'Marketing Manager Role',
  'Market Research & Business Strategy Role',
];

const LIVE_PROJECT_ROLES = [
  'Equity Research & Financial Modeling Analyst (Sell Side Role)',
  'Portfolio Manager - Quantitative Finance (Buy Side Role)',
  'Mergers & Acquisitions (Investment Banking Role)',
  'Private Equity & Venture Capital (Buy Side Investment Role)',
  'Corporate Financial Planning & Analysis Role',
  'Business Consulting & Strategy Role',
  'Associate Product Manager Role',
  'Marketing Manager Role',
  'Market Research & Business Strategy Role',
];

const SCRIPT_PROP_KEYS = {
  webhookToken: 'RAZORPAY_WEBHOOK_TOKEN',
  spreadsheetId: 'SPREADSHEET_ID',
};

const DEFAULT_SPREADSHEET_ID = '1wAXRxlQ8nHHwwnyuyqZE9txrKM443Gfqll80_bQOTKs';
const DEFAULT_WEBHOOK_TOKEN = '425cffda5943428bc80edbd9ba4956662a36b74ac0b433895a5fe85a11d900ef';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Razorpay Import')
    .addItem('Setup / Repair Workbook', 'setupWorkbook')
    .addItem('Show Webhook URL', 'showWebhookUrl')
    .addItem('Run Sample CEP Test', 'testCepPayment')
    .addItem('Run Sample Live Project Test', 'testLiveProjectPayment')
    .addToUi();
}

function setupWorkbook() {
  const ss = getSpreadsheet_();
  setupSheet_(ss, SHEET_NAMES.raw, RAW_HEADERS);
  setupSheet_(ss, SHEET_NAMES.cep, IMPORT_HEADERS);
  setupSheet_(ss, SHEET_NAMES.liveProjects, IMPORT_HEADERS);
  setupSheet_(ss, SHEET_NAMES.errors, ERROR_HEADERS);
  setupConfigSheet_(ss);
  return ok_({ message: 'Workbook setup completed.' });
}

function configureDeployment(spreadsheetId, webhookToken) {
  if (!spreadsheetId) throw new Error('spreadsheetId is required.');
  if (!webhookToken) throw new Error('webhookToken is required.');

  PropertiesService.getScriptProperties().setProperties({
    [SCRIPT_PROP_KEYS.spreadsheetId]: spreadsheetId,
    [SCRIPT_PROP_KEYS.webhookToken]: webhookToken,
  }, true);

  setupWorkbook();
  return {
    ok: true,
    spreadsheetId: spreadsheetId,
    message: 'Script properties saved and workbook setup completed.',
  };
}

function showWebhookUrl() {
  const url = ScriptApp.getService().getUrl();
  const token = getWebhookToken_();
  const message = url
    ? `${url}?token=${token || 'SET_SCRIPT_PROPERTY_RAZORPAY_WEBHOOK_TOKEN'}`
    : 'Deploy this Apps Script as a Web App first, then reopen this menu.';
  SpreadsheetApp.getUi().alert('Razorpay Webhook URL', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.setup === '1') {
    verifyRequestToken_(e);
    setupWorkbook();
    return ok_({ status: 'setup_completed' });
  }

  return json_({
    ok: true,
    service: 'Razorpay CEP / Live Projects Google Sheet Import',
    expectedEvent: 'payment.captured',
  });
}

function doPost(e) {
  const startedAt = new Date();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    verifyRequestToken_(e);

    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!rawBody) return fail_('EMPTY_BODY', 'Request body is empty.');

    const payload = JSON.parse(rawBody);
    const extracted = extractPayment_(payload, rawBody, startedAt);

    if (!extracted.paymentId) {
      appendError_(extracted, 'MISSING_PAYMENT_ID', 'No Razorpay payment_id was found in payload.');
      return fail_('MISSING_PAYMENT_ID', 'No Razorpay payment_id was found in payload.');
    }

    if (paymentAlreadySeen_(extracted.paymentId)) {
      return ok_({ status: 'duplicate_ignored', payment_id: extracted.paymentId });
    }

    const isCaptured = extracted.event === 'payment.captured' || extracted.paymentStatus === 'captured';
    if (!isCaptured) {
      appendRaw_(extracted, 'ignored', `Ignored non-captured event/status: ${extracted.event || extracted.paymentStatus || 'unknown'}`);
      return ok_({ status: 'ignored_non_captured', payment_id: extracted.paymentId });
    }

    const route = determineRoute_(extracted);
    if (!route) {
      appendRaw_(extracted, 'needs_review', 'Could not identify CEP or Live Projects form.');
      appendError_(extracted, 'UNKNOWN_FORM', 'Could not map payment to CEP or Live Projects.');
      return fail_('UNKNOWN_FORM', 'Could not identify source form.');
    }

    const importRow = buildImportRow_(extracted);
    const validation = validateImportRow_(importRow);
    if (validation.length) {
      appendRaw_(extracted, 'needs_review', validation.join('; '));
      appendError_(extracted, 'VALIDATION_ERROR', validation.join('; '));
      return fail_('VALIDATION_ERROR', validation.join('; '));
    }

    appendRaw_(extracted, 'processed', route.destinationSheet);
    appendImportRow_(route.destinationSheet, importRow);

    return ok_({
      status: 'processed',
      payment_id: extracted.paymentId,
      destination: route.destinationSheet,
    });
  } catch (err) {
    return fail_('SERVER_ERROR', err && err.message ? err.message : String(err));
  } finally {
    lock.releaseLock();
  }
}

function extractPayment_(payload, rawBody, receivedAt) {
  const flat = flattenPayload_(payload);
  const payment = payload && payload.payload && payload.payload.payment && payload.payload.payment.entity
    ? payload.payload.payment.entity
    : payload.payment || payload;

  const notes = payment && payment.notes && typeof payment.notes === 'object' ? payment.notes : {};
  const normalized = Object.assign({}, flat, normalizeObject_(notes), normalizeObject_(payment || {}));
  const amount = firstValue_(normalized, ['total_payment_amount', 'amount_paid', 'amount']);
  const createdAt = firstValue_(normalized, ['payment_date', 'created_at']);

  return {
    receivedAt: formatDate_(receivedAt),
    event: firstValue_(normalized, ['event']),
    paymentPageId: firstValue_(normalized, ['payment_page_id', 'payment_link_id', 'paymentlinkid']),
    paymentPageTitle: firstValue_(normalized, ['payment_page_title', 'payment_link_title', 'title', 'description']),
    paymentDate: formatRazorpayDate_(createdAt),
    orderId: firstValue_(normalized, ['order_id', 'orderid']),
    itemName: firstValue_(normalized, ['item_name', 'description']),
    itemAmount: normalizeAmount_(firstValue_(normalized, ['item_amount'])),
    itemQuantity: firstValue_(normalized, ['item_quantity']) || '',
    itemPaymentAmount: normalizeAmount_(firstValue_(normalized, ['item_payment_amount'])),
    totalPaymentAmount: normalizeAmount_(amount),
    currency: firstValue_(normalized, ['currency']) || 'INR',
    paymentStatus: firstValue_(normalized, ['payment_status', 'status']),
    paymentId: firstValue_(normalized, ['payment_id', 'id']),
    firstRole: firstValue_(normalized, ['please_choose_your_first_role', 'select_your_first_role', 'first_role']),
    secondRole: firstValue_(normalized, ['please_choose_your_second_role', 'select_your_second_role', 'second_role']),
    thirdRole: firstValue_(normalized, ['please_choose_your_third_role', 'select_your_third_role', 'third_role']),
    fourthRole: firstValue_(normalized, ['please_choose_your_fourth_role', 'select_your_fourth_role', 'fourth_role']),
    fifthRole: firstValue_(normalized, ['please_choose_your_fifth_role', 'select_your_fifth_role', 'fifth_role']),
    fullName: firstValue_(normalized, ['full_name', 'name', 'customer_name']),
    email: firstValue_(normalized, ['most_active_email_id', 'official_email', 'email', 'customer_email']),
    altEmail: firstValue_(normalized, ['any_other_alternative_mail_id', 'alternative_mail_id', 'alt_email']),
    phoneNumber: normalizePhone_(firstValue_(normalized, ['phone_number', 'contact', 'phone', 'customer_contact'])),
    collegeName: firstValue_(normalized, ['current_college_or_company_name', 'your_college', 'college_name', 'company_name', 'college']),
    yearFrom: firstValue_(normalized, ['you_are_from']),
    projectStartDate: firstValue_(normalized, [
      'select_start_date_of_your_program',
      'select_start_date_of_your_live_project',
      'select_your_project_start_date',
      'project_start_date',
    ]),
    duration: firstValue_(normalized, [
      'select_duration_of_your_live_project',
      'select_tentative_duration_of_your_project',
      'duration',
    ]),
    tentativeEndDate: firstValue_(normalized, ['select_tentative_end_date_of_your_live_project', 'tentative_end_date']),
    personalMentor: inferPersonalMentor_(normalized, rawBody),
    rawPayloadJson: rawBody,
  };
}

function determineRoute_(extracted) {
  const title = String(extracted.paymentPageTitle || '').toLowerCase();
  const item = String(extracted.itemName || '').toLowerCase();

  if (title.indexOf('live project') !== -1 || item.indexOf('live project') !== -1) {
    return { sourceForm: 'live_projects', destinationSheet: SHEET_NAMES.liveProjects };
  }

  if (title.indexOf('corporate excellence') !== -1 || item.indexOf('corporate excellence') !== -1 || item.indexOf('cep') !== -1) {
    return { sourceForm: 'cep', destinationSheet: SHEET_NAMES.cep };
  }

  return null;
}

function buildImportRow_(extracted) {
  const programNames = uniqueNonEmpty_([
    extracted.firstRole,
    extracted.secondRole,
    extracted.thirdRole,
    extracted.fourthRole,
    extracted.fifthRole,
  ]).join('|');

  return {
    fullName: extracted.fullName || '',
    email: extracted.email || '',
    altEmail: extracted.altEmail || '',
    phone: extracted.phoneNumber || '',
    collegeName: extracted.collegeName || '',
    programNames: programNames,
    personalmentor: extracted.personalMentor,
    you_are_from: extracted.yearFrom || '',
    project_start_date: extracted.projectStartDate || '',
    duration: extracted.duration || '',
    payment_date: extracted.paymentDate || '',
    payment_page_title: extracted.paymentPageTitle || '',
  };
}

function validateImportRow_(row) {
  const errors = [];
  ['fullName', 'email', 'phone', 'collegeName', 'programNames'].forEach(key => {
    if (!row[key]) errors.push(`Missing ${key}`);
  });
  return errors;
}

function appendRaw_(extracted, status, note) {
  const route = determineRoute_(extracted);
  const row = [
    extracted.receivedAt,
    route ? route.sourceForm : '',
    extracted.paymentPageId,
    extracted.paymentPageTitle,
    extracted.paymentDate,
    extracted.orderId,
    extracted.itemName,
    extracted.itemAmount,
    extracted.itemQuantity,
    extracted.itemPaymentAmount,
    extracted.totalPaymentAmount,
    extracted.currency,
    extracted.paymentStatus,
    extracted.paymentId,
    extracted.firstRole,
    extracted.secondRole,
    extracted.thirdRole,
    extracted.fourthRole,
    extracted.fifthRole,
    extracted.fullName,
    extracted.email,
    extracted.altEmail,
    extracted.phoneNumber,
    extracted.collegeName,
    extracted.yearFrom,
    extracted.projectStartDate,
    extracted.duration,
    extracted.tentativeEndDate,
    extracted.personalMentor,
    extracted.rawPayloadJson,
    status,
    note || '',
  ];
  appendByHeaders_(SHEET_NAMES.raw, RAW_HEADERS, row);
}

function appendImportRow_(sheetName, rowObj) {
  appendByHeaders_(sheetName, IMPORT_HEADERS, IMPORT_HEADERS.map(header => rowObj[header] || ''));
}

function appendError_(extracted, type, message) {
  const row = [
    extracted.receivedAt || formatDate_(new Date()),
    extracted.paymentId || '',
    extracted.orderId || '',
    extracted.paymentPageTitle || '',
    extracted.fullName || '',
    extracted.email || '',
    extracted.phoneNumber || '',
    type,
    message,
    extracted.rawPayloadJson || '',
    'open',
    '',
  ];
  appendByHeaders_(SHEET_NAMES.errors, ERROR_HEADERS, row);
}

function appendByHeaders_(sheetName, headers, row) {
  const sheet = getOrCreateSheet_(getSpreadsheet_(), sheetName);
  ensureHeaders_(sheet, headers);
  sheet.appendRow(row);
}

function paymentAlreadySeen_(paymentId) {
  return [SHEET_NAMES.raw, SHEET_NAMES.errors].some(sheetName => {
    const sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return false;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const index = headers.indexOf('payment_id');
    if (index === -1) return false;
    const values = sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).getValues().flat();
    return values.some(value => String(value).trim() === String(paymentId).trim());
  });
}

function verifyRequestToken_(e) {
  const expected = getWebhookToken_();
  if (!expected) throw new Error(`Missing Script Property: ${SCRIPT_PROP_KEYS.webhookToken}`);

  const actual = e && e.parameter ? e.parameter.token : '';
  if (!actual || actual !== expected) throw new Error('Invalid webhook token.');
}

function getWebhookToken_() {
  return PropertiesService.getScriptProperties().getProperty(SCRIPT_PROP_KEYS.webhookToken) || DEFAULT_WEBHOOK_TOKEN;
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SCRIPT_PROP_KEYS.spreadsheetId) || DEFAULT_SPREADSHEET_ID;
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  return SpreadsheetApp.getActive();
}

function setupSheet_(ss, name, headers) {
  const sheet = getOrCreateSheet_(ss, name);
  ensureHeaders_(sheet, headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#f3f6fb');
  sheet.autoResizeColumns(1, Math.min(headers.length, 20));
  return sheet;
}

function setupConfigSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.config);
  const rows = [
    ['Section', 'Source Value', 'Destination / Setting', 'Notes'],
    ['Form Routing', 'Corporate Excellence Program Certification', SHEET_NAMES.cep, 'Payment page title or item name contains Corporate Excellence'],
    ['Form Routing', 'Live Project Certification', SHEET_NAMES.liveProjects, 'Payment page title or item name contains Live Project'],
    ['Output Column', 'fullName', 'fullName', 'From Full Name'],
    ['Output Column', 'email', 'email', 'From Most Active Email ID'],
    ['Output Column', 'altEmail', 'altEmail', 'From Any other Alternative Mail ID'],
    ['Output Column', 'phone', 'phone', 'Normalized India phone when possible'],
    ['Output Column', 'collegeName', 'collegeName', 'From Current College or Company Name'],
    ['Output Column', 'programNames', '| separated selected roles', 'No LMS mapping required'],
    ['Output Column', 'personalmentor', 'Yes / No', 'From personal mentor paid option when available'],
    ['Output Column', 'you_are_from', 'you_are_from', 'Included if Razorpay sends it'],
    ['Output Column', 'project_start_date', 'project_start_date', 'From selected start date'],
    ['Output Column', 'duration', 'duration', 'From duration dropdown when available'],
    ['Output Column', 'payment_date', 'payment_date', 'Tracking column requested'],
    ['Output Column', 'payment_page_title', 'payment_page_title', 'Tracking column requested'],
    ['Rule', 'Accepted webhook event', 'payment.captured', 'Ignore failed/refunded payments'],
    ['Rule', 'Duplicate protection', 'payment_id', 'Ignore duplicate payment_id'],
    ['CEP Role', CEP_ROLES[0], CEP_ROLES[0], 'Direct role name'],
    ['CEP Role', CEP_ROLES[1], CEP_ROLES[1], 'Direct role name'],
    ['CEP Role', CEP_ROLES[2], CEP_ROLES[2], 'Direct role name'],
    ['CEP Role', CEP_ROLES[3], CEP_ROLES[3], 'Direct role name'],
    ['CEP Role', CEP_ROLES[4], CEP_ROLES[4], 'Direct role name'],
    ['CEP Role', CEP_ROLES[5], CEP_ROLES[5], 'Direct role name'],
    ['CEP Role', CEP_ROLES[6], CEP_ROLES[6], 'Direct role name'],
    ['CEP Role', CEP_ROLES[7], CEP_ROLES[7], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[0], LIVE_PROJECT_ROLES[0], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[1], LIVE_PROJECT_ROLES[1], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[2], LIVE_PROJECT_ROLES[2], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[3], LIVE_PROJECT_ROLES[3], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[4], LIVE_PROJECT_ROLES[4], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[5], LIVE_PROJECT_ROLES[5], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[6], LIVE_PROJECT_ROLES[6], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[7], LIVE_PROJECT_ROLES[7], 'Direct role name'],
    ['Live Project Role', LIVE_PROJECT_ROLES[8], LIVE_PROJECT_ROLES[8], 'Direct role name'],
  ];
  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, rows[0].length)
    .setFontWeight('bold')
    .setBackground('#f3f6fb');
  sheet.autoResizeColumns(1, rows[0].length);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  const existingWidth = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getRange(1, 1, 1, existingWidth).getValues()[0].slice(0, headers.length);
  const same = headers.every((header, index) => existing[index] === header);
  if (!same) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function flattenPayload_(value, prefix, out) {
  out = out || {};
  prefix = prefix || '';

  if (value === null || value === undefined) return out;

  if (typeof value !== 'object' || value instanceof Date) {
    out[normalizeKey_(prefix)] = value;
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenPayload_(item, `${prefix}_${index}`, out));
    return out;
  }

  Object.keys(value).forEach(key => {
    const nextPrefix = prefix ? `${prefix}_${key}` : key;
    flattenPayload_(value[key], nextPrefix, out);
    const normalizedKey = normalizeKey_(key);
    if (typeof value[key] !== 'object' || value[key] === null) out[normalizedKey] = value[key];
  });

  return out;
}

function normalizeObject_(obj) {
  return Object.keys(obj || {}).reduce((acc, key) => {
    acc[normalizeKey_(key)] = obj[key];
    return acc;
  }, {});
}

function normalizeKey_(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function firstValue_(obj, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = obj[normalizeKey_(keys[i])];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function inferPersonalMentor_(normalized, rawBody) {
  const explicit = firstValue_(normalized, [
    'personalmentor',
    'personal_mentor',
    'add_a_personal_mentor_for_personalized_grooming_experience',
    'add_a_personal_mentor',
  ]);

  if (explicit !== '') {
    const text = String(explicit).toLowerCase();
    return ['yes', 'true', '1', 'selected', '1499', '1499.00'].some(token => text.indexOf(token) !== -1) ? 'Yes' : 'No';
  }

  const itemName = String(firstValue_(normalized, ['item_name', 'description'])).toLowerCase();
  const raw = String(rawBody || '').toLowerCase();
  return itemName.indexOf('personal mentor') !== -1 || (raw.indexOf('personal mentor') !== -1 && raw.indexOf('1499') !== -1) ? 'Yes' : 'No';
}

function normalizeAmount_(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (number >= 100000 && number % 100 === 0) return (number / 100).toFixed(2);
  return number.toFixed(2);
}

function normalizePhone_(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (text.indexOf('+') === 0) return text;
  if (/^[6-9]\d{9}$/.test(text)) return `+91${text}`;
  return text;
}

function uniqueNonEmpty_(values) {
  const seen = {};
  return values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(value => {
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
}

function formatRazorpayDate_(value) {
  if (!value) return '';
  if (typeof value === 'number') return formatDate_(new Date(value * 1000));
  return String(value);
}

function formatDate_(date) {
  return Utilities.formatDate(date, 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss');
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok_(data) {
  return json_(Object.assign({ ok: true }, data || {}));
}

function fail_(code, message) {
  return json_({ ok: false, code: code, message: message });
}

function testCepPayment() {
  const payload = {
    event: 'payment.captured',
    payment_page_title: 'Corporate Excellence Program Certification',
    payment_date: '06/07/2026 00:45:00',
    order_id: `order_TEST_CEP_${Date.now()}`,
    item_name: 'Corporate Excellence Program Certification in Two domain',
    total_payment_amount: '4499.00',
    currency: 'INR',
    payment_status: 'captured',
    payment_id: `pay_TEST_CEP_${Date.now()}`,
    please_choose_your_first_role: 'Equity Research & Financial Modeling Analyst (Sell Side Role)',
    please_choose_your_second_role: 'Marketing Manager Role',
    full_name: 'CEP Test Student',
    most_active_email_id: 'cep.test@example.com',
    any_other_alternative_mail_id: 'cep.alt@example.com',
    phone_number: '9876543210',
    current_college_or_company_name: 'Example College',
    select_start_date_of_your_program: '12th July',
    select_duration_of_your_live_project: '4-weeks',
  };
  return processSamplePayload_(payload);
}

function testLiveProjectPayment() {
  const payload = {
    event: 'payment.captured',
    payment_page_title: 'Live Project Certification',
    payment_date: '06/07/2026 00:47:00',
    order_id: `order_TEST_LIVE_${Date.now()}`,
    item_name: 'Live Project Certification in Two domain',
    total_payment_amount: '2899.00',
    currency: 'INR',
    payment_status: 'captured',
    payment_id: `pay_TEST_LIVE_${Date.now()}`,
    please_choose_your_first_role: 'Portfolio Manager - Quantitative Finance (Buy Side Role)',
    please_choose_your_second_role: 'Corporate Financial Planning & Analysis Role',
    full_name: 'Live Project Test Student',
    most_active_email_id: 'live.test@example.com',
    any_other_alternative_mail_id: 'live.alt@example.com',
    phone_number: '+919999999999',
    current_college_or_company_name: 'Example Company',
    select_start_date_of_your_live_project: '18th July',
  };
  return processSamplePayload_(payload);
}

function processSamplePayload_(payload) {
  const extracted = extractPayment_(payload, JSON.stringify(payload), new Date());
  const route = determineRoute_(extracted);
  if (!route) throw new Error('Sample route not detected.');
  const row = buildImportRow_(extracted);
  appendRaw_(extracted, 'processed_test', route.destinationSheet);
  appendImportRow_(route.destinationSheet, row);
  return row;
}
