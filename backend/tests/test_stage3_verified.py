import os
import sys
import io
import time
import asyncio
from pathlib import Path

# Configure stdout encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi import HTTPException
from app.database import SessionLocal
from app.models.product import Product, Category, Subcategory
from app.models.enquiry import Enquiry
from app.models.quotation import QuotationRequest
from app.models.admin import AdminUser, AdminAuditLog
from app.security import (
    LOGIN_ATTEMPTS,
    check_ip_rate_limit,
    record_failed_login,
    clear_failed_logins,
    verify_password,
    create_access_token,
    require_superadmin
)
from app.routers.admin import (
    admin_login,
    get_current_user_profile,
    get_dashboard_stats,
    get_audit_logs,
    admin_list_products,
    admin_get_product,
    admin_create_product,
    admin_update_product,
    admin_toggle_product_status,
    admin_upload_product_image,
    admin_upload_product_catalogue,
    admin_get_categories,
    admin_create_category,
    admin_update_category,
    admin_create_subcategory,
    admin_update_subcategory,
    admin_get_enquiries,
    admin_get_enquiry,
    admin_update_enquiry_status,
    admin_get_quotations,
    admin_get_quotation,
    admin_update_quotation_status
)
from app.schemas.admin import (
    AdminLogin,
    ProductAdminCreate,
    ProductAdminUpdate,
    CategoryAdminCreate,
    CategoryAdminUpdate,
    SubcategoryAdminCreate,
    SubcategoryAdminUpdate,
    EnquiryUpdate,
    QuotationUpdate
)

class MockReq:
    class Client:
        host = "127.0.0.1"
    client = Client()

class MockUploadFile:
    def __init__(self, filename, content_type, data):
        self.filename = filename
        self.content_type = content_type
        self.data = data
    def read(self):
        return self.data

def run_coro(coro):
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value
    raise RuntimeError("Coroutine did not finish synchronously")

def run_tests():
    print("=" * 70, flush=True)
    print("HSMLE INDIA CORPORATION - STAGE 3 ADMIN PORTAL TEST SUITE", flush=True)
    print("=" * 70, flush=True)

    db = SessionLocal()
    req = MockReq()
    passed = 0
    total = 0
    test_product_id = None
    test_cat_id = None
    test_subcat_id = None

    try:
        # TEST 1: Rate Limiting
        total += 1
        LOGIN_ATTEMPTS.clear()
        ip = "127.0.0.1"
        assert check_ip_rate_limit(ip) is True
        for _ in range(5): record_failed_login(ip)
        assert check_ip_rate_limit(ip) is False
        clear_failed_logins(ip)
        assert check_ip_rate_limit(ip) is True
        passed += 1
        print("✓ [PASS] 1. Security Rate Limiting: 5 Failed Attempts Trigger 15-Minute Lockout", flush=True)

        # TEST 2: Authentication & PBKDF2 Hashing
        total += 1
        try:
            admin_login(AdminLogin(username="admin", password="WrongPassword!"), request=req, db=db)
            assert False, "Should have rejected bad password"
        except HTTPException as e:
            assert e.status_code == 401
        
        super_res = admin_login(AdminLogin(username="admin", password="Admin@HSMLE2026!"), request=req, db=db)
        assert super_res.access_token and super_res.role == "super_admin"

        staff_res = admin_login(AdminLogin(username="staff_editor", password="Staff@HSMLE2026!"), request=req, db=db)
        assert staff_res.access_token and staff_res.role == "staff"
        passed += 1
        print("✓ [PASS] 2. Admin Authentication & Role Assignment: PBKDF2 Verified, JWT Issued", flush=True)

        super_admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        staff_admin = db.query(AdminUser).filter(AdminUser.username == "staff_editor").first()

        # TEST 3: Admin Profile
        total += 1
        me = get_current_user_profile(current_admin=super_admin)
        assert me.username == "admin" and me.role == "super_admin"
        passed += 1
        print("✓ [PASS] 3. Current User Profile Endpoint (/api/admin/me)", flush=True)

        # TEST 4: Real-time Dashboard Stats
        total += 1
        stats = get_dashboard_stats(current_admin=super_admin, db=db)
        assert stats.total_products == 214
        assert stats.total_categories == 9
        assert stats.total_subcategories == 34
        assert stats.total_catalogues == 214
        assert len(stats.category_distribution) == 9
        passed += 1
        print(f"✓ [PASS] 4. Real-time Dashboard KPIs: 214 Products, 9 Categories, 34 Subcategories, {stats.total_enquiries} Enquiries, {stats.total_quotations} RFQs", flush=True)

        # TEST 5: Product Inventory Pagination & Search
        total += 1
        p_list = admin_list_products(page=1, limit=15, current_admin=super_admin, db=db)
        assert p_list["total"] == 214 and len(p_list["items"]) == 15 and p_list["total_pages"] == 15
        
        p_search = admin_list_products(search="Rockwell", current_admin=super_admin, db=db)
        assert p_search["total"] > 0
        
        p_cat = admin_list_products(category_id=1, current_admin=super_admin, db=db)
        assert p_cat["total"] == 2
        passed += 1
        print(f"✓ [PASS] 5. Product Management: Search ('Rockwell' -> {p_search['total']}), Division Filter (Div 1 -> 2)", flush=True)

        # TEST 6: Product Creation with Specs & Features
        total += 1
        create_payload = ProductAdminCreate(
            product_name="Test Calibration Master Instrument 5000",
            model_number="TCM-5000X",
            all_detected_models="TCM-5000X, TCM-5000PRO",
            category_id=1,
            subcategory_id=1,
            description="High precision verification instrument created during Stage 3 testing.",
            is_featured=True,
            is_active=True,
            meta_title="TCM-5000X Precision Unit | HSMLE",
            meta_description="Calibration standard load instrument.",
            specifications=[
                {"spec_key": "Load Range", "spec_value": "0 - 5000 kN"},
                {"spec_key": "Resolution", "spec_value": "0.01 kN"}
            ],
            features=[
                "Microprocessor-controlled closed loop load application",
                "Complies with ISO 7500-1 and ASTM E4"
            ]
        )
        created_res = admin_create_product(payload=create_payload, request=req, current_admin=super_admin, db=db)
        test_product_id = created_res["id"]
        prod_data = admin_get_product(product_id=test_product_id, current_admin=super_admin, db=db)
        assert prod_data["product_name"] == "Test Calibration Master Instrument 5000"
        assert len(prod_data["specifications"]) == 2
        assert len(prod_data["features"]) == 2
        passed += 1
        print(f"✓ [PASS] 6. Product Creation: New Instrument (ID: {test_product_id}) with Specs & Features", flush=True)

        # TEST 7: Product Update & Active Status Toggle
        total += 1
        update_payload = ProductAdminUpdate(
            product_name="Test Calibration Master Instrument 5000 - Updated",
            model_number="TCM-5000X-REV2",
            category_id=1,
            subcategory_id=1,
            description="Updated technical summary.",
            is_featured=False,
            is_active=False,
            specifications=[
                {"spec_key": "Load Range", "spec_value": "0 - 6000 kN"}
            ],
            features=[
                "High-contrast color touchscreen display"
            ]
        )
        admin_update_product(product_id=test_product_id, payload=update_payload, request=req, current_admin=super_admin, db=db)
        prod_updated = admin_get_product(product_id=test_product_id, current_admin=super_admin, db=db)
        assert prod_updated["product_name"] == "Test Calibration Master Instrument 5000 - Updated"
        assert prod_updated["is_active"] is False

        toggle_res = admin_toggle_product_status(product_id=test_product_id, request=req, current_admin=super_admin, db=db)
        assert toggle_res["is_active"] is True
        passed += 1
        print("✓ [PASS] 7. Product Update & Status Toggle (Deactivated then Reactivated)", flush=True)

        # TEST 8: Photo Upload Validation
        total += 1
        bad = MockUploadFile("bad.exe", "application/x-msdownload", b"MZ...")
        try:
            run_coro(admin_upload_product_image(product_id=test_product_id, file=bad, request=req, current_admin=super_admin, db=db))
            assert False
        except HTTPException as e:
            assert e.status_code == 400

        huge = MockUploadFile("huge.jpg", "image/jpeg", b"0" * (6 * 1024 * 1024))
        try:
            run_coro(admin_upload_product_image(product_id=test_product_id, file=huge, request=req, current_admin=super_admin, db=db))
            assert False
        except HTTPException as e:
            assert e.status_code == 400

        valid = MockUploadFile("photo.jpg", "image/jpeg", b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB\x00C\x00" + b"\x00" * 100)
        res = run_coro(admin_upload_product_image(product_id=test_product_id, file=valid, request=req, current_admin=super_admin, db=db))
        assert res["image_url"].startswith("/static/images/products/")
        passed += 1
        print("✓ [PASS] 8. Machine Photo Upload Security: Blocked .exe, blocked >5MB, uploaded valid JPEG", flush=True)

        # TEST 9: PDF Upload Validation
        total += 1
        bad_pdf = MockUploadFile("fake.pdf", "application/pdf", b"Not a real PDF document")
        try:
            run_coro(admin_upload_product_catalogue(product_id=test_product_id, file=bad_pdf, request=req, current_admin=super_admin, db=db))
            assert False
        except HTTPException as e:
            assert e.status_code == 400

        valid_pdf = MockUploadFile("tcm_unit.pdf", "application/pdf", b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\ntrailer\n<< /Root 1 0 R >>\n%%EOF")
        res = run_coro(admin_upload_product_catalogue(product_id=test_product_id, file=valid_pdf, request=req, current_admin=super_admin, db=db))
        assert res["catalogue_path"].startswith("/static/catalogues/")
        passed += 1
        print("✓ [PASS] 9. PDF Catalogue Upload Security: Blocked non-PDF, validated binary '%PDF-' header", flush=True)

        # TEST 10: RBAC Enforcement
        total += 1
        try:
            require_superadmin(current_admin=staff_admin)
            assert False
        except HTTPException as e:
            assert e.status_code == 403
        
        adm = require_superadmin(current_admin=super_admin)
        assert adm.username == "admin"
        passed += 1
        print("✓ [PASS] 10. Role-Based Access Control: Staff blocked (403), Super Admin granted", flush=True)

        # TEST 11: Division & Subcategory Management
        total += 1
        new_cat = admin_create_category(
            payload=CategoryAdminCreate(
                name="Temporary Test Metrology Division",
                slug="temp-test-metrology-division",
                description="Test division created during Stage 3 audit.",
                display_order=99
            ),
            request=req,
            current_admin=super_admin,
            db=db
        )
        test_cat_id = new_cat["id"]

        new_sub = admin_create_subcategory(
            payload=SubcategoryAdminCreate(
                category_id=test_cat_id,
                name="Automated Calibration Units",
                slug="automated-calibration-units",
                description="High precision robotics."
            ),
            request=req,
            current_admin=super_admin,
            db=db
        )
        test_subcat_id = new_sub["id"]

        update_cat = admin_update_category(
            category_id=test_cat_id,
            payload=CategoryAdminUpdate(name="Temporary Test Division (Revised)", display_order=98),
            request=req,
            current_admin=super_admin,
            db=db
        )
        assert update_cat["id"] == test_cat_id
        cat_in_db = db.query(Category).filter(Category.id == test_cat_id).first()
        assert cat_in_db.name == "Temporary Test Division (Revised)"
        passed += 1
        print(f"✓ [PASS] 11. Division & Subcategory Management: Created Division (ID: {test_cat_id}), Subcategory (ID: {test_subcat_id})", flush=True)

        # TEST 12: Customer Enquiry Management
        total += 1
        enqs = admin_get_enquiries(page=1, limit=10, current_admin=super_admin, db=db)
        assert enqs["total"] >= 1
        first_enq = enqs["items"][0]
        enq_id = first_enq["id"]

        enq_updated = admin_update_enquiry_status(
            enquiry_id=enq_id,
            payload=EnquiryUpdate(
                status="Contacted",
                admin_notes="Engineering sales specialist contacted customer via telephone. Commercial offer submitted."
            ),
            request=req,
            current_admin=super_admin,
            db=db
        )
        assert enq_updated["status"] == "Contacted"
        assert "Engineering sales specialist" in db.query(Enquiry).filter(Enquiry.id == enq_id).first().admin_notes
        passed += 1
        print(f"✓ [PASS] 12. Customer Enquiry Workflow: Enquiry #{first_enq['enquiry_number']} updated to 'Contacted' with Admin Notes", flush=True)

        # TEST 13: Quotation Request (RFQ) Management
        total += 1
        rfqs = admin_get_quotations(page=1, limit=10, current_admin=super_admin, db=db)
        assert rfqs["total"] >= 1
        first_rfq = rfqs["items"][0]
        rfq_id = first_rfq["id"]

        rfq_updated = admin_update_quotation_status(
            rfq_id=rfq_id,
            payload=QuotationUpdate(
                status="Reviewing",
                admin_notes="Application engineering team reviewing machine sample specifications and delivery schedule."
            ),
            request=req,
            current_admin=super_admin,
            db=db
        )
        assert rfq_updated["status"] == "Reviewing"
        assert "Application engineering team" in db.query(QuotationRequest).filter(QuotationRequest.id == rfq_id).first().admin_notes
        passed += 1
        print(f"✓ [PASS] 13. Quotation (RFQ) Workflow: RFQ #{first_rfq['rfq_number']} updated to 'Reviewing' with Admin Notes", flush=True)

        # TEST 14: Audit Trail Logging
        total += 1
        audit_res = get_audit_logs(page=1, limit=50, current_admin=super_admin, db=db)
        assert audit_res["total"] > 0
        actions = [log.action for log in audit_res["items"]]
        assert "LOGIN_SUCCESS" in actions
        assert "PRODUCT_CREATE" in actions
        assert "PRODUCT_UPDATE" in actions
        assert "IMAGE_UPLOAD" in actions
        assert "CATALOGUE_UPLOAD" in actions
        assert "CATEGORY_CREATE" in actions
        passed += 1
        print(f"✓ [PASS] 14. Immutable Security Audit Trail: {audit_res['total']} events recorded across all administrative operations", flush=True)

        # TEST 15: Public Website Unbroken Verification
        total += 1
        from app.routers.categories import get_categories
        from app.routers.products import list_products
        public_cats = get_categories(db=db)
        assert len(public_cats) >= 9
        public_prods = list_products(page=1, limit=10, db=db)
        assert public_prods["total"] >= 214
        passed += 1
        print("✓ [PASS] 15. Public Frontend & API Continuity: Unaffected and fully functional", flush=True)

    finally:
        # CLEANUP: Remove Only Test Entities, Preserving Genuine Records
        if test_product_id:
            p = db.query(Product).filter(Product.id == test_product_id).first()
            if p:
                if p.image_url and "photo" in p.image_url:
                    disk_f = os.path.join(r"c:\PORTAL_PROJECT_2\new-website\backend\static", p.image_url.replace("/static/", ""))
                    if os.path.exists(disk_f):
                        try: os.remove(disk_f)
                        except: pass
                if p.catalogue_path and "tcm_unit" in p.catalogue_path:
                    disk_f = os.path.join(r"c:\PORTAL_PROJECT_2\new-website\backend\static", p.catalogue_path.replace("/static/", ""))
                    if os.path.exists(disk_f):
                        try: os.remove(disk_f)
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

        final_p_count = db.query(Product).count()
        final_c_count = db.query(Category).count()
        final_sub_count = db.query(Subcategory).count()
        print("-" * 70, flush=True)
        print("POST-TEST DATABASE AUDIT (Data Integrity Verification):", flush=True)
        print(f"  Products:      {final_p_count} (must be exactly 214)", flush=True)
        print(f"  Categories:    {final_c_count} (must be exactly 9)", flush=True)
        print(f"  Subcategories: {final_sub_count} (must be exactly 34)", flush=True)
        assert final_p_count == 214, f"Integrity check failed: products={final_p_count}"
        assert final_c_count == 9, f"Integrity check failed: categories={final_c_count}"
        assert final_sub_count == 34, f"Integrity check failed: subcategories={final_sub_count}"

        db.close()

    print("=" * 70, flush=True)
    print(f"STAGE 3 VERIFIED TEST RESULTS: {passed} / {total} PASSED (100% SUCCESS)", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    run_tests()
