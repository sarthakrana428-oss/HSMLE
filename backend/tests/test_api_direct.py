import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.config import settings
from app.routers.categories import get_categories, get_category_by_slug
from app.routers.products import list_products, get_product, compare_products, get_featured_products
from app.routers.enquiries import submit_enquiry, list_enquiries, update_enquiry_status
from app.routers.quotations import submit_quotation_request, list_quotation_requests, update_quotation_status
from app.routers.admin import admin_login, get_dashboard_stats
from app.schemas.enquiry import EnquiryCreate, EnquiryStatusUpdate
from app.schemas.quotation import QuotationCreate, QuotationItemCreate, QuotationStatusUpdate
from app.schemas.admin import AdminLogin
from app.models.admin import AdminUser
from app.models.product import Product

class MockRequest:
    class Client:
        host = "127.0.0.1"
    client = Client()

def run_direct_tests():
    print("=" * 65, flush=True)
    print("HSMLE INDIA CORPORATION - BACKEND API & DATA TEST SUITE", flush=True)
    print("=" * 65, flush=True)

    db = SessionLocal()
    passed = 0
    total = 0

    try:
        # Test 1: Category Listing
        total += 1
        cats = get_categories(db=db)
        assert len(cats) == 9, f"Expected 9 categories, got {len(cats)}"
        total_p = sum(c.total_products for c in cats)
        assert total_p == 214, f"Expected 214 products across categories, got {total_p}"
        passed += 1
        print(f"✓ [PASS] Categories Endpoint: Loaded {len(cats)} categories across {total_p} total products", flush=True)

        # Test 2: Category Detail by Slug
        total += 1
        cat_slug = cats[0].slug
        cat_detail = get_category_by_slug(slug=cat_slug, db=db)
        assert cat_detail.slug == cat_slug
        assert len(cat_detail.subcategories) > 0
        passed += 1
        print(f"✓ [PASS] Category by Slug: '{cat_detail.name}' ({len(cat_detail.subcategories)} subcategories)", flush=True)

        # Test 3: Product Listing & Pagination
        total += 1
        p_res = list_products(page=1, limit=24, db=db)
        assert p_res["total"] == 214
        assert len(p_res["items"]) == 24
        assert p_res["total_pages"] == 9
        passed += 1
        print(f"✓ [PASS] Products Listing (Page 1): {len(p_res['items'])} items returned, total {p_res['total']}", flush=True)

        # Test 4: Product Category Filter
        total += 1
        p_filtered = list_products(category_slug=cat_slug, page=1, limit=50, db=db)
        assert p_filtered["total"] == cat_detail.total_products
        passed += 1
        print(f"✓ [PASS] Category Filter ({cat_slug}): Found {p_filtered['total']} products", flush=True)

        # Test 5: Search Filter
        total += 1
        p_search = list_products(search="vickers", page=1, limit=50, db=db)
        assert p_search["total"] > 0
        passed += 1
        print(f"✓ [PASS] Product Search ('vickers'): Found {p_search['total']} matches", flush=True)

        # Test 6: Product Detail by ID
        total += 1
        p5 = get_product(id_or_slug="5", db=db)
        assert p5.id == 5
        assert p5.model_number == "RH-150DT"
        assert len(p5.specifications) > 0
        assert len(p5.features) > 0
        assert p5.has_verified_image is True
        passed += 1
        print(f"✓ [PASS] Product Detail by ID (5): '{p5.product_name}' (Model: {p5.model_number})", flush=True)

        # Test 7: Product Detail by SEO Slug
        total += 1
        p_slug = get_product(id_or_slug=p5.slug, db=db)
        assert p_slug.id == 5
        passed += 1
        print(f"✓ [PASS] Product Detail by SEO Slug: '{p5.slug}' -> ID {p_slug.id}", flush=True)

        # Test 8: Asset Verification Status for the 3 Unverified Products
        total += 1
        p92 = get_product(id_or_slug="92", db=db)
        p120 = get_product(id_or_slug="120", db=db)
        p193 = get_product(id_or_slug="193", db=db)
        assert p92.has_verified_image is False and "placeholder" in p92.image_url
        assert p120.has_verified_image is False and "placeholder" in p120.image_url
        assert p193.has_verified_image is False and "placeholder" in p193.image_url
        passed += 1
        print("✓ [PASS] Asset Verification: Products 92, 120, and 193 correctly flagged with placeholder status", flush=True)

        # Test 9: Featured Products
        total += 1
        featured = get_featured_products(limit=8, db=db)
        assert len(featured) > 0
        assert all(f.is_featured for f in featured)
        passed += 1
        print(f"✓ [PASS] Featured Products: {len(featured)} flagship models selected", flush=True)

        # Test 10: Multi-Product Comparison Matrix Alignment
        total += 1
        comp = compare_products(ids="5,8,12", db=db)
        assert len(comp["products"]) == 3
        assert len(comp["spec_keys"]) > 0
        for cp in comp["products"]:
            assert "aligned_specs" in cp
            assert len(cp["aligned_specs"]) == len(comp["spec_keys"])
        passed += 1
        print(f"✓ [PASS] Compare Products: Aligned {len(comp['spec_keys'])} spec matrix keys across 3 models", flush=True)

        # Test 11: Catalogue Files Integrity Check
        total += 1
        missing_catalogues = []
        all_prods = db.query(Product).all()
        for pr in all_prods:
            full_pdf_path = os.path.join(settings.CATALOGUES_DIR, pr.original_filename)
            if not os.path.exists(full_pdf_path):
                missing_catalogues.append(pr.original_filename)
        assert len(missing_catalogues) == 0, f"Missing catalogues: {missing_catalogues}"
        passed += 1
        print(f"✓ [PASS] Catalogue Integrity: All 214 PDF files physically present and verified on disk", flush=True)

        # Test 12: Customer Enquiry Submission
        total += 1
        enq_in = EnquiryCreate(
            product_id=5,
            product_name=p5.product_name,
            model_number=p5.model_number,
            full_name="Alok Kumar",
            company_name="Hero MotoCorp Quality Lab",
            email="alok.kumar@heromotocorp.example.com",
            phone="+91 9876543210",
            city="Gurugram",
            country="India",
            subject="Rockwell Hardness Tester RFQ",
            message="Requesting technical quote with diamond indenter package and installation timeline."
        )
        enq_out = submit_enquiry(payload=enq_in, request=MockRequest(), db=db)
        assert enq_out.enquiry_number.startswith("ENQ-")
        assert enq_out.status == "New"
        passed += 1
        print(f"✓ [PASS] Submit Customer Enquiry: Created '{enq_out.enquiry_number}'", flush=True)

        # Test 13: Quotation Request (RFQ Multi-Item Cart)
        total += 1
        rfq_in = QuotationCreate(
            company_name="Tata Motors Commercial Vehicles",
            contact_person="Rohan Mehta",
            email="rohan.mehta@tatamotors.example.com",
            phone="+91 9911223344",
            delivery_city="Pune",
            delivery_state="Maharashtra",
            gst_number="27AAACT2727Q1ZW",
            industry_sector="Automotive Manufacturing",
            requirements_notes="Need on-site commissioning and calibration certificate.",
            target_delivery_date="20 Days",
            items=[
                QuotationItemCreate(
                    product_id=5,
                    product_name=p5.product_name,
                    model_number=p5.model_number,
                    quantity=2,
                    customization_notes="Factory calibrated indenter"
                ),
                QuotationItemCreate(
                    product_id=12,
                    product_name="Automatic Grinding & Polishing Machine",
                    model_number="HUTOPOL-2000XP",
                    quantity=1,
                    customization_notes="230mm disc"
                )
            ]
        )
        rfq_out = submit_quotation_request(payload=rfq_in, request=MockRequest(), db=db)
        assert rfq_out.rfq_number.startswith("RFQ-")
        assert len(rfq_out.items) == 2
        assert rfq_out.status == "Pending"
        passed += 1
        print(f"✓ [PASS] Submit RFQ (Multi-Product Cart): Created '{rfq_out.rfq_number}' with {len(rfq_out.items)} items", flush=True)

        # Test 14: Admin Authentication & JWT Token
        total += 1
        login_in = AdminLogin(username=settings.ADMIN_USERNAME, password=settings.ADMIN_PASSWORD)
        token_out = admin_login(payload=login_in, request=MockRequest(), db=db)
        assert token_out.access_token is not None
        assert token_out.username == settings.ADMIN_USERNAME
        passed += 1
        print(f"✓ [PASS] Admin Security Login: PBKDF2 hash verified -> JWT Access Token issued", flush=True)

        # Test 15: Admin Dashboard Stats
        total += 1
        admin_user = db.query(AdminUser).filter(AdminUser.username == settings.ADMIN_USERNAME).first()
        stats = get_dashboard_stats(current_admin=admin_user, db=db)
        assert stats.total_products == 214
        assert stats.total_categories == 9
        assert stats.total_enquiries >= 2
        assert stats.total_quotations >= 2
        passed += 1
        print(f"✓ [PASS] Admin Stats: Products={stats.total_products}, Categories={stats.total_categories}, Leads={stats.total_enquiries}, RFQs={stats.total_quotations}", flush=True)

    finally:
        db.close()

    print("=" * 65, flush=True)
    print(f"ALL {passed} / {total} BACKEND TESTS COMPLETED WITH 100% SUCCESS!", flush=True)
    print("=" * 65, flush=True)

if __name__ == '__main__':
    run_direct_tests()
