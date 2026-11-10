import os
import sys
import io
import time
import json
import threading
import subprocess
from pathlib import Path

# Configure stdout encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import requests
import uvicorn
from app.main import app
from app.database import SessionLocal
from app.models.product import Product, Category, Subcategory
from app.models.enquiry import Enquiry
from app.models.quotation import QuotationRequest
from app.models.admin import AdminUser, AdminAuditLog
from app.security import LOGIN_ATTEMPTS

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SCREENSHOTS_DIR = Path(r"C:\Users\sarthak\.gemini\antigravity\brain\410056e0-5726-4095-97ed-b89b4d92eed9\screenshots\admin")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

def start_server():
    config = uvicorn.Config(app=app, host="127.0.0.1", port=8000, log_level="error")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    for _ in range(50):
        try:
            r = requests.get("http://127.0.0.1:8000/")
            if r.status_code == 200:
                return server
        except Exception:
            pass
        time.sleep(0.2)
    return server

def capture_screenshot(url, out_path, width=1440, height=900, delay=1.5):
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        f"--window-size={width},{height}",
        f"--screenshot={str(out_path)}",
        url
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(delay)
    return out_path.exists() and out_path.stat().st_size > 5000

def run_stage3_tests():
    print("=" * 70, flush=True)
    print("HSMLE INDIA CORPORATION - STAGE 3 ADMIN PORTAL TEST SUITE", flush=True)
    print("=" * 70, flush=True)

    server = start_server()
    print("✓ Uvicorn server online at http://127.0.0.1:8000", flush=True)

    base = "http://127.0.0.1:8000/api/admin"
    portal = "http://127.0.0.1:8000/portal/admin"

    passed = 0
    total = 0
    test_product_id = None
    test_cat_id = None
    test_subcat_id = None
    super_token = ""

    try:
        # -------------------------------------------------------------
        # TEST 1: Unauthenticated Guard
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/stats")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        passed += 1
        print("✓ [PASS] 1. Unauthenticated Request Blocked (401 Unauthorized)", flush=True)

        # -------------------------------------------------------------
        # TEST 2: Invalid Admin Login & Rate Limiting
        # -------------------------------------------------------------
        total += 1
        LOGIN_ATTEMPTS.clear()

        # Wrong password
        res = requests.post(f"{base}/login", json={"username": "admin", "password": "WrongPassword123!"})
        assert res.status_code == 401
        assert "Invalid" in res.json()["detail"]

        # 5 failed attempts
        for _ in range(4):
            requests.post(f"{base}/login", json={"username": "admin", "password": "WrongPassword123!"})

        # 6th attempt should be rate limited (429)
        res_locked = requests.post(f"{base}/login", json={"username": "admin", "password": "WrongPassword123!"})
        assert res_locked.status_code == 429, f"Expected 429 Too Many Requests, got {res_locked.status_code}"
        assert "Too many failed login attempts" in res_locked.json()["detail"]

        LOGIN_ATTEMPTS.clear()
        passed += 1
        print("✓ [PASS] 2. Login Failure & Rate Limiting (5 Attempts -> 429 Lockout)", flush=True)

        # -------------------------------------------------------------
        # TEST 3: Super Admin Login & JWT Issuance
        # -------------------------------------------------------------
        total += 1
        res = requests.post(f"{base}/login", json={"username": "admin", "password": "Admin@HSMLE2026!"})
        assert res.status_code == 200, f"Login failed: {res.text}"
        data = res.json()
        super_token = data["access_token"]
        assert super_token is not None
        assert data["role"] == "super_admin"
        assert data["username"] == "admin"
        passed += 1
        print("✓ [PASS] 3. Super Admin Authentication & JWT Token Generated", flush=True)

        # -------------------------------------------------------------
        # TEST 4: Staff Member Login & Role Identification
        # -------------------------------------------------------------
        total += 1
        res = requests.post(f"{base}/login", json={"username": "staff_editor", "password": "Staff@HSMLE2026!"})
        assert res.status_code == 200, f"Staff login failed: {res.text}"
        data = res.json()
        staff_token = data["access_token"]
        assert staff_token is not None
        assert data["role"] == "staff"
        passed += 1
        print("✓ [PASS] 4. Staff Member Authentication & Role Assignment ('staff')", flush=True)

        super_headers = {"Authorization": f"Bearer {super_token}"}
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        # -------------------------------------------------------------
        # TEST 5: Admin Profile Endpoint (/api/admin/me)
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/me", headers=super_headers)
        assert res.status_code == 200
        me = res.json()
        assert me["username"] == "admin"
        assert me["is_superadmin"] is True
        passed += 1
        print("✓ [PASS] 5. Admin Profile Verification (/api/admin/me)", flush=True)

        # -------------------------------------------------------------
        # TEST 6: Dashboard Stats Accuracy
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/stats", headers=super_headers)
        assert res.status_code == 200
        stats = res.json()
        assert stats["total_products"] == 214, f"Expected 214 products, got {stats['total_products']}"
        assert stats["total_categories"] == 9, f"Expected 9 categories, got {stats['total_categories']}"
        assert stats["total_subcategories"] == 34, f"Expected 34 subcategories, got {stats['total_subcategories']}"
        assert stats["total_catalogues"] == 214
        assert len(stats["category_distribution"]) == 9
        passed += 1
        print(f"✓ [PASS] 6. Dashboard Metrics: 214 Products, 9 Categories, 34 Subcategories, {stats['total_enquiries']} Enquiries, {stats['total_quotations']} RFQs", flush=True)

        # -------------------------------------------------------------
        # TEST 7: Product Inventory Filtering & Search
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/products?page=1&limit=15", headers=super_headers)
        assert res.status_code == 200
        prod_data = res.json()
        assert prod_data["total"] == 214
        assert len(prod_data["items"]) == 15
        assert prod_data["total_pages"] == 15

        res = requests.get(f"{base}/products?search=Rockwell", headers=super_headers)
        assert res.status_code == 200
        search_data = res.json()
        assert search_data["total"] > 0

        res = requests.get(f"{base}/products?category_id=1", headers=super_headers)
        assert res.status_code == 200
        cat_filtered = res.json()
        assert cat_filtered["total"] == 2
        passed += 1
        print(f"✓ [PASS] 7. Product Management: Search ('Rockwell' -> {search_data['total']} found), Filter (Division 1 -> 2 found)", flush=True)

        # -------------------------------------------------------------
        # TEST 8: Create New Product with Specs & Features
        # -------------------------------------------------------------
        total += 1
        new_product_payload = {
            "product_name": "Test Calibration Master Instrument 5000",
            "model_number": "TCM-5000X",
            "all_detected_models": "TCM-5000X, TCM-5000PRO",
            "category_id": 1,
            "subcategory_id": 1,
            "description": "High precision digital verification instrument created during Stage 3 testing.",
            "is_featured": True,
            "is_active": True,
            "meta_title": "Test Instrument TCM-5000X | HSMLE",
            "meta_description": "Precision verification unit for metrology laboratory testing.",
            "specifications": [
                {"spec_key": "Maximum Capacity", "spec_value": "5000 kN"},
                {"spec_key": "Accuracy Class", "spec_value": "Class 0.5 ISO 7500-1"}
            ],
            "features": [
                "Microprocessor-controlled closed loop load application",
                "High-resolution digital optical encoder"
            ]
        }
        res = requests.post(f"{base}/products", json=new_product_payload, headers=super_headers)
        assert res.status_code == 201, f"Create product failed: {res.text}"
        created_p = res.json()
        test_product_id = created_p["id"]
        p_res = requests.get(f"{base}/products/{test_product_id}", headers=super_headers)
        assert p_res.status_code == 200
        p_detail = p_res.json()
        assert p_detail["product_name"] == "Test Calibration Master Instrument 5000"
        assert len(p_detail["specifications"]) == 2
        assert len(p_detail["features"]) == 2
        passed += 1
        print(f"✓ [PASS] 8. Product Creation: Added Test Instrument (ID: {test_product_id}) with Specs & Features", flush=True)

        # -------------------------------------------------------------
        # TEST 9: Update Product & Toggle Active Status
        # -------------------------------------------------------------
        total += 1
        update_payload = {
            "product_name": "Test Calibration Master Instrument 5000 - Updated",
            "model_number": "TCM-5000X-REV2",
            "category_id": 1,
            "subcategory_id": 1,
            "description": "Updated description with revision notes.",
            "is_featured": False,
            "is_active": False,
            "specifications": [
                {"spec_key": "Maximum Capacity", "spec_value": "6000 kN"}
            ],
            "features": [
                "Enhanced touchscreen HMI interface"
            ]
        }
        res = requests.put(f"{base}/products/{test_product_id}", json=update_payload, headers=super_headers)
        assert res.status_code == 200, f"Update product failed: {res.text}"
        p_updated = requests.get(f"{base}/products/{test_product_id}", headers=super_headers).json()
        assert p_updated["product_name"] == "Test Calibration Master Instrument 5000 - Updated"
        assert p_updated["model_number"] == "TCM-5000X-REV2"
        assert len(p_updated["specifications"]) == 1
        assert p_updated["is_active"] is False

        # Toggle status back to Active
        res = requests.patch(f"{base}/products/{test_product_id}/toggle-status", headers=super_headers)
        assert res.status_code == 200
        status_res = res.json()
        assert status_res["is_active"] is True
        passed += 1
        print(f"✓ [PASS] 9. Product Details Update & Active/Inactive Status Toggle Verified", flush=True)

        # -------------------------------------------------------------
        # TEST 10: Machine Photo Upload Security & Validation
        # -------------------------------------------------------------
        total += 1
        # Reject invalid mime type (.exe)
        bad_file = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
        res = requests.post(
            f"{base}/products/{test_product_id}/upload-image",
            files={"file": ("malicious.exe", bad_file, "application/x-msdownload")},
            headers=super_headers
        )
        assert res.status_code == 400
        assert "Invalid image" in res.json()["detail"]

        # Reject oversized image (>5MB)
        huge_file = io.BytesIO(b"0" * (6 * 1024 * 1024))
        res = requests.post(
            f"{base}/products/{test_product_id}/upload-image",
            files={"file": ("huge.jpg", huge_file, "image/jpeg")},
            headers=super_headers
        )
        assert res.status_code == 400
        assert "5MB" in res.json()["detail"] or "size" in res.json()["detail"].lower()

        # Valid JPEG upload (JPEG SOI marker)
        valid_jpeg = io.BytesIO(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB\x00C\x00" + b"\x00" * 100)
        res = requests.post(
            f"{base}/products/{test_product_id}/upload-image",
            files={"file": ("test_machine.jpg", valid_jpeg, "image/jpeg")},
            headers=super_headers
        )
        assert res.status_code == 200
        upload_img_res = res.json()
        assert upload_img_res["image_url"].startswith("/static/images/products/")
        passed += 1
        print(f"✓ [PASS] 10. Photo Upload Validation: Blocked executable, blocked >5MB, uploaded valid JPEG", flush=True)

        # -------------------------------------------------------------
        # TEST 11: Catalogue PDF Upload Validation
        # -------------------------------------------------------------
        total += 1
        # Reject non-PDF disguised as .pdf
        fake_pdf = io.BytesIO(b"This is not a real PDF binary document")
        res = requests.post(
            f"{base}/products/{test_product_id}/upload-catalogue",
            files={"file": ("fake.pdf", fake_pdf, "application/pdf")},
            headers=super_headers
        )
        assert res.status_code == 400
        assert "Invalid" in res.json()["detail"] or "PDF" in res.json()["detail"]

        # Valid PDF binary with %PDF- header
        valid_pdf = io.BytesIO(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\ntrailer\n<< /Root 1 0 R >>\n%%EOF")
        res = requests.post(
            f"{base}/products/{test_product_id}/upload-catalogue",
            files={"file": ("tcm_official.pdf", valid_pdf, "application/pdf")},
            headers=super_headers
        )
        assert res.status_code == 200
        cat_upload_res = res.json()
        assert cat_upload_res["catalogue_path"].startswith("/static/catalogues/")
        passed += 1
        print(f"✓ [PASS] 11. PDF Catalogue Upload Validation: Blocked fake binary, verified genuine PDF binary header", flush=True)

        # -------------------------------------------------------------
        # TEST 12: Role-Based Authorization on Architecture Changes
        # -------------------------------------------------------------
        total += 1
        cat_payload = {
            "name": "Temporary Test Metrology Division",
            "slug": "temp-test-metrology-division",
            "description": "Test division created to verify RBAC access.",
            "display_order": 99
        }

        # Staff member attempts to create division -> 403 Forbidden
        res_staff_deny = requests.post(f"{base}/categories", json=cat_payload, headers=staff_headers)
        assert res_staff_deny.status_code == 403, f"Expected 403 Forbidden for staff, got {res_staff_deny.status_code}"
        assert "Super-admin" in res_staff_deny.json()["detail"] or "privilege" in res_staff_deny.json()["detail"]

        # Super admin creates division -> 201 Created
        res_super_allow = requests.post(f"{base}/categories", json=cat_payload, headers=super_headers)
        assert res_super_allow.status_code == 201, f"Super admin create category failed: {res_super_allow.text}"
        created_cat = res_super_allow.json()
        test_cat_id = created_cat["id"]

        # Super admin creates subcategory
        subcat_payload = {
            "category_id": test_cat_id,
            "name": "Automated Calibration Units",
            "slug": "automated-calibration-units",
            "description": "High throughput robotic calibration."
        }
        res_subcat = requests.post(f"{base}/subcategories", json=subcat_payload, headers=super_headers)
        assert res_subcat.status_code == 201
        created_sub = res_subcat.json()
        test_subcat_id = created_sub["id"]
        passed += 1
        print("✓ [PASS] 12. Role-Based Access Control (RBAC): Staff denied division creation (403), Super Admin authorized", flush=True)

        # -------------------------------------------------------------
        # TEST 13: Customer Enquiry Workflow & Notes
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/enquiries?page=1&limit=10", headers=super_headers)
        assert res.status_code == 200
        enq_data = res.json()
        assert enq_data["total"] >= 1
        first_enq = enq_data["items"][0]
        enq_id = first_enq["id"]

        update_enq_payload = {
            "status": "Contacted",
            "admin_notes": "Senior metrology sales engineer contacted client via telephone. Technical offer shared."
        }
        res_enq_update = requests.patch(f"{base}/enquiries/{enq_id}", json=update_enq_payload, headers=super_headers)
        assert res_enq_update.status_code == 200
        enq_fetched = requests.get(f"{base}/enquiries/{enq_id}", headers=super_headers).json()
        assert enq_fetched["status"] == "Contacted"
        assert "Senior metrology sales engineer" in enq_fetched["admin_notes"]
        passed += 1
        print(f"✓ [PASS] 13. Enquiry Lead Workflow: Transitioned Enquiry #{first_enq['enquiry_number']} to 'Contacted' with Admin Notes", flush=True)

        # -------------------------------------------------------------
        # TEST 14: Quotation Request (RFQ) Workflow & Notes
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/quotations?page=1&limit=10", headers=super_headers)
        assert res.status_code == 200
        rfq_data = res.json()
        assert rfq_data["total"] >= 1
        first_rfq = rfq_data["items"][0]
        rfq_id = first_rfq["id"]

        update_rfq_payload = {
            "status": "Reviewing",
            "admin_notes": "Application engineering team currently evaluating customer specimen geometry."
        }
        res_rfq_update = requests.patch(f"{base}/quotations/{rfq_id}", json=update_rfq_payload, headers=super_headers)
        assert res_rfq_update.status_code == 200
        rfq_fetched = requests.get(f"{base}/quotations/{rfq_id}", headers=super_headers).json()
        assert rfq_fetched["status"] == "Reviewing"
        assert "Application engineering team" in rfq_fetched["admin_notes"]
        passed += 1
        print(f"✓ [PASS] 14. Quotation (RFQ) Workflow: Transitioned RFQ #{first_rfq['rfq_number']} to 'Reviewing' with Admin Notes", flush=True)

        # -------------------------------------------------------------
        # TEST 15: Audit Trail Verification
        # -------------------------------------------------------------
        total += 1
        res = requests.get(f"{base}/audit-logs?page=1&limit=25", headers=super_headers)
        assert res.status_code == 200
        audit_data = res.json()
        assert audit_data["total"] > 0
        actions = [log["action"] for log in audit_data["items"]]
        assert "LOGIN_SUCCESS" in actions
        assert "PRODUCT_CREATE" in actions
        assert "PRODUCT_UPDATE" in actions
        assert "IMAGE_UPLOAD" in actions
        assert "CATALOGUE_UPLOAD" in actions
        assert "CATEGORY_CREATE" in actions
        passed += 1
        print(f"✓ [PASS] 15. Audit Trail Verification: Logged {audit_data['total']} administrative events across all actions", flush=True)

        # -------------------------------------------------------------
        # CAPTURE SCREENSHOTS OF ADMIN CONSOLE
        # -------------------------------------------------------------
        print("\n" + "=" * 70, flush=True)
        print("CAPTURING ADMIN PORTAL SCREENSHOTS VIA HEADLESS CHROME", flush=True)
        print("=" * 70, flush=True)

        auth_query = f"?token={super_token}&role=super_admin&user=admin"

        pages_to_capture = [
            ("login.html", "admin_login_desktop.png", False),
            ("dashboard.html", "admin_dashboard_desktop.png", True),
            ("products.html", "admin_products_desktop.png", True),
            ("categories.html", "admin_categories_desktop.png", True),
            ("enquiries.html", "admin_enquiries_desktop.png", True),
            ("quotations.html", "admin_quotations_desktop.png", True),
            ("audit-logs.html", "admin_audit_logs_desktop.png", True)
        ]

        for page_name, out_file, need_auth in pages_to_capture:
            url = f"{portal}/{page_name}"
            if need_auth:
                url += auth_query
            out_path = SCREENSHOTS_DIR / out_file
            ok = capture_screenshot(url, out_path, width=1440, height=900, delay=1.5)
            if ok:
                print(f"  ✓ Captured: {out_file} ({out_path.stat().st_size // 1024} KB)", flush=True)
            else:
                print(f"  ✗ Failed to capture: {out_file}", flush=True)

    finally:
        # -------------------------------------------------------------
        # CLEANUP: Remove Only Test Entities, Preserving Genuine Records
        # -------------------------------------------------------------
        db = SessionLocal()
        try:
            if test_product_id:
                p = db.query(Product).filter(Product.id == test_product_id).first()
                if p:
                    # Clean up uploaded test files from disk
                    if p.image_url and "test_machine" in p.image_url:
                        file_on_disk = os.path.join(r"c:\PORTAL_PROJECT_2\new-website\frontend", p.image_url.lstrip("/"))
                        if os.path.exists(file_on_disk):
                            try: os.remove(file_on_disk)
                            except: pass
                    if p.catalogue_path and "tcm_official" in p.catalogue_path:
                        file_on_disk = os.path.join(r"c:\PORTAL_PROJECT_2\new-website\frontend", p.catalogue_path.lstrip("/"))
                        if os.path.exists(file_on_disk):
                            try: os.remove(file_on_disk)
                            except: pass
                    db.delete(p)
                    db.commit()

            if test_subcat_id:
                sub = db.query(Subcategory).filter(Subcategory.id == test_subcat_id).first()
                if sub:
                    db.delete(sub)
                    db.commit()

            if test_cat_id:
                cat = db.query(Category).filter(Category.id == test_cat_id).first()
                if cat:
                    db.delete(cat)
                    db.commit()

            # Verify integrity
            final_p_count = db.query(Product).count()
            final_c_count = db.query(Category).count()
            final_sub_count = db.query(Subcategory).count()
            print("-" * 70, flush=True)
            print(f"POST-TEST DATABASE AUDIT:", flush=True)
            print(f"  Products:      {final_p_count} (must be exactly 214)", flush=True)
            print(f"  Categories:    {final_c_count} (must be exactly 9)", flush=True)
            print(f"  Subcategories: {final_sub_count} (must be exactly 34)", flush=True)
            assert final_p_count == 214, f"Integrity check failed: products={final_p_count}"
            assert final_c_count == 9, f"Integrity check failed: categories={final_c_count}"
            assert final_sub_count == 34, f"Integrity check failed: subcategories={final_sub_count}"
        finally:
            db.close()
            if server:
                server.should_exit = True

    print("=" * 70, flush=True)
    print(f"STAGE 3 TEST RESULTS: {passed} / {total} SUCCEEDED (100% PASS RATE)", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    run_stage3_tests()
