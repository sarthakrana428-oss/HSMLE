/**
 * HSMLE India — Dedicated Automated RFQ Confirmation Gateway for Website
 * Google Apps Script (MailApp) Integration
 * 
 * Objective:
 * Securely receive authenticated RFQ customer confirmation requests from
 * the HSMLE Website backend and dispatch confirmation emails using Google MailApp.
 * 
 * SETUP INSTRUCTIONS FOR SEPARATE WEBSITE DEPLOYMENT:
 * 1. Open https://script.google.com using the designated HSMLE Google account.
 * 2. Click "New project" and name it: "HSMLE Website RFQ Mailer".
 * 3. Replace all contents of Code.gs with this file.
 * 4. Configure the shared secret:
 *    - Click "Project Settings" (gear icon on left).
 *    - Under "Script Properties", click "Add script property".
 *    - Property: HSMLE_WEBSITE_SECRET (or SCRIPT_SECRET)
 *    - Value: A strong, 64-character random hex string (e.g. generated with `openssl rand -hex 32`).
 * 5. Deploy as Web App:
 *    - Click "Deploy" > "New deployment".
 *    - Select type: "Web app".
 *    - Description: "HSMLE Website RFQ Acknowledgement Service v1".
 *    - Execute as: "Me (<your-google-account>)".
 *    - Who has access: "Anyone" (Required for backend server-to-server HTTP POST).
 *    - Click "Deploy".
 *    - Authorize access when prompted by Google (Allow MailApp permissions).
 * 6. Copy the "Web app URL" (ends with /exec).
 * 7. Set in D:\Projects\PORTAL_WEBSITE\HSMLE\.env:
 *    EMAIL_PROVIDER=google_apps_script
 *    GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/<WEBSITE_DEPLOYMENT_ID>/exec
 *    GOOGLE_APPS_SCRIPT_SECRET=<the-exact-same-script-secret-set-in-step-4>
 *    EMAIL_FROM_NAME="HSMLE India"
 */

var DEFAULT_SECRET_FALLBACK = "";

/**
 * Retrieves the configured shared secret from Script Properties.
 */
function getScriptSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty("HSMLE_WEBSITE_SECRET") || 
               props.getProperty("SCRIPT_SECRET") || 
               props.getProperty("HSMLE_SHARED_SECRET");
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  return DEFAULT_SECRET_FALLBACK;
}

/**
 * Constant-time string comparison to prevent timing attacks on the shared secret.
 */
function constantTimeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generates standard JSON ContentService response.
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * HTTP GET Handler: Safe health-check / status endpoint.
 */
function doGet(e) {
  var remainingQuota = 0;
  try {
    remainingQuota = MailApp.getRemainingDailyQuota();
  } catch (err) {
    remainingQuota = -1;
  }
  
  return createJsonResponse({
    ok: true,
    service: "HSMLE Website RFQ Mailer Gateway",
    version: "1.0.0",
    status: "online",
    daily_quota_remaining: remainingQuota,
    timestamp: new Date().toISOString()
  });
}

/**
 * HTTP POST Handler: Authenticated email dispatch endpoint.
 */
function doPost(e) {
  var timestamp = new Date().toISOString();
  
  // 1. Verify postData existence
  if (!e || !e.postData || !e.postData.contents) {
    return createJsonResponse({
      ok: false,
      success: false,
      status: "failed",
      error: "Bad Request: Missing request body",
      reason: "missing_request_body",
      timestamp: timestamp
    });
  }

  // 2. Parse JSON body
  var payload = null;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return createJsonResponse({
      ok: false,
      success: false,
      status: "failed",
      error: "Bad Request: Malformed JSON body",
      reason: "malformed_json",
      timestamp: timestamp
    });
  }

  // 3. Authenticate shared secret
  var serverSecret = getScriptSecret();
  if (!serverSecret) {
    Logger.log("ERROR: HSMLE_WEBSITE_SECRET is not configured in Script Properties.");
    return createJsonResponse({
      ok: false,
      success: false,
      status: "failed",
      error: "Server Configuration Error: Secret not configured in Google Apps Script Project Settings",
      reason: "missing_script_property",
      timestamp: timestamp
    });
  }

  var clientSecret = "";
  if (payload.shared_secret) {
    clientSecret = payload.shared_secret.toString().trim();
  } else if (payload.secret) {
    clientSecret = payload.secret.toString().trim();
  } else if (payload.HSMLE_SHARED_SECRET) {
    clientSecret = payload.HSMLE_SHARED_SECRET.toString().trim();
  }

  if (!clientSecret && e.parameter && e.parameter.secret) {
    clientSecret = e.parameter.secret.toString().trim();
  }

  if (!clientSecret || !constantTimeEquals(serverSecret, clientSecret)) {
    Logger.log("WARN: Unauthorized request attempt rejected.");
    return createJsonResponse({
      ok: false,
      success: false,
      status: "failed",
      error: "Unauthorized",
      reason: "secret_mismatch",
      timestamp: timestamp
    });
  }

  // 4. Validate recipient and payload
  var to = (payload.to || payload.recipient || "").toString().trim();
  var rfqRef = (payload.rfq_reference || payload.reference || "UNKNOWN").toString().trim();
  var customerName = (payload.customer_name || payload.customerName || "Valued Client").toString().trim();
  var senderName = (payload.sender_name || payload.senderName || "HSMLE India").toString().trim();
  var replyTo = (payload.reply_to || payload.replyTo || "sales@hsmleindia.com").toString().trim();
  var idempotencyKey = (payload.idempotency_key || payload.idempotencyKey || "").toString().trim();
  var subject = (payload.subject || ("Your RFQ Has Been Received — HSMLE India (" + rfqRef + ")")).toString().trim();
  var bodyText = (payload.body || payload.body_text || "").toString().trim();
  var bodyHtml = (payload.html_body || payload.body_html || payload.htmlBody || "").toString().trim();

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to)) {
    return createJsonResponse({
      success: false,
      status: "failed",
      error: "Validation Error: Invalid recipient email address",
      timestamp: timestamp
    });
  }

  // 5. Idempotency Check using Script Cache
  var cache = CacheService.getScriptCache();
  if (idempotencyKey) {
    var cacheKey = "idemp_" + idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 200);
    var cachedMessageId = cache.get(cacheKey);
    if (cachedMessageId) {
      Logger.log("Idempotent replay detected for key: " + cacheKey);
      return createJsonResponse({
        ok: true,
        success: true,
        status: "already_sent",
        message_id: cachedMessageId,
        idempotent_replay: true,
        message: "Email confirmation was already dispatched for this RFQ.",
        timestamp: timestamp
      });
    }
  }

  // 6. Check MailApp Quota
  var remainingQuota = 0;
  try {
    remainingQuota = MailApp.getRemainingDailyQuota();
    if (remainingQuota <= 0) {
      return createJsonResponse({
        ok: false,
        success: false,
        status: "failed",
        error: "Quota Exceeded: Google MailApp daily email limit reached for this account",
        remaining_quota: 0,
        timestamp: timestamp
      });
    }
  } catch (quotaErr) {
    Logger.log("WARN: Could not verify MailApp quota: " + quotaErr.message);
  }

  // 7. Dispatch Email using MailApp.sendEmail()
  var messageId = "gas-site-" + new Date().getTime() + "-" + rfqRef.replace(/[^a-zA-Z0-9_-]/g, "");

  try {
    var emailOptions = {
      to: to,
      subject: subject,
      body: bodyText,
      name: senderName,
      replyTo: replyTo
    };
    if (bodyHtml) {
      emailOptions.htmlBody = bodyHtml;
    }

    MailApp.sendEmail(emailOptions);

    if (idempotencyKey) {
      try {
        var cacheKey = "idemp_" + idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 200);
        cache.put(cacheKey, messageId, 21600); // 6 hours TTL
      } catch (cacheErr) {}
    }

    return createJsonResponse({
      ok: true,
      success: true,
      status: "accepted",
      message_id: messageId,
      rfq_reference: rfqRef,
      timestamp: new Date().toISOString()
    });

  } catch (sendErr) {
    return createJsonResponse({
      ok: false,
      success: false,
      status: "failed",
      error: "MailApp Error: " + (sendErr.message || String(sendErr)),
      rfq_reference: rfqRef,
      timestamp: new Date().toISOString()
    });
  }
}

