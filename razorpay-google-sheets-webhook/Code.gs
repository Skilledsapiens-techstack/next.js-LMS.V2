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
    .addItem('Check Column Configuration', 'checkColumnConfiguration')
    .addItem('Restore Columns', 'restoreColumns')
    .addItem('Compare Leadership vs Sheet13', 'compareLeadershipWithSheet13')
    .addSeparator()
    .addItem('Show Webhook URL', 'showWebhookUrl')
    .addItem('Run Sample Leadership Test', 'testLeadershipPayment')
    .addItem('Run Sample Live Project Test', 'testLiveProjectPayment')
    .addToUi();
}

function compareLeadershipWithSheet13() {
  const ss = getSpreadsheet_();
  const result = buildLeadershipSheet13Report_(ss);
  SpreadsheetApp.getUi().alert(
    'Leadership vs Sheet13 Comparison',
    `Report created in "${result.reportSheetName}".\n\nDiscrepancies: ${result.discrepancyCount}\nMaster rows checked: ${result.masterCount}\nSheet13 rows checked: ${result.exportCount}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return result;
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

function checkColumnConfiguration() {
  const ss = getSpreadsheet_();
  const checks = [
    checkSheetColumns_(ss, SHEET_NAMES.raw, RAW_HEADERS),
    checkSheetColumns_(ss, SHEET_NAMES.leadership, IMPORT_HEADERS),
    checkSheetColumns_(ss, SHEET_NAMES.liveProjects, IMPORT_HEADERS),
    checkSheetColumns_(ss, SHEET_NAMES.errors, ERROR_HEADERS),
  ];

  const mismatches = checks.filter(result => !result.ok);
  const message = mismatches.length
    ? mismatches.map(formatColumnCheckMessage_).join('\n\n')
    : 'All Sheet 1 columns are correctly configured.';

  SpreadsheetApp.getUi().alert('Column Configuration', message, SpreadsheetApp.getUi().ButtonSet.OK);
  return {
    ok: mismatches.length === 0,
    checks: checks,
  };
}

function restoreColumns() {
  const ss = getSpreadsheet_();
  const restored = [
    restoreSheetColumns_(ss, SHEET_NAMES.raw, RAW_HEADERS),
    restoreSheetColumns_(ss, SHEET_NAMES.leadership, IMPORT_HEADERS),
    restoreSheetColumns_(ss, SHEET_NAMES.liveProjects, IMPORT_HEADERS),
    restoreSheetColumns_(ss, SHEET_NAMES.errors, ERROR_HEADERS),
  ];

  setupConfigSheet_(ss);

  const message = restored
    .map(result => `${result.sheetName}: ${result.rowsRestored} data row(s), backup: ${result.backupName}`)
    .join('\n');

  SpreadsheetApp.getUi().alert('Columns Restored', message, SpreadsheetApp.getUi().ButtonSet.OK);
  return {
    ok: true,
    restored: restored,
  };
}

function buildLeadershipSheet13Report_(ss) {
  const masterSheet = ss.getSheetByName(SHEET_NAMES.leadership);
  const exportSheet = ss.getSheetByName('Sheet13');

  if (!masterSheet) throw new Error(`Missing sheet: ${SHEET_NAMES.leadership}`);
  if (!exportSheet) throw new Error('Missing sheet: Sheet13');

  const masterData = readSheetObjects_(masterSheet);
  const exportData = readSheetObjects_(exportSheet);
  const masterEmailIndex = indexRowsByEmail_(masterData.rows);
  const exportEmailIndex = indexRowsByEmail_(exportData.rows);
  const reportRows = [];

  const compareFields = [
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

  compareFields.forEach(field => {
    if (!masterData.headerMap[field]) {
      reportRows.push(makeDiscrepancyRow_('MASTER_MISSING_COLUMN', '', '', '', field, '', '', `${SHEET_NAMES.leadership} missing ${field}`));
    }
    if (!exportData.headerMap[field]) {
      reportRows.push(makeDiscrepancyRow_('SHEET13_MISSING_COLUMN', '', '', '', field, '', '', `Sheet13 missing ${field}`));
    }
  });

  Object.keys(masterEmailIndex).forEach(email => {
    const masterMatches = masterEmailIndex[email];
    const exportMatches = exportEmailIndex[email] || [];

    if (masterMatches.length > 1) {
      masterMatches.forEach(match => {
        reportRows.push(makeDiscrepancyRow_('MASTER_DUPLICATE_EMAIL', email, match.rowNumber, '', 'email', email, '', 'Duplicate email in master tab'));
      });
    }

    if (!exportMatches.length) {
      masterMatches.forEach(match => {
        reportRows.push(makeDiscrepancyRow_('MISSING_IN_SHEET13', email, match.rowNumber, '', 'row', 'present', 'missing', 'Student exists in master but not in Sheet13'));
      });
      return;
    }

    if (exportMatches.length > 1) {
      exportMatches.forEach(match => {
        reportRows.push(makeDiscrepancyRow_('SHEET13_DUPLICATE_EMAIL', email, '', match.rowNumber, 'email', '', email, 'Duplicate email in Sheet13'));
      });
    }

    const masterRow = masterMatches[0];
    const exportRow = exportMatches[0];

    compareFields.forEach(field => {
      if (!masterData.headerMap[field] || !exportData.headerMap[field]) return;
      const masterValue = normalizeComparableValue_(masterRow.values[field], field);
      const exportValue = normalizeComparableValue_(exportRow.values[field], field);
      if (masterValue !== exportValue) {
        reportRows.push(makeDiscrepancyRow_(
          'FIELD_MISMATCH',
          email,
          masterRow.rowNumber,
          exportRow.rowNumber,
          field,
          masterRow.values[field],
          exportRow.values[field],
          'Sheet13 value differs from master'
        ));
      }
    });
  });

  Object.keys(exportEmailIndex).forEach(email => {
    if (masterEmailIndex[email]) return;
    exportEmailIndex[email].forEach(match => {
      reportRows.push(makeDiscrepancyRow_('EXTRA_IN_SHEET13', email, '', match.rowNumber, 'row', 'missing', 'present', 'Student exists in Sheet13 but not in master'));
    });
  });

  const reportSheetName = 'Leadership vs Sheet13 Discrepancies';
  const reportSheet = getOrCreateSheet_(ss, reportSheetName);
  const reportHeaders = [
    'issue_type',
    'email',
    'master_row',
    'sheet13_row',
    'field',
    'master_value',
    'sheet13_value',
    'notes',
  ];
  const output = [reportHeaders].concat(reportRows);

  reportSheet.clear();
  reportSheet.getRange(1, 1, output.length, reportHeaders.length).setValues(output);
  reportSheet.setFrozenRows(1);
  reportSheet.getRange(1, 1, 1, reportHeaders.length).setFontWeight('bold').setBackground('#f3f6fb');
  reportSheet.autoResizeColumns(1, reportHeaders.length);

  const summarySheetName = 'Leadership vs Sheet13 Summary';
  writeLeadershipSheet13Summary_(ss, summarySheetName, reportRows, masterData.rows.length, exportData.rows.length);

  return {
    reportSheetName: reportSheetName,
    summarySheetName: summarySheetName,
    discrepancyCount: reportRows.length,
    masterCount: masterData.rows.length,
    exportCount: exportData.rows.length,
  };
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

function checkSheetColumns_(ss, sheetName, expectedHeaders) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      ok: false,
      sheetName: sheetName,
      missingSheet: true,
      missing: expectedHeaders.slice(),
      extra: [],
      outOfOrder: [],
    };
  }

  const width = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const currentHeaders = sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  const expectedLookup = expectedHeaders.reduce((acc, header) => {
    acc[header] = true;
    return acc;
  }, {});

  const currentLookup = currentHeaders.reduce((acc, header) => {
    acc[header] = true;
    return acc;
  }, {});

  const missing = expectedHeaders.filter(header => !currentLookup[header]);
  const extra = currentHeaders.filter(header => !expectedLookup[header]);
  const outOfOrder = expectedHeaders.filter((header, index) => currentHeaders[index] !== header && currentLookup[header]);

  return {
    ok: missing.length === 0 && extra.length === 0 && outOfOrder.length === 0 && currentHeaders.length === expectedHeaders.length,
    sheetName: sheetName,
    missingSheet: false,
    missing: missing,
    extra: extra,
    outOfOrder: outOfOrder,
  };
}

function formatColumnCheckMessage_(result) {
  if (result.missingSheet) {
    return `${result.sheetName}: sheet is missing.`;
  }

  const lines = [`${result.sheetName}: columns need attention.`];
  if (result.missing.length) lines.push(`Missing: ${result.missing.join(', ')}`);
  if (result.extra.length) lines.push(`Extra: ${result.extra.join(', ')}`);
  if (result.outOfOrder.length) lines.push(`Out of order: ${result.outOfOrder.join(', ')}`);
  return lines.join('\n');
}

function restoreSheetColumns_(ss, sheetName, expectedHeaders) {
  const sheet = getOrCreateSheet_(ss, sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const backupName = createSheetBackup_(ss, sheet);

  const currentHeaders = lastRow > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(value => String(value || '').trim())
    : [];

  const dataRows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
    : [];

  const headerIndex = currentHeaders.reduce((acc, header, index) => {
    const normalized = normalizeHeader_(header);
    if (normalized && acc[normalized] === undefined) acc[normalized] = index;
    return acc;
  }, {});

  const restoredRows = dataRows.map(row => {
    return expectedHeaders.map(header => {
      const candidates = [header].concat(HEADER_ALIASES[header] || []);
      for (let i = 0; i < candidates.length; i += 1) {
        const index = headerIndex[normalizeHeader_(candidates[i])];
        if (index !== undefined) return row[index];
      }
      return '';
    });
  }).filter(rowHasValue_);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  if (restoredRows.length) {
    sheet.getRange(2, 1, restoredRows.length, expectedHeaders.length).setValues(restoredRows);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#f3f6fb');
  sheet.autoResizeColumns(1, Math.min(expectedHeaders.length, 20));

  return {
    sheetName: sheetName,
    rowsRestored: restoredRows.length,
    backupName: backupName,
  };
}

function createSheetBackup_(ss, sheet) {
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
  const baseName = `Backup - ${sheet.getName()}`.slice(0, 82);
  let backupName = `${baseName} - ${timestamp}`.slice(0, 100);
  let suffix = 1;

  while (ss.getSheetByName(backupName)) {
    backupName = `${baseName} - ${timestamp}-${suffix}`.slice(0, 100);
    suffix += 1;
  }

  sheet.copyTo(ss).setName(backupName);
  return backupName;
}

function normalizeHeader_(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function rowHasValue_(row) {
  return row.some(value => String(value || '').trim() !== '');
}

function readSheetObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return { headerMap: {}, rows: [] };

  const headers = values[0].map(value => String(value || '').trim());
  const headerMap = headers.reduce((acc, header, index) => {
    const canonical = canonicalHeaderName_(header);
    if (canonical && acc[canonical] === undefined) acc[canonical] = index;
    return acc;
  }, {});

  const rows = values.slice(1)
    .map((row, rowIndex) => {
      const rowValues = Object.keys(headerMap).reduce((acc, canonical) => {
        acc[canonical] = row[headerMap[canonical]];
        return acc;
      }, {});
      return {
        rowNumber: rowIndex + 2,
        values: rowValues,
      };
    })
    .filter(row => rowHasValue_(Object.keys(row.values).map(key => row.values[key])));

  return {
    headerMap: headerMap,
    rows: rows,
  };
}

function indexRowsByEmail_(rows) {
  return rows.reduce((acc, row) => {
    const email = normalizeEmail_(row.values.email);
    if (!email) return acc;
    if (!acc[email]) acc[email] = [];
    acc[email].push(row);
    return acc;
  }, {});
}

function makeDiscrepancyRow_(issueType, email, masterRow, sheet13Row, field, masterValue, sheet13Value, notes) {
  return [
    issueType,
    email,
    masterRow,
    sheet13Row,
    field,
    masterValue === null || masterValue === undefined ? '' : String(masterValue),
    sheet13Value === null || sheet13Value === undefined ? '' : String(sheet13Value),
    notes,
  ];
}

function writeLeadershipSheet13Summary_(ss, sheetName, reportRows, masterCount, exportCount) {
  const issueCounts = countBy_(reportRows, 0);
  const fieldMismatchCounts = countBy_(reportRows.filter(row => row[0] === 'FIELD_MISMATCH'), 4);
  const sampleRows = reportRows.slice(0, 25);
  const rows = [
    ['Section', 'Item', 'Count', 'Notes'],
    ['Totals', 'Master rows checked', masterCount, SHEET_NAMES.leadership],
    ['Totals', 'Sheet13 rows checked', exportCount, 'LMS export tab'],
    ['Totals', 'Total discrepancy rows', reportRows.length, 'Detailed rows are in Leadership vs Sheet13 Discrepancies'],
    ['', '', '', ''],
    ['Issue Type', 'FIELD_MISMATCH', issueCounts.FIELD_MISMATCH || 0, 'Same email found, but one or more compared fields differ'],
    ['Issue Type', 'MISSING_IN_SHEET13', issueCounts.MISSING_IN_SHEET13 || 0, 'Student exists in master but not in Sheet13'],
    ['Issue Type', 'EXTRA_IN_SHEET13', issueCounts.EXTRA_IN_SHEET13 || 0, 'Student exists in Sheet13 but not in master'],
    ['Issue Type', 'MASTER_DUPLICATE_EMAIL', issueCounts.MASTER_DUPLICATE_EMAIL || 0, 'Duplicate email rows in master'],
    ['Issue Type', 'SHEET13_DUPLICATE_EMAIL', issueCounts.SHEET13_DUPLICATE_EMAIL || 0, 'Duplicate email rows in Sheet13'],
    ['Issue Type', 'MASTER_MISSING_COLUMN', issueCounts.MASTER_MISSING_COLUMN || 0, 'Expected comparison column missing in master'],
    ['Issue Type', 'SHEET13_MISSING_COLUMN', issueCounts.SHEET13_MISSING_COLUMN || 0, 'Expected comparison column missing in Sheet13'],
    ['', '', '', ''],
    ['Field Mismatch', 'fullName', fieldMismatchCounts.fullName || 0, ''],
    ['Field Mismatch', 'email', fieldMismatchCounts.email || 0, ''],
    ['Field Mismatch', 'altEmail', fieldMismatchCounts.altEmail || 0, ''],
    ['Field Mismatch', 'phone', fieldMismatchCounts.phone || 0, ''],
    ['Field Mismatch', 'collegeName', fieldMismatchCounts.collegeName || 0, ''],
    ['Field Mismatch', 'cohortNames', fieldMismatchCounts.cohortNames || 0, ''],
    ['Field Mismatch', 'programNames', fieldMismatchCounts.programNames || 0, ''],
    ['Field Mismatch', 'waGroup', fieldMismatchCounts.waGroup || 0, ''],
    ['Field Mismatch', 'personalmentor', fieldMismatchCounts.personalmentor || 0, ''],
    ['Field Mismatch', 'you_are_from', fieldMismatchCounts.you_are_from || 0, ''],
    ['Field Mismatch', 'project_start_date', fieldMismatchCounts.project_start_date || 0, ''],
    ['Field Mismatch', 'duration', fieldMismatchCounts.duration || 0, ''],
    ['Field Mismatch', 'onboardingMailStatus', fieldMismatchCounts.onboardingMailStatus || 0, ''],
    ['Field Mismatch', 'active', fieldMismatchCounts.active || 0, ''],
    ['', '', '', ''],
    ['Sample', 'issue_type', 'email / field', 'master_value -> sheet13_value'],
  ];

  sampleRows.forEach(row => {
    rows.push([
      'Sample',
      row[0],
      `${row[1]} / ${row[4]}`,
      `${row[5]} -> ${row[6]}`,
    ]);
  });

  const sheet = getOrCreateSheet_(ss, sheetName);
  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#f3f6fb');
  sheet.autoResizeColumns(1, rows[0].length);
}

function countBy_(rows, index) {
  return rows.reduce((acc, row) => {
    const key = row[index] || '';
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function canonicalHeaderName_(header) {
  const normalized = normalizeHeader_(header);
  const aliases = {
    studentid: 'studentId',
    fullname: 'fullName',
    name: 'fullName',
    studentname: 'fullName',
    email: 'email',
    officialemail: 'email',
    primaryemail: 'email',
    altemail: 'altEmail',
    alternateemail: 'altEmail',
    alternativeemail: 'altEmail',
    phone: 'phone',
    phonenumber: 'phone',
    contact: 'phone',
    mobilenumber: 'phone',
    mobile: 'phone',
    collegename: 'collegeName',
    college: 'collegeName',
    yourcollege: 'collegeName',
    cohortnames: 'cohortNames',
    cohortname: 'cohortNames',
    cohorts: 'cohortNames',
    cohort: 'cohortNames',
    programnames: 'programNames',
    programname: 'programNames',
    programs: 'programNames',
    program: 'programNames',
    wagroup: 'waGroup',
    whatsappgroup: 'waGroup',
    personalmentor: 'personalmentor',
    personalmentorstatus: 'personalmentor',
    youarefrom: 'you_are_from',
    year: 'you_are_from',
    projectstartdate: 'project_start_date',
    programstartdate: 'project_start_date',
    startdate: 'project_start_date',
    duration: 'duration',
    onboardingmailstatus: 'onboardingMailStatus',
    onboardingstatus: 'onboardingMailStatus',
    active: 'active',
  };
  return aliases[normalized] || '';
}

function normalizeComparableValue_(value, field) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Kolkata', 'dd/MM/yyyy');

  let text = String(value).trim();
  if (!text) return '';

  if (field === 'email' || field === 'altEmail') return normalizeEmail_(text);
  if (field === 'phone') return normalizeComparablePhone_(text);
  if (field === 'active' || field === 'personalmentor') return normalizeBooleanLike_(text);
  if (field === 'programNames' || field === 'cohortNames' || field === 'waGroup') {
    return text.split(/[|,]/).map(part => part.trim()).filter(Boolean).sort().join('|').toLowerCase();
  }

  return text.replace(/\s+/g, ' ').toLowerCase();
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeComparablePhone_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.indexOf('91') === 0) return digits.slice(-10);
  return digits;
}

function normalizeBooleanLike_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['true', 'yes', '1', 'active'].indexOf(text) !== -1) return 'true';
  if (['false', 'no', '0', 'inactive'].indexOf(text) !== -1) return 'false';
  return text;
}

const HEADER_ALIASES = {
  fullName: ['full_name', 'name'],
  email: ['official_email', 'customer_email'],
  phone: ['phone_number', 'contact', 'customer_contact'],
  collegeName: ['your_college', 'college_name', 'college'],
  programNames: ['programName', 'program_name', 'role', 'roles'],
  personalmentor: ['personal_mentor', 'personalMentor'],
  project_start_date: ['select_your_project_start_date', 'select_your_program_start_date', 'start_date'],
  duration: ['select_tentative_duration_of_your_project'],
  payment_id: ['paymentId'],
};

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
