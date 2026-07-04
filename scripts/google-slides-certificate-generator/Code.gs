const DEFAULT_TEMPLATE_IDS = {
  leadership_program: '1WUabyBlCquIniL2r0rsR7p8Bl5Bd6KoZ5pUkHt3dy5U',
  live_project: '1wvuH3x9JBxCUgtz339cXamlmiUAvnPSc_djfsMA4E3A'
};

function setCertificateSlidesSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret is required.');
  }

  PropertiesService.getScriptProperties().setProperty('CERTIFICATE_SLIDES_SECRET', secret);
  return { ok: true };
}

function authorizeCertificateSlidesGenerator() {
  const leadershipDeck = SlidesApp.openById(templateIdForType('leadership_program'));
  const liveProjectDeck = SlidesApp.openById(templateIdForType('live_project'));
  const qrProbe = UrlFetchApp.fetch('https://quickchart.io/qr?size=80&text=authorization-check');

  return {
    ok: true,
    leadershipTemplate: leadershipDeck.getName(),
    liveProjectTemplate: liveProjectDeck.getName(),
    qrProbeStatus: qrProbe.getResponseCode()
  };
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData && event.postData.contents ? event.postData.contents : '{}');
    const expectedSecret = String(PropertiesService.getScriptProperties().getProperty('CERTIFICATE_SLIDES_SECRET') || '').trim();
    const receivedSecret = String(payload.secret || '').trim();

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Unauthorized certificate generation request.' }, 403);
    }

    const templateType = String(payload.templateType || '').trim();
    const templateId = templateIdForType(templateType);
    if (!templateId) return jsonResponse({ ok: false, error: 'Unknown certificate template type.' }, 400);

    const placeholders = payload.placeholders || {};
    const fileName = safeFileName(payload.fileName || `${placeholders.certificate_id || 'certificate'}.pdf`);
    const copy = DriveApp.getFileById(templateId).makeCopy(`Generated ${fileName.replace(/\.pdf$/i, '')} ${new Date().toISOString()}`);
    const copyId = copy.getId();

    try {
      const deck = SlidesApp.openById(copyId);
      replaceTextPlaceholders(deck, placeholders);
      replaceQrPlaceholders(deck, String(placeholders.verification_url || placeholders.qr_code || ''));
      deck.saveAndClose();

      const pdfBlob = DriveApp.getFileById(copyId).getAs(MimeType.PDF).setName(fileName);
      return jsonResponse({
        ok: true,
        fileName,
        mimeType: MimeType.PDF,
        pdfBase64: Utilities.base64Encode(pdfBlob.getBytes()),
        templateType,
        templateUrl: `google-slides:${templateType}:${templateId}`
      });
    } finally {
      DriveApp.getFileById(copyId).setTrashed(true);
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: error && error.message ? error.message : String(error) }, 500);
  }
}

function templateIdForType(templateType) {
  const props = PropertiesService.getScriptProperties();
  if (templateType === 'live_project') {
    return String(props.getProperty('LIVE_PROJECT_TEMPLATE_ID') || DEFAULT_TEMPLATE_IDS.live_project || '').trim();
  }
  if (templateType === 'leadership_program') {
    return String(props.getProperty('LEADERSHIP_TEMPLATE_ID') || DEFAULT_TEMPLATE_IDS.leadership_program || '').trim();
  }
  return '';
}

function replaceTextPlaceholders(deck, placeholders) {
  Object.keys(placeholders).forEach((key) => {
    if (key === 'qr_code') return;
    const value = placeholders[key] == null ? '' : String(placeholders[key]);
    deck.replaceAllText(`{{${key}}}`, value);
    deck.replaceAllText(`{{ ${key} }}`, value);
  });
}

function replaceQrPlaceholders(deck, verificationUrl) {
  if (!verificationUrl) return;
  const qrBlob = UrlFetchApp.fetch(`https://quickchart.io/qr?size=500&text=${encodeURIComponent(verificationUrl)}`).getBlob().setName('certificate-qr.png');
  deck.getSlides().forEach((slide) => {
    slide.getPageElements().forEach((element) => {
      if (element.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
      const shape = element.asShape();
      let text = '';
      try {
        text = shape.getText().asString();
      } catch (error) {
        return;
      }
      if (!text || text.indexOf('{{qr_code}}') === -1) return;
      const left = element.getLeft();
      const top = element.getTop();
      const width = element.getWidth();
      const height = element.getHeight();
      element.remove();
      slide.insertImage(qrBlob, left, top, width, height);
    });
  });
}

function safeFileName(value) {
  const cleaned = String(value || 'certificate.pdf').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-');
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

function jsonResponse(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ statusCode: statusCode || 200 }, body)))
    .setMimeType(ContentService.MimeType.JSON);
}
