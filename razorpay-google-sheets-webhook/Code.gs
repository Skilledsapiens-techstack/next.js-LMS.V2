const SHEET_NAMES = {
  raw: 'Raw Razorpay Payments',
  leadership: 'Leadership Programs - Import Ready',
  liveProjects: 'Live Projects - Import Ready',
  config: 'Mapping / Config',
  errors: 'Errors / Needs Review',
};

const IMPORT_HEADERS = [
  'studentId',
  'fullName',
  'email',
  'altEmail',
  'phone',
  'collegeName',
  'cohortNames',
  'programNames',
  'waGroup',
  'personalmentor',
  'you_are_from',
  'project_start_date',
  'duration',
  'onboardingMailStatus',
  'active',
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
  'select_your_first_program_role',
  'select_your_second_program_role',
  'select_your_third_program_role',
  'select_your_first_live_project_role',
  'select_your_second_live_project_role',
  'select_your_3rd_live_project_role',
  'full_name',
  'official_email',
  'phone_number',
  'your_college',
  'you_are_from',
  'select_your_program_start_date',
  'select_your_project_start_date',
  'select_tentative_duration_of_your_project',
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
  'official_email',
  'phone_number',
  'error_type',
  'error_message',
  'raw_payload_json',
  'review_status',
  'review_notes',
];

const LEADERSHIP_ROLES = [
  'Sales & Marketing Leadership Program',
  'Management Consulting Leadership Program',
  'Finance Leadership Program',
  'Product Management Leadership Program',
  'HR Leadership Program',
];

const LIVE_PROJECT_ROLE_MAP = {
  'Growth & Strategy Consultant': 'Live Projects - Management Tracks',
  'Sales & Marketing Manager': 'Live Projects - Management Tracks',
  'Digital Marketing Specialist': 'Live Projects - Management Tracks',
  'Product & Brand Manager': 'Live Projects - Management Tracks',
  'Product Marketing Manager': 'Live Projects - Management Tracks',
  'Business Analyst': 'Live Projects - Management Tracks',
  'Market Research & Analytics': 'Live Projects - Management Tracks',
  'HR Manager': 'Live Projects - HR Track',
  'Equity Research & Financial Modeling Analyst': 'Live Projects - ER Track',
  'Portfolio Manager - Quantitative Finance Role': 'Live Projects - QF Track',
  'Private Equity & Venture Capital Analyst': 'Live Projects - PEVC Track',
};

const SCRIPT_PROP_KEYS = {
  webhookToken: 'RAZORPAY_WEBHOOK_TOKEN',
  spreadsheetId: 'SPREADSHEET_ID',
};

const DEFAULT_SPREADSHEET_ID = '1TVbONyDquelXLYecXcIS14zXjzZDp-irTI_R2_yaoiU';
const DEFAULT_WEBHOOK_TOKEN = '0172e8c6d9633a05ff08808ff5e7336741604e55194e66af5b84ceca55ae7fc0';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Razorpay LMS')
    .addItem('Setup / Repair Workbook', 'setupWorkbook')
    .addItem('Show Webhook URL', 'showWebhookUrl')
    .addItem('Run Sample Leadership Test', 'testLeadershipPayment')
    .addItem('Run Sample Live Project Test', 'testLiveProjectPayment')
    .addToUi();
}

function setupWorkbook() {
  const ss = getSpreadsheet_();
  setupSheet_(ss, SHEET_NAMES.raw, RAW_HEADERS);
  setupSheet_(ss, SHEET_NAMES.leadership, IMPORT_HEADERS);
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

function doGet() {
  return json_({
    ok: true,
    service: 'Razorpay Paid Students - LMS Import',
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
    if (!rawBody) {
      return fail_('EMPTY_BODY', 'Request body is empty.');
    }

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
      appendRaw_(extracted, 'needs_review', 'Could not identify source form.');
      appendError_(extracted, 'UNKNOWN_FORM', 'Could not map payment to Leadership Programs or Live Projects.');
      return fail_('UNKNOWN_FORM', 'Could not identify source form.');
    }

    const importRow = buildImportRow_(extracted, route);
    const validation = validateImportRow_(importRow, route);
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
  const itemAmount = firstValue_(normalized, ['item_amount']);
  const itemPaymentAmount = firstValue_(normalized, ['item_payment_amount']);
  const createdAt = firstValue_(normalized, ['payment_date', 'created_at']);

  return {
    receivedAt: formatDate_(receivedAt),
    event: firstValue_(normalized, ['event']),
    paymentPageId: firstValue_(normalized, ['payment_page_id', 'payment_link_id', 'paymentlinkid']),
    paymentPageTitle: firstValue_(normalized, ['payment_page_title', 'payment_link_title', 'title', 'description']),
    paymentDate: formatRazorpayDate_(createdAt),
    orderId: firstValue_(normalized, ['order_id', 'orderid']),
    itemName: firstValue_(normalized, ['item_name', 'description']),
    itemAmount: normalizeAmount_(itemAmount),
    itemQuantity: firstValue_(normalized, ['item_quantity']) || '',
    itemPaymentAmount: normalizeAmount_(itemPaymentAmount),
    totalPaymentAmount: normalizeAmount_(amount),
    currency: firstValue_(normalized, ['currency']) || 'INR',
    paymentStatus: firstValue_(normalized, ['payment_status', 'status']),
    paymentId: firstValue_(normalized, ['payment_id', 'id']),
    firstProgramRole: firstValue_(normalized, ['select_your_first_program_role']),
    secondProgramRole: firstValue_(normalized, ['select_your_second_program_role']),
    thirdProgramRole: firstValue_(normalized, ['select_your_third_program_role']),
    firstLiveProjectRole: firstValue_(normalized, ['select_your_first_live_project_role']),
    secondLiveProjectRole: firstValue_(normalized, ['select_your_second_live_project_role']),
    thirdLiveProjectRole: firstValue_(normalized, ['select_your_3rd_live_project_role', 'select_your_third_live_project_role']),
    fullName: firstValue_(normalized, ['full_name', 'name', 'customer_name']),
    officialEmail: firstValue_(normalized, ['official_email', 'email', 'customer_email']),
    phoneNumber: normalizePhone_(firstValue_(normalized, ['phone_number', 'contact', 'phone', 'customer_contact'])),
    college: firstValue_(normalized, ['your_college', 'college_name', 'college']),
    yearFrom: firstValue_(normalized, ['you_are_from']),
    programStartDate: firstValue_(normalized, ['select_your_program_start_date']),
    projectStartDate: firstValue_(normalized, ['select_your_project_start_date']),
    duration: firstValue_(normalized, ['select_tentative_duration_of_your_project', 'duration']),
    personalMentor: inferPersonalMentor_(normalized),
    rawPayloadJson: rawBody,
  };
}

function determineRoute_(extracted) {
  const title = String(extracted.paymentPageTitle || '').toLowerCase();
  const item = String(extracted.itemName || '').toLowerCase();
  const hasLeadershipRole = [extracted.firstProgramRole, extracted.secondProgramRole, extracted.thirdProgramRole].some(Boolean);
  const hasLiveRole = [extracted.firstLiveProjectRole, extracted.secondLiveProjectRole, extracted.thirdLiveProjectRole].some(Boolean);

  if (title.indexOf('corporate live projects') !== -1 || item.indexOf('live project') !== -1 || hasLiveRole) {
    return { sourceForm: 'live_projects', destinationSheet: SHEET_NAMES.liveProjects };
  }

  if (title.indexOf('leadership program') !== -1 || item.indexOf('leadership program') !== -1 || hasLeadershipRole) {
    return { sourceForm: 'leadership_programs', destinationSheet: SHEET_NAMES.leadership };
  }

  return null;
}

function buildImportRow_(extracted, route) {
  const programNames = route.sourceForm === 'live_projects'
    ? mapLiveProjectPrograms_(extracted)
    : mapLeadershipPrograms_(extracted);

  const projectStartDate = route.sourceForm === 'live_projects'
    ? extracted.projectStartDate
    : extracted.programStartDate;

  const duration = route.sourceForm === 'live_projects' ? extracted.duration : '';

  return {
    studentId: '',
    fullName: extracted.fullName || '',
    email: extracted.officialEmail || '',
    altEmail: '',
    phone: extracted.phoneNumber || '',
    collegeName: extracted.college || '',
    cohortNames: '',
    programNames: programNames,
    waGroup: '',
    personalmentor: extracted.personalMentor,
    you_are_from: extracted.yearFrom || '',
    project_start_date: projectStartDate || '',
    duration: duration || '',
    onboardingMailStatus: 'pending',
    active: 'true',
  };
}

function mapLeadershipPrograms_(extracted) {
  return uniqueNonEmpty_([
    extracted.firstProgramRole,
    extracted.secondProgramRole,
    extracted.thirdProgramRole,
  ]).join('|');
}

function mapLiveProjectPrograms_(extracted) {
  const selectedRoles = uniqueNonEmpty_([
    extracted.firstLiveProjectRole,
    extracted.secondLiveProjectRole,
    extracted.thirdLiveProjectRole,
  ]);
  return uniqueNonEmpty_(selectedRoles.map(role => LIVE_PROJECT_ROLE_MAP[role] || '')).join('|');
}

function validateImportRow_(row, route) {
  const errors = [];
  ['fullName', 'email', 'phone', 'collegeName', 'programNames'].forEach(key => {
    if (!row[key]) errors.push(`Missing ${key}`);
  });
  if (route.sourceForm === 'live_projects' && !row.duration) {
    errors.push('Missing duration for Live Projects');
  }
  return errors;
}

function appendRaw_(extracted, status, note) {
  const row = [
    extracted.receivedAt,
    determineRoute_(extracted) ? determineRoute_(extracted).sourceForm : '',
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
    extracted.firstProgramRole,
    extracted.secondProgramRole,
    extracted.thirdProgramRole,
    extracted.firstLiveProjectRole,
    extracted.secondLiveProjectRole,
    extracted.thirdLiveProjectRole,
    extracted.fullName,
    extracted.officialEmail,
    extracted.phoneNumber,
    extracted.college,
    extracted.yearFrom,
    extracted.programStartDate,
    extracted.projectStartDate,
    extracted.duration,
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
    extracted.officialEmail || '',
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
  return [SHEET_NAMES.raw, SHEET_NAMES.leadership, SHEET_NAMES.liveProjects, SHEET_NAMES.errors].some(sheetName => {
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
  if (!expected) {
    throw new Error(`Missing Script Property: ${SCRIPT_PROP_KEYS.webhookToken}`);
  }

  const actual = e && e.parameter ? e.parameter.token : '';
  if (!actual || actual !== expected) {
    throw new Error('Invalid webhook token.');
  }
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
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, Math.min(headers.length, 20));
  return sheet;
}

function setupConfigSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.config);
  const rows = [
    ['Section', 'Source Value', 'Destination / Setting', 'Notes'],
    ['Form Routing', 'Application Form | Leadership Programs', SHEET_NAMES.leadership, 'Payment page title'],
    ['Form Routing', 'Application Form-Corporate Live Projects', SHEET_NAMES.liveProjects, 'Payment page title'],
    ['Default', 'studentId', '', 'Keep blank; LMS auto-generates'],
    ['Default', 'altEmail', '', 'Keep blank'],
    ['Default', 'cohortNames', '', 'Keep blank; LMS handles it'],
    ['Default', 'waGroup', '', 'Keep blank; LMS handles it'],
    ['Default', 'onboardingMailStatus', 'pending', 'Every captured payment'],
    ['Default', 'active', 'true', 'Every captured payment'],
    ['Default', 'duration', '', 'Blank for Leadership Programs'],
    ['Leadership Program Role', 'Sales & Marketing Leadership Program', 'Sales & Marketing Leadership Program', 'Direct LMS program name'],
    ['Leadership Program Role', 'Management Consulting Leadership Program', 'Management Consulting Leadership Program', 'Direct LMS program name'],
    ['Leadership Program Role', 'Finance Leadership Program', 'Finance Leadership Program', 'Team may edit ER/QF later'],
    ['Leadership Program Role', 'Product Management Leadership Program', 'Product Management Leadership Program', 'Direct LMS program name'],
    ['Leadership Program Role', 'HR Leadership Program', 'HR Leadership Program', 'Direct LMS program name'],
    ['Live Project Role', 'Growth & Strategy Consultant', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'Sales & Marketing Manager', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'Digital Marketing Specialist', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'Product & Brand Manager', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'Product Marketing Manager', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'Business Analyst', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'Market Research & Analytics', 'Live Projects - Management Tracks', 'Deduplicate if multiple roles map here'],
    ['Live Project Role', 'HR Manager', 'Live Projects - HR Track', ''],
    ['Live Project Role', 'Equity Research & Financial Modeling Analyst', 'Live Projects - ER Track', ''],
    ['Live Project Role', 'Portfolio Manager - Quantitative Finance Role', 'Live Projects - QF Track', ''],
    ['Live Project Role', 'Private Equity & Venture Capital Analyst', 'Live Projects - PEVC Track', ''],
    ['Rule', 'Accepted webhook event', 'payment.captured', 'Ignore failed/refunded imports'],
    ['Rule', 'Duplicate protection', 'payment_id', 'Ignore duplicate payment_id'],
    ['Rule', 'Multiple programs separator', '|', 'Use pipe-separated programNames'],
  ];
  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  sheet.autoResizeColumns(1, rows[0].length);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  const existingWidth = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getRange(1, 1, 1, existingWidth).getValues()[0].slice(0, headers.length);
  const same = headers.every((header, index) => existing[index] === header);
  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
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
    if (typeof value[key] !== 'object' || value[key] === null) {
      out[normalizedKey] = value[key];
    }
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
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function inferPersonalMentor_(normalized) {
  const explicit = firstValue_(normalized, [
    'personalmentor',
    'personal_mentor',
    'do_you_want_to_opt_for_a_personal_mentor',
    'do_you_want_to_opt_for_personal_mentor',
  ]);

  if (explicit !== '') {
    const text = String(explicit).toLowerCase();
    return ['yes', 'true', '1', 'selected', '1499', '1499.00'].some(token => text.indexOf(token) !== -1) ? 'Yes' : 'No';
  }

  const itemName = String(firstValue_(normalized, ['item_name', 'description'])).toLowerCase();
  return itemName.indexOf('personal mentor') !== -1 ? 'Yes' : 'No';
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

function testLeadershipPayment() {
  const payload = {
    event: 'payment.captured',
    payment_page_id: 'pl_T4H4yY2e2ngxyp',
    payment_page_title: 'Application Form | Leadership Programs',
    payment_date: '04/07/2026 22:06:18',
    order_id: `order_TEST_${Date.now()}`,
    item_name: 'I want to register for only 1 Leadership Program',
    item_amount: '3899.00',
    item_quantity: '1',
    item_payment_amount: '3899.00',
    total_payment_amount: '3899.00',
    currency: 'INR',
    payment_status: 'captured',
    payment_id: `pay_TEST_LP_${Date.now()}`,
    select_your_first_program_role: 'Sales & Marketing Leadership Program',
    full_name: 'Asmit Dubey',
    official_email: 'asmit.test@example.com',
    phone_number: '+919026772129',
    your_college: 'IIM Ranchi',
    you_are_from: '1st Year',
    select_your_program_start_date: '5th July',
  };
  return processSamplePayload_(payload);
}

function testLiveProjectPayment() {
  const payload = {
    event: 'payment.captured',
    payment_page_title: 'Application Form-Corporate Live Projects',
    payment_date: '05/07/2026 01:13:42',
    order_id: `order_TEST_${Date.now()}`,
    item_name: 'I want to register for 2 roles',
    total_payment_amount: '2799.00',
    currency: 'INR',
    payment_status: 'captured',
    payment_id: `pay_TEST_LIVE_${Date.now()}`,
    select_your_first_live_project_role: 'Sales & Marketing Manager',
    select_your_second_live_project_role: 'Business Analyst',
    full_name: 'Live Project Student',
    official_email: 'live.test@example.com',
    phone_number: '+919999999999',
    your_college: 'Example College',
    you_are_from: '2nd Year',
    select_your_project_start_date: '8th July',
    select_tentative_duration_of_your_project: '4-weeks',
  };
  return processSamplePayload_(payload);
}

function processSamplePayload_(payload) {
  const extracted = extractPayment_(payload, JSON.stringify(payload), new Date());
  const route = determineRoute_(extracted);
  if (!route) throw new Error('Sample route not detected.');
  const row = buildImportRow_(extracted, route);
  appendRaw_(extracted, 'processed_test', route.destinationSheet);
  appendImportRow_(route.destinationSheet, row);
  return row;
}
