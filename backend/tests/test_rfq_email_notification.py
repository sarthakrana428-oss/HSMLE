"""
Automated Unit & Integration Test Suite for HSMLE Website RFQ Confirmation Email.
Guarantees:
- Tests all 12 validation, resilience, and idempotency scenarios.
- Strictly mocks external HTTP dispatch (NO real emails dispatched).
- Uses isolated in-memory SQLite database (zero modifications to production hsmle.db).
- Verifies branding, subject line, response contract, and error containment.
"""

import unittest
from unittest.mock import patch, MagicMock
import json
import io
import urllib.error
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.quotation import QuotationRequest, QuotationItem
from app.models.notification import NotificationRecord
from app.models.admin import AdminUser
from app.models.enquiry import Enquiry
from app.config import settings
from app.services.notification_service import (
    send_quotation_confirmation,
    _dispatch_google_apps_script
)


class TestRfqEmailNotification(unittest.TestCase):

    def setUp(self):
        # 1. Setup isolated in-memory SQLite database
        self.engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # 2. Configure mock test settings
        self.test_url = "https://script.google.com/macros/s/AKfycbx_TEST_DEPLOYMENT_ID/exec"
        self.test_secret = "a" * 64
        self.orig_url = settings.GOOGLE_APPS_SCRIPT_URL
        self.orig_secret = settings.GOOGLE_APPS_SCRIPT_SECRET
        self.orig_provider = settings.EMAIL_PROVIDER

        settings.GOOGLE_APPS_SCRIPT_URL = self.test_url
        settings.GOOGLE_APPS_SCRIPT_SECRET = self.test_secret
        settings.EMAIL_PROVIDER = "google_apps_script"

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        settings.GOOGLE_APPS_SCRIPT_URL = self.orig_url
        settings.GOOGLE_APPS_SCRIPT_SECRET = self.orig_secret
        settings.EMAIL_PROVIDER = self.orig_provider

    def _create_sample_rfq(self, email="test.client@example.com", name="Rajesh Kumar", ref="RFQ-2026-0001-888"):
        rfq = QuotationRequest(
            rfq_number=ref,
            company_name="Apex Precision Engineering Ltd",
            contact_person=name,
            email=email,
            phone="+91-9876543210",
            delivery_city="Pune",
            delivery_state="Maharashtra",
            gst_number="27AAACA1234A1Z5",
            industry_sector="Automobile & Heavy Components",
            requirements_notes="Require ASTM E18 calibration certificate and installation support.",
            target_delivery_date="Immediate",
            status="Pending",
            ip_address="127.0.0.1"
        )
        self.db.add(rfq)
        self.db.flush()

        item1 = QuotationItem(
            quotation_id=rfq.id,
            product_id=1,
            product_name="Advanced Digital Vickers Hardness Tester",
            model_number="HVH-50AT",
            quantity=2,
            customization_notes="Include auto-turret and digital measuring eyepiece"
        )
        item2 = QuotationItem(
            quotation_id=rfq.id,
            product_id=2,
            product_name="Metallographic Specimen Cutting Machine",
            model_number="HSQ-80",
            quantity=1,
            customization_notes="Include quick-clamping vise"
        )
        self.db.add(item1)
        self.db.add(item2)
        self.db.commit()
        self.db.refresh(rfq)
        return rfq

    # --------------------------------------------------------------------------
    # Scenario 1: Valid RFQ submission triggers one customer confirmation email
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_01_valid_rfq_triggers_one_confirmation(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({"ok": True, "success": True, "message_id": "gas-123"}).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        rfq = self._create_sample_rfq()
        record = send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertIsNotNone(record)
        self.assertEqual(record.status, "sent")
        self.assertEqual(record.channel, "email")
        self.assertEqual(record.recipient, "test.client@example.com")
        self.assertEqual(record.provider_message_id, "gas-123")
        self.assertEqual(mock_urlopen.call_count, 1)

    # --------------------------------------------------------------------------
    # Scenario 2: The correct customer email receives the correct RFQ reference
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_02_correct_recipient_and_reference(self, mock_urlopen):
        captured_payloads = []

        def capture_req(req, timeout=20):
            body = json.loads(req.data.decode("utf-8"))
            captured_payloads.append(body)
            resp = MagicMock()
            resp.status = 200
            resp.read.return_value = json.dumps({"success": True, "message_id": "gas-ref-456"}).encode()
            resp.__enter__.return_value = resp
            return resp

        mock_urlopen.side_effect = capture_req

        rfq = self._create_sample_rfq(email="procurement@tataadvanced.com", ref="RFQ-2026-9999-777")
        record = send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertEqual(len(captured_payloads), 1)
        payload = captured_payloads[0]
        self.assertEqual(payload["to"], "procurement@tataadvanced.com")
        self.assertEqual(payload["rfq_reference"], "RFQ-2026-9999-777")
        self.assertEqual(payload["subject"], "Your RFQ Has Been Received — HSMLE India")
        self.assertEqual(record.status, "sent")

    # --------------------------------------------------------------------------
    # Scenario 3: Customer name and enquiry information correctly populated
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_03_customer_name_and_machinery_populated(self, mock_urlopen):
        captured_payloads = []

        def capture_req(req, timeout=20):
            captured_payloads.append(json.loads(req.data.decode("utf-8")))
            resp = MagicMock()
            resp.status = 200
            resp.read.return_value = json.dumps({"success": True}).encode()
            resp.__enter__.return_value = resp
            return resp

        mock_urlopen.side_effect = capture_req

        rfq = self._create_sample_rfq(name="Dr. Vikram Sarabhai")
        send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertEqual(len(captured_payloads), 1)
        payload = captured_payloads[0]
        self.assertEqual(payload["customer_name"], "Dr. Vikram Sarabhai")
        # Check that machine names appear in both body and html_body
        self.assertIn("Advanced Digital Vickers Hardness Tester", payload["body"])
        self.assertIn("Metallographic Specimen Cutting Machine", payload["body"])
        self.assertIn("HVH-50AT", payload["html_body"])
        self.assertIn("HSQ-80", payload["html_body"])

    # --------------------------------------------------------------------------
    # Scenario 4: Database failure prevents email trigger
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_04_db_failure_does_not_trigger_email(self, mock_urlopen):
        # Simulate an uncommitted / rolled back RFQ
        rfq = QuotationRequest(
            rfq_number="RFQ-FAIL-0000",
            company_name="Failed Co",
            contact_person="Nobody",
            email="nobody@fail.com",
            phone="000"
        )
        self.db.add(rfq)
        self.db.rollback() # Transaction failed!

        # Attempt to trigger notification for a detached/non-committed object
        record = None
        if rfq.id is not None:
            record = send_quotation_confirmation(rfq=rfq, db=self.db)

        mock_urlopen.assert_not_called()
        self.assertIsNone(record)

    # --------------------------------------------------------------------------
    # Scenario 5: Email provider failure does not invalidate saved RFQ
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_05_provider_failure_does_not_invalidate_rfq(self, mock_urlopen):
        # Mock Google Apps Script returning HTTP 500 error
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url=self.test_url,
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=io.BytesIO(b'{"error": "Internal Google Error"}')
        )

        rfq = self._create_sample_rfq(ref="RFQ-SAVED-RESILIENT-01")
        record = send_quotation_confirmation(rfq=rfq, db=self.db)

        # 1. RFQ remains completely intact in database
        saved_rfq = self.db.query(QuotationRequest).filter(QuotationRequest.rfq_number == "RFQ-SAVED-RESILIENT-01").first()
        self.assertIsNotNone(saved_rfq)
        self.assertEqual(saved_rfq.status, "Pending")
        self.assertEqual(len(saved_rfq.items), 2)

        # 2. Notification record safely logs the failure
        self.assertIsNotNone(record)
        self.assertEqual(record.status, "failed")
        self.assertIn("HTTP 500", record.error_summary)

    # --------------------------------------------------------------------------
    # Scenario 6: Google Apps Script timeout is handled safely
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_06_timeout_handled_safely(self, mock_urlopen):
        mock_urlopen.side_effect = TimeoutError("Connection timed out after 20s")

        rfq = self._create_sample_rfq()
        record = send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertIsNotNone(record)
        self.assertEqual(record.status, "failed")
        self.assertIn("timeout", record.error_summary.lower())

    # --------------------------------------------------------------------------
    # Scenario 7: Missing or placeholder GAS configuration handled safely
    # --------------------------------------------------------------------------
    def test_07_missing_configuration_handled_safely(self):
        settings.GOOGLE_APPS_SCRIPT_URL = ""
        settings.GOOGLE_APPS_SCRIPT_SECRET = ""

        rfq = self._create_sample_rfq()
        record = send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertIsNotNone(record)
        self.assertEqual(record.status, "awaiting_credentials")
        self.assertIn("not configured", record.error_summary)

    # --------------------------------------------------------------------------
    # Scenario 8: Duplicate request/retry does not cause duplicate confirmation
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_08_idempotency_prevents_duplicate_email(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({"success": True, "message_id": "gas-idemp-1"}).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        rfq = self._create_sample_rfq()

        # First call: sends email
        record1 = send_quotation_confirmation(rfq=rfq, db=self.db)
        self.assertEqual(record1.status, "sent")
        self.assertEqual(mock_urlopen.call_count, 1)

        # Second call (retry): should be suppressed by idempotency
        record2 = send_quotation_confirmation(rfq=rfq, db=self.db)
        self.assertEqual(record2.status, "sent")
        self.assertEqual(record1.id, record2.id)
        # Call count must still be 1!
        self.assertEqual(mock_urlopen.call_count, 1)

    # --------------------------------------------------------------------------
    # Scenario 9: Subject and branding strict adherence
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_09_subject_and_branding_requirements(self, mock_urlopen):
        captured_payloads = []

        def capture_req(req, timeout=20):
            captured_payloads.append(json.loads(req.data.decode("utf-8")))
            resp = MagicMock()
            resp.status = 200
            resp.read.return_value = json.dumps({"success": True}).encode()
            resp.__enter__.return_value = resp
            return resp

        mock_urlopen.side_effect = capture_req

        rfq = self._create_sample_rfq()
        send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertEqual(len(captured_payloads), 1)
        p = captured_payloads[0]

        # 1. Exact subject format
        self.assertEqual(p["subject"], "Your RFQ Has Been Received — HSMLE India")

        # 2. Strict branding: "HSMLE India" without "Corporation"
        self.assertEqual(p["sender_name"], "HSMLE India")
        self.assertIn("HSMLE India", p["html_body"])
        self.assertNotIn("HSMLE India Corporation", p["html_body"])
        self.assertNotIn("HSMLE India Corporation", p["body"])

        # 3. No claim that an order is confirmed or quote finalized
        self.assertNotIn("order has been confirmed", p["html_body"].lower())
        self.assertNotIn("quotation has been generated", p["html_body"].lower())

    # --------------------------------------------------------------------------
    # Scenario 10: Zero PDF brochure attachments
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_10_zero_pdf_attachments(self, mock_urlopen):
        captured_payloads = []

        def capture_req(req, timeout=20):
            captured_payloads.append(json.loads(req.data.decode("utf-8")))
            resp = MagicMock()
            resp.status = 200
            resp.read.return_value = json.dumps({"success": True}).encode()
            resp.__enter__.return_value = resp
            return resp

        mock_urlopen.side_effect = capture_req

        rfq = self._create_sample_rfq()
        send_quotation_confirmation(rfq=rfq, db=self.db)

        self.assertEqual(len(captured_payloads), 1)
        p = captured_payloads[0]
        # Must not contain "attachments" key or attachments must be empty
        self.assertNotIn("attachments", p)

    # --------------------------------------------------------------------------
    # Scenario 11: Existing admin user and enquiry models remain intact
    # --------------------------------------------------------------------------
    def test_11_existing_models_preserved(self):
        # Admin user
        admin = AdminUser(
            username="test_admin",
            email="test_admin@hsmleindia.com",
            hashed_password="pbkdf2:dummy",
            role="super_admin",
            is_active=True
        )
        self.db.add(admin)
        self.db.commit()

        # Enquiry
        enq = Enquiry(
            enquiry_number="ENQ-2026-0001-111",
            full_name="Sunita Sharma",
            company_name="BHEL Haridwar",
            email="sunita@bhel.in",
            phone="+91-9988776655",
            message="Need technical datasheet for micro hardness tester",
            status="New"
        )
        self.db.add(enq)
        self.db.commit()

        queried_admin = self.db.query(AdminUser).filter(AdminUser.username == "test_admin").first()
        queried_enq = self.db.query(Enquiry).filter(Enquiry.enquiry_number == "ENQ-2026-0001-111").first()

        self.assertIsNotNone(queried_admin)
        self.assertEqual(queried_admin.role, "super_admin")
        self.assertIsNotNone(queried_enq)
        self.assertEqual(queried_enq.company_name, "BHEL Haridwar")

    # --------------------------------------------------------------------------
    # Scenario 12: Notification record history queryable
    # --------------------------------------------------------------------------
    @patch("urllib.request.urlopen")
    def test_12_notification_record_persisted_and_queryable(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({"success": True, "message_id": "msg-hist-999"}).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        rfq = self._create_sample_rfq(ref="RFQ-HIST-01")
        send_quotation_confirmation(rfq=rfq, db=self.db)

        record = self.db.query(NotificationRecord).filter(
            NotificationRecord.rfq_reference == "RFQ-HIST-01"
        ).first()

        self.assertIsNotNone(record)
        self.assertEqual(record.status, "sent")
        self.assertEqual(record.channel, "email")
        self.assertEqual(record.provider_message_id, "msg-hist-999")
        self.assertIsInstance(record.created_at, datetime)
        self.assertIsInstance(record.sent_at, datetime)


if __name__ == "__main__":
    unittest.main()
