import datetime
import html
import json
import logging
import urllib.error
import urllib.request
from typing import Optional, List
from sqlalchemy.orm import Session

from ..config import settings
from ..models.notification import NotificationRecord
from ..models.quotation import QuotationRequest

logger = logging.getLogger("notifications")


def _record_email_result(
    db: Session,
    existing_record: Optional[NotificationRecord],
    rfq_id: Optional[int],
    rfq_reference: str,
    channel: str,
    recipient: str,
    status: str,
    provider_message_id: Optional[str],
    error_summary: Optional[str],
    created_at: datetime.datetime,
    sent_at: Optional[datetime.datetime]
) -> NotificationRecord:
    """
    Persists or updates an email delivery attempt in notification_records.
    Avoids duplicate rows on retries by updating existing records in-place.
    """
    if existing_record:
        existing_record.status = status
        existing_record.provider_message_id = provider_message_id
        existing_record.error_summary = error_summary
        if sent_at:
            existing_record.sent_at = sent_at
        db.add(existing_record)
        db.commit()
        db.refresh(existing_record)
        return existing_record

    record = NotificationRecord(
        rfq_id=rfq_id,
        rfq_reference=rfq_reference,
        channel=channel,
        recipient=recipient,
        status=status,
        provider_message_id=provider_message_id,
        error_summary=error_summary,
        created_at=created_at,
        sent_at=sent_at
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _dispatch_google_apps_script(
    rfq_id: Optional[int],
    rfq_reference: str,
    recipient: str,
    customer_name: str,
    subject: str,
    body_text: str,
    body_html: str,
    db: Session,
    now: datetime.datetime,
    idempotency_suffix: str = "cust",
    existing_record: Optional[NotificationRecord] = None
) -> NotificationRecord:
    """
    Dispatches email via Google Apps Script MailApp.
    Uses separate website configuration and isolated idempotency keys.
    """
    channel = "email"
    url = (settings.GOOGLE_APPS_SCRIPT_URL or "").strip()
    secret = (settings.GOOGLE_APPS_SCRIPT_SECRET or "").strip()

    if secret.startswith("http://") or secret.startswith("https://"):
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq_id,
            rfq_reference=rfq_reference,
            channel=channel,
            recipient=recipient,
            status="failed",
            provider_message_id=None,
            error_summary="Configuration Error: GOOGLE_APPS_SCRIPT_SECRET is set to an HTTP/HTTPS URL. A 64-character hexadecimal shared secret is expected.",
            created_at=now,
            sent_at=None
        )

    if not url or not secret or "YOUR_DEPLOYMENT_ID" in url or "YOUR_LONG_RANDOM" in secret:
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq_id,
            rfq_reference=rfq_reference,
            channel=channel,
            recipient=recipient,
            status="awaiting_credentials",
            provider_message_id=None,
            error_summary="GOOGLE_APPS_SCRIPT_URL or GOOGLE_APPS_SCRIPT_SECRET is not configured with active credentials in .env.",
            created_at=now,
            sent_at=None
        )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "HSMLE-Website-Backend/2.0",
        "X-Shared-Secret": secret,
    }

    # Distinct namespaced idempotency key to prevent collision across deployments
    idempotency_key = f"website-rfq-{rfq_reference}-{idempotency_suffix}"

    payload = {
        "shared_secret": secret,
        "secret": secret,
        "HSMLE_SHARED_SECRET": secret,
        "to": recipient,
        "recipient": recipient,
        "customer_name": customer_name,
        "customerName": customer_name,
        "rfq_reference": rfq_reference,
        "reference": rfq_reference,
        "subject": subject,
        "body": body_text,
        "body_text": body_text,
        "html_body": body_html,
        "body_html": body_html,
        "idempotency_key": idempotency_key,
        "idempotencyKey": idempotency_key,
        "reply_to": settings.SALES_EMAIL,
        "replyTo": settings.SALES_EMAIL,
        "sender_name": settings.EMAIL_FROM_NAME,
        "senderName": settings.EMAIL_FROM_NAME,
    }

    safe_url = url.split("?")[0]
    logger.info(f"[GAS-DISPATCH] Target: {safe_url} | Recipient: {recipient} | RFQ: {rfq_reference}")

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            status_code = response.status
            body_bytes = response.read()
            body_str = body_bytes.decode("utf-8", errors="ignore").strip()

            msg_id = f"gas-{int(now.timestamp())}-{rfq_reference}"
            res_json = {}
            try:
                res_json = json.loads(body_str)
                msg_id = res_json.get("message_id") or res_json.get("messageId") or res_json.get("id") or msg_id
            except Exception:
                pass

            is_accepted = (
                res_json.get("success") is True or
                res_json.get("ok") is True or
                res_json.get("status") in ("accepted", "sent", "already_sent")
            )

            if status_code in (200, 201, 202) and is_accepted:
                logger.info(f"GAS email confirmed for {recipient} (ID: {msg_id})")
                return _record_email_result(
                    db=db,
                    existing_record=existing_record,
                    rfq_id=rfq_id,
                    rfq_reference=rfq_reference,
                    channel=channel,
                    recipient=recipient,
                    status="sent",
                    provider_message_id=msg_id,
                    error_summary=None,
                    created_at=now,
                    sent_at=now
                )
            else:
                if "<html" in body_str.lower() or "accounts.google.com" in body_str:
                    err_detail = "Google Apps Script returned an HTML login page. Ensure Web App 'Who has access' is set to 'Anyone'."
                else:
                    err_detail = res_json.get("error") or res_json.get("message") or f"Google Apps Script returned unexpected response (status {status_code}): {body_str[:200]}"
                sanitized_err = err_detail.replace(secret, "[REDACTED]") if secret else err_detail
                logger.error(f"GAS delivery error for {recipient}: {sanitized_err}")
                return _record_email_result(
                    db=db,
                    existing_record=existing_record,
                    rfq_id=rfq_id,
                    rfq_reference=rfq_reference,
                    channel=channel,
                    recipient=recipient,
                    status="failed",
                    provider_message_id=None,
                    error_summary=sanitized_err,
                    created_at=now,
                    sent_at=None
                )

    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8", errors="ignore") if hasattr(he, "read") else ""
        err_msg = f"HTTP {he.code}: {he.reason}"
        if he.code == 401:
            err_msg = "Unauthorized: Invalid or missing authentication secret in Google Apps Script."
        elif he.code in (301, 302) and "accounts.google.com" in err_body:
            err_msg = "Google Apps Script redirected to login. Web App deployment must be set to 'Who has access: Anyone'."
        sanitized_err = err_msg.replace(secret, "[REDACTED]") if secret else err_msg
        logger.error(f"GAS HTTPError for {recipient}: {sanitized_err}")
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq_id,
            rfq_reference=rfq_reference,
            channel=channel,
            recipient=recipient,
            status="failed",
            provider_message_id=None,
            error_summary=sanitized_err,
            created_at=now,
            sent_at=None
        )

    except (urllib.error.URLError, TimeoutError) as ue:
        err_msg = f"Network or timeout error communicating with Google Apps Script: {ue.reason if hasattr(ue, 'reason') else ue}"
        sanitized_err = err_msg.replace(secret, "[REDACTED]") if secret else err_msg
        logger.error(f"GAS URLError for {recipient}: {sanitized_err}")
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq_id,
            rfq_reference=rfq_reference,
            channel=channel,
            recipient=recipient,
            status="failed",
            provider_message_id=None,
            error_summary=sanitized_err,
            created_at=now,
            sent_at=None
        )

    except Exception as ex:
        err_msg = f"Unexpected error during email dispatch: {ex}"
        sanitized_err = str(err_msg).replace(secret, "[REDACTED]") if secret else str(err_msg)
        logger.error(f"GAS Exception for {recipient}: {sanitized_err}")
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq_id,
            rfq_reference=rfq_reference,
            channel=channel,
            recipient=recipient,
            status="failed",
            provider_message_id=None,
            error_summary=sanitized_err,
            created_at=now,
            sent_at=None
        )


def send_quotation_confirmation(
    rfq: QuotationRequest,
    db: Session
) -> Optional[NotificationRecord]:
    """
    Builds and dispatches the automatic customer RFQ confirmation email
    after successful database commit.

    Guarantees:
    - Subject: Your RFQ Has Been Received — HSMLE India
    - Responsive, white background, black typography, subtle grey separators.
    - Explicit customer acknowledgement & summary of requested machines.
    - Strictly uses "HSMLE India" branding (omitting "Corporation").
    - Zero PDF attachments.
    - Any email error is logged and committed without failing the RFQ submission.
    """
    recipient = (rfq.email or "").strip().lower()
    if not recipient:
        return None

    now = datetime.datetime.utcnow()
    channel = "email"

    # 1. Idempotency check: avoid duplicate dispatch if already successfully sent
    existing_record = db.query(NotificationRecord).filter(
        NotificationRecord.rfq_id == rfq.id,
        NotificationRecord.channel == channel,
        NotificationRecord.recipient == recipient
    ).order_by(NotificationRecord.id.desc()).first()

    if existing_record and existing_record.status == "sent":
        logger.info(f"Confirmation email already sent to {recipient} for {rfq.rfq_number}. Skipping duplicate.")
        return existing_record

    # 2. Extract and sanitize variables
    customer_name = (rfq.contact_person or "").strip() or "Valued Client"
    company_name = (rfq.company_name or "").strip()
    display_name = f"{customer_name} ({company_name})" if (customer_name and company_name) else customer_name
    phone_number = (rfq.phone or "").strip() or "Not provided"
    delivery_city = (rfq.delivery_city or "").strip()
    delivery_state = (rfq.delivery_state or "").strip()
    destination = f"{delivery_city}, {delivery_state}".strip(", ") or "Specified on Request"
    submission_date_str = now.strftime("%d %B %Y, %H:%M UTC")

    esc_name = html.escape(customer_name)
    esc_display_name = html.escape(display_name)
    esc_ref = html.escape(rfq.rfq_number)
    esc_date = html.escape(submission_date_str)
    esc_destination = html.escape(destination)

    # 3. Build summary of requested machinery
    items_rows_html = ""
    items_lines_text = []

    for item in (rfq.items or []):
        p_name = item.product_name or "Industrial Equipment"
        m_num = item.model_number or ""
        qty = item.quantity or 1
        custom_notes = item.customization_notes or ""

        esc_pname = html.escape(p_name)
        esc_mnum = html.escape(m_num)
        esc_cnotes = html.escape(custom_notes)

        line_txt = f"  • {p_name}" + (f" [Model: {m_num}]" if m_num else "") + f" - Qty: {qty}"
        if custom_notes:
            line_txt += f"\n    Notes: {custom_notes}"
        items_lines_text.append(line_txt)

        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px 14px; color: #111827; font-size: 13px;">
            <div style="font-weight: 600; color: #111827;">{esc_pname}</div>
            {f'<div style="font-size: 11px; color: #4B5563; margin-top: 2px;">Model: <span style="font-family: monospace;">{esc_mnum}</span></div>' if m_num else ''}
            {f'<div style="font-size: 11px; color: #6B7280; font-style: italic; margin-top: 2px;">Customization: {esc_cnotes}</div>' if custom_notes else ''}
          </td>
          <td style="padding: 12px 14px; text-align: center; font-weight: 600; color: #111827; font-size: 13px; width: 60px;">
            {qty}
          </td>
        </tr>
        """

    items_text_block = "\n".join(items_lines_text) if items_lines_text else "  • Requested Equipment & Testing Systems"

    # 4. Email Subject
    subject = "Your RFQ Has Been Received — HSMLE India"

    # 5. Plaintext Body
    body_text = f"""Hello {display_name},

Thank you for contacting HSMLE India. We have received your Request for Quotation (RFQ).

RFQ Reference Number: {rfq.rfq_number}
Submission Date     : {submission_date_str}
Destination         : {destination}

REQUESTED MACHINERY / EQUIPMENT:
{items_text_block}

Our technical sales team will review your specifications and requirements, and a formal techno-commercial offer will be provided shortly.

If you have supplementary technical drawings or immediate testing requirements, please reply to this email quoting reference {rfq.rfq_number}.

Regards,
HSMLE India
{settings.LEGAL_STATUS}
Direct Helpline : {settings.PRIMARY_PHONE}
Office Landline : {settings.LANDLINE_PHONE}
Sales Email     : {settings.SALES_EMAIL}
Official Portal : {settings.PRIMARY_DOMAIN}
Works & Factory : {settings.FACTORY_ADDRESS}
Registered Office: {settings.OFFICE_ADDRESS}
""".strip()

    # 6. Responsive HTML Body (Clean white background, black typography, subtle grey separators)
    body_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your RFQ Has Been Received — HSMLE India</title>
</head>
<body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FFFFFF; color: #111827; line-height: 1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden;">
    
    <!-- Header -->
    <tr>
      <td style="background-color: #111827; padding: 22px 28px; text-align: left;">
        <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: #FFFFFF;">HSMLE INDIA</div>
        <div style="font-size: 11px; color: #9CA3AF; letter-spacing: 0.5px; margin-top: 4px; text-transform: uppercase;">Industrial Quality Control &amp; Metrology Testing Systems</div>
      </td>
    </tr>

    <!-- Accreditation Bar -->
    <tr>
      <td style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB; padding: 10px 28px; font-size: 11px; color: #4B5563;">
        <span><strong>{settings.LEGAL_STATUS}</strong></span>
        <span style="float: right; color: #6B7280;">GSTIN: {settings.GSTIN}</span>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 28px;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 14px;">
          Hello <strong>{esc_display_name}</strong>,
        </p>

        <p style="font-size: 13px; color: #374151; margin: 0 0 20px; line-height: 1.6;">
          Thank you for contacting <strong>HSMLE India</strong>. We have successfully received your Request for Quotation (RFQ).
        </p>

        <!-- Reference Callout -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-left: 4px solid #111827; border-radius: 4px; margin-bottom: 22px;">
          <tr>
            <td style="padding: 14px 18px;">
              <div style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">RFQ Reference Number</div>
              <div style="font-size: 18px; font-weight: 800; font-family: 'Courier New', Courier, monospace; color: #111827; margin-top: 4px;">{esc_ref}</div>
              <div style="font-size: 11px; color: #6B7280; margin-top: 4px;">
                Submitted on: <strong>{esc_date}</strong> &bull; Destination: <strong>{esc_destination}</strong>
              </div>
            </td>
          </tr>
        </table>

        <!-- Review Statement -->
        <p style="font-size: 13px; color: #374151; margin: 0 0 22px; line-height: 1.6;">
          Our technical sales team will review your requirements and respond with a formal techno-commercial offer.
        </p>

        <!-- Requested Machinery -->
        <div style="font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Requested Machinery / Equipment
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E7EB; border-radius: 4px; margin-bottom: 24px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
              <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #4B5563; text-transform: uppercase;">Equipment / Model</th>
              <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 700; color: #4B5563; text-transform: uppercase; width: 60px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items_rows_html}
          </tbody>
        </table>

        <!-- Next Steps Note -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #4B5563;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">Need to share test drawings or samples?</div>
          You can reply directly to this email or contact our metrology desk with reference <strong>{esc_ref}</strong>.
        </div>

        <!-- Signature -->
        <div style="border-top: 1px solid #E5E7EB; padding-top: 18px; font-size: 12px; color: #4B5563;">
          <div style="font-size: 13px; font-weight: 700; color: #111827;">HSMLE India</div>
          <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">{settings.LEGAL_STATUS} &bull; GSTIN: {settings.GSTIN}</div>

          <table role="presentation" width="100%" cellpadding="2" cellspacing="0" style="margin-top: 10px; font-size: 12px; color: #4B5563;">
            <tr>
              <td width="28%" style="font-weight: 600; color: #111827;">Direct Helpline:</td>
              <td><a href="tel:{settings.PRIMARY_PHONE}" style="color: #111827; text-decoration: none; font-weight: 700;">{settings.PRIMARY_PHONE}</a></td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #111827;">Office Landline:</td>
              <td>{settings.LANDLINE_PHONE}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #111827;">Sales Email:</td>
              <td><a href="mailto:{settings.SALES_EMAIL}" style="color: #111827; text-decoration: underline;">{settings.SALES_EMAIL}</a></td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #111827;">Factory Works:</td>
              <td>{settings.FACTORY_ADDRESS}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #111827;">Registered Office:</td>
              <td>{settings.OFFICE_ADDRESS}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 14px 28px; text-align: center; font-size: 11px; color: #6B7280;">
        <div>&copy; {now.year} HSMLE India. All rights reserved.</div>
        <div style="margin-top: 3px;">
          Official Website: <a href="{settings.PRIMARY_DOMAIN}" style="color: #111827; text-decoration: underline;">{settings.PRIMARY_DOMAIN}</a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()

    # 7. Route dispatch to configured provider
    provider = (settings.EMAIL_PROVIDER or "google_apps_script").lower()

    if provider in ("google_apps_script", "gas", "mailapp"):
        return _dispatch_google_apps_script(
            rfq_id=rfq.id,
            rfq_reference=rfq.rfq_number,
            recipient=recipient,
            customer_name=customer_name,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            db=db,
            now=now,
            idempotency_suffix="cust",
            existing_record=existing_record
        )
    else:
        # Default placeholder/unsupported provider handler
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq.id,
            rfq_reference=rfq.rfq_number,
            channel=channel,
            recipient=recipient,
            status="failed",
            provider_message_id=None,
            error_summary=f"Unsupported EMAIL_PROVIDER '{provider}'. Expected 'google_apps_script'.",
            created_at=now,
            sent_at=None
        )


def send_admin_quotation_alert(
    rfq: QuotationRequest,
    db: Session
) -> Optional[NotificationRecord]:
    """
    Dispatches immediate full-detail RFQ notification alert to HSMLE Official Email
    (RFQ_NOTIFICATION_EMAIL / OFFICIAL_EMAIL / sales@hsmleindia.com).

    Guarantees:
    - Contains full client contact details (Name, Company, Email, Phone, Destination, GSTIN, Sector, Target Date).
    - Contains complete technical requirements & customization notes.
    - Contains complete itemized table of requested machinery & models.
    - Responsive, high-contrast, professional notification card.
    - Any error is captured without impeding the quotation flow.
    """
    official_email = (getattr(settings, "RFQ_NOTIFICATION_EMAIL", None) or getattr(settings, "OFFICIAL_EMAIL", None) or "sales@hsmleindia.com").strip().lower()
    if not official_email:
        return None

    now = datetime.datetime.utcnow()
    channel = "email"

    # Idempotency check for official notification
    existing_record = db.query(NotificationRecord).filter(
        NotificationRecord.rfq_id == rfq.id,
        NotificationRecord.channel == channel,
        NotificationRecord.recipient == official_email
    ).order_by(NotificationRecord.id.desc()).first()

    if existing_record and existing_record.status == "sent":
        logger.info(f"Admin quotation alert already sent to {official_email} for {rfq.rfq_number}. Skipping duplicate.")
        return existing_record

    # Extract all submitted fields
    customer_name = (rfq.contact_person or "").strip() or "Valued Client"
    company_name = (rfq.company_name or "").strip() or "N/A"
    phone_number = (rfq.phone or "").strip() or "Not provided"
    client_email = (rfq.email or "").strip().lower() or "Not provided"
    delivery_city = (rfq.delivery_city or "").strip()
    delivery_state = (rfq.delivery_state or "").strip()
    destination = f"{delivery_city}, {delivery_state}".strip(", ") or "Specified on Request"
    gst_number = (rfq.gst_number or "").strip() or "Not provided"
    industry_sector = (rfq.industry_sector or "").strip() or "General Manufacturing"
    target_delivery = (rfq.target_delivery_date or "").strip() or "Immediate / Earliest"
    requirements_notes = (rfq.requirements_notes or "").strip() or "No additional notes provided"
    submission_date_str = now.strftime("%d %B %Y, %H:%M UTC")

    esc_name = html.escape(customer_name)
    esc_company = html.escape(company_name)
    esc_phone = html.escape(phone_number)
    esc_email = html.escape(client_email)
    esc_dest = html.escape(destination)
    esc_gst = html.escape(gst_number)
    esc_sector = html.escape(industry_sector)
    esc_target = html.escape(target_delivery)
    esc_notes = html.escape(requirements_notes)
    esc_ref = html.escape(rfq.rfq_number)
    esc_date = html.escape(submission_date_str)

    # Build items tables
    items_rows_html = ""
    items_lines_text = []

    for item in (rfq.items or []):
        p_name = item.product_name or "Industrial Equipment"
        m_num = item.model_number or ""
        qty = item.quantity or 1
        c_notes = item.customization_notes or ""

        esc_pname = html.escape(p_name)
        esc_mnum = html.escape(m_num)
        esc_cnotes = html.escape(c_notes)

        line_txt = f"  • {p_name}" + (f" [Model: {m_num}]" if m_num else "") + f" - Qty: {qty}"
        if c_notes:
            line_txt += f"\n    Notes: {c_notes}"
        items_lines_text.append(line_txt)

        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 10px 12px; color: #111827; font-size: 13px;">
            <div style="font-weight: 700; color: #111827;">{esc_pname}</div>
            {f'<div style="font-size: 11px; color: #374151; margin-top: 2px;">Model: <span style="font-family: monospace; font-weight: 600;">{esc_mnum}</span></div>' if m_num else ''}
            {f'<div style="font-size: 11px; color: #6B7280; font-style: italic; margin-top: 2px;">Customization: {esc_cnotes}</div>' if c_notes else ''}
          </td>
          <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: #111827; font-size: 13px; width: 60px;">
            {qty}
          </td>
        </tr>
        """

    items_text_block = "\n".join(items_lines_text) if items_lines_text else "  • Requested Equipment & Testing Systems"

    # Email Subject
    subject = f"🚨 [NEW RFQ LEAD] {rfq.rfq_number} — {company_name} ({customer_name})"

    # Plaintext Body
    body_text = f"""HSMLE INDIA — NEW RFQ LEAD NOTIFICATION
Reference: {rfq.rfq_number}
Submitted: {submission_date_str}

============================================================
CLIENT & CONTACT DETAILS
============================================================
Company Name       : {company_name}
Contact Person     : {customer_name}
Direct Phone       : {phone_number}
Corporate Email    : {client_email}
Delivery City/State: {destination}
GSTIN Number       : {gst_number}
Industry Sector    : {industry_sector}
Target Delivery    : {target_delivery}

SPECIAL TECHNICAL NOTES / CUSTOMIZATION:
{requirements_notes}

============================================================
REQUESTED MACHINERY ({len(rfq.items or [])} Items)
============================================================
{items_text_block}

============================================================
ADMIN ACTION
============================================================
Review and respond to this RFQ in the Staff Portal:
{settings.PRIMARY_DOMAIN}admin/quotations.html

Client IP: {rfq.ip_address or 'Unknown'}
""".strip()

    # High-Priority Responsive HTML Body
    body_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New RFQ Notification — HSMLE India</title>
</head>
<body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3F4F6; color: #111827; line-height: 1.5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #111827; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <tr>
      <td style="background-color: #111827; padding: 20px 24px; color: #FFFFFF;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size: 11px; font-weight: 800; color: #F59E0B; text-transform: uppercase; letter-spacing: 1px;">🚨 NEW COMMERCIAL INQUIRY</div>
              <div style="font-size: 18px; font-weight: 800; color: #FFFFFF; margin-top: 4px;">HSMLE INDIA &bull; RFQ NOTIFICATION</div>
            </td>
            <td style="text-align: right;">
              <span style="background-color: #DC2626; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 4px; font-family: monospace;">{esc_ref}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Summary Banner -->
    <tr>
      <td style="background-color: #FEF3C7; border-bottom: 2px solid #F59E0B; padding: 12px 24px; font-size: 12px; color: #92400E;">
        <strong>New Lead Received:</strong> Client requested quotation for <strong>{len(rfq.items or [])} testing instrument(s)</strong> on {esc_date}.
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 24px;">

        <!-- Client Contact Details Box -->
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #111827; margin-bottom: 8px;">
          1. Client &amp; Procurement Details
        </div>
        <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; margin-bottom: 20px; font-size: 12px;">
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td width="30%" style="font-weight: 700; color: #4B5563;">Company Name:</td>
            <td style="font-weight: 800; color: #111827; font-size: 13px;">{esc_company}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="font-weight: 700; color: #4B5563;">Contact Person:</td>
            <td style="font-weight: 700; color: #111827;">{esc_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="font-weight: 700; color: #4B5563;">Phone / Mobile:</td>
            <td><a href="tel:{esc_phone}" style="color: #2563EB; font-weight: 800; text-decoration: none; font-size: 13px;">{esc_phone}</a> &nbsp;<span style="color: #6B7280; font-size: 11px;">(Click to call)</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="font-weight: 700; color: #4B5563;">Corporate Email:</td>
            <td><a href="mailto:{esc_email}" style="color: #2563EB; font-weight: 700; text-decoration: underline;">{esc_email}</a> &nbsp;<span style="color: #6B7280; font-size: 11px;">(Click to reply)</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="font-weight: 700; color: #4B5563;">Delivery Destination:</td>
            <td style="color: #111827; font-weight: 600;">{esc_dest}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="font-weight: 700; color: #4B5563;">GSTIN (Tax ID):</td>
            <td style="font-family: monospace; font-weight: 700; color: #111827;">{esc_gst}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="font-weight: 700; color: #4B5563;">Industry Sector:</td>
            <td style="color: #111827;">{esc_sector}</td>
          </tr>
          <tr>
            <td style="font-weight: 700; color: #4B5563;">Target Delivery Date:</td>
            <td style="color: #111827; font-weight: 600;">{esc_target}</td>
          </tr>
        </table>

        <!-- Specific Requirements Box -->
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #111827; margin-bottom: 8px;">
          2. Specific Technical Notes &amp; Customization
        </div>
        <div style="background-color: #F9FAFB; border-left: 4px solid #2563EB; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #374151; white-space: pre-wrap;">
          {esc_notes}
        </div>

        <!-- Requested Machinery Table -->
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #111827; margin-bottom: 8px;">
          3. Requested Machinery &amp; Testing Instruments ({len(rfq.items or [])})
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E7EB; border-radius: 4px; overflow: hidden; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #F3F4F6; border-bottom: 1px solid #E5E7EB; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #4B5563;">
              <th style="padding: 10px 12px; text-align: left;">Instrument &amp; Model</th>
              <th style="padding: 10px 12px; text-align: center; width: 60px;">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items_rows_html}
          </tbody>
        </table>

        <!-- Action Links -->
        <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 16px; text-align: center;">
          <div style="font-size: 13px; font-weight: 800; color: #1E40AF; margin-bottom: 10px;">DIRECT ACTIONS FOR SALES DESK</div>
          <a href="mailto:{esc_email}?subject=Re:%20Quotation%20Proposal%20-%20HSMLE%20India%20({esc_ref})&body=Dear%20{esc_name},%0D%0A%0D%0AThank%20you%20for%20your%20inquiry%20{esc_ref}.%20Please%20find%20our%20official%20quotation%20attached.%0D%0A%0D%0ARegards,%0D%0AHSMLE%20India" style="display: inline-block; background-color: #2563EB; color: #FFFFFF; font-size: 12px; font-weight: 800; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin-right: 8px;">
            Reply to Client Email
          </a>
          <a href="{settings.PRIMARY_DOMAIN}admin/quotations.html" style="display: inline-block; background-color: #111827; color: #FFFFFF; font-size: 12px; font-weight: 800; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
            Open Staff Quotations Portal
          </a>
        </div>

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 12px 24px; text-align: center; font-size: 11px; color: #6B7280;">
        HSMLE India Corporation &bull; Automated Internal Lead Dispatch System &bull; Client IP: {rfq.ip_address or 'Unknown'}
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()

    provider = (settings.EMAIL_PROVIDER or "google_apps_script").lower()

    if provider in ("google_apps_script", "gas", "mailapp"):
        return _dispatch_google_apps_script(
            rfq_id=rfq.id,
            rfq_reference=rfq.rfq_number,
            recipient=official_email,
            customer_name="HSMLE Sales Team",
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            db=db,
            now=now,
            idempotency_suffix="admin-alert",
            existing_record=existing_record
        )
    else:
        return _record_email_result(
            db=db,
            existing_record=existing_record,
            rfq_id=rfq.id,
            rfq_reference=rfq.rfq_number,
            channel=channel,
            recipient=official_email,
            status="failed",
            provider_message_id=None,
            error_summary=f"Unsupported EMAIL_PROVIDER '{provider}'.",
            created_at=now,
            sent_at=None
        )

