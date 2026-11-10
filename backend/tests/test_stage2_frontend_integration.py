import os
import sys
import unittest
from pathlib import Path

# Force UTF-8 on Windows stdout
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import SessionLocal
from app.models.product import Product, Category, Subcategory, ProductSpecification, ProductFeature
from app.routers.products import list_products, get_product, compare_products, download_catalogue_pdf
from app.routers.categories import get_categories
from app.routers.enquiries import submit_enquiry
from app.routers.quotations import submit_quotation_request
from starlette.requests import Request
from app.schemas.enquiry import EnquiryCreate
from app.schemas.quotation import QuotationCreate, QuotationItemCreate

class TestStage2Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.frontend_dir = BASE_DIR.parent / "frontend"
        cls.static_dir = BASE_DIR / "static"
        cls.catalogues_dir = cls.static_dir / "catalogues"
        cls.images_dir = cls.static_dir / "images"

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_frontend_files_exist(self):
        """Verify all required HTML and JS files exist in frontend directory"""
        required_html = [
            "index.html",
            "products.html",
            "product-detail.html",
            "compare.html",
            "company.html",
            "contact.html"
        ]
        for html_file in required_html:
            path = self.frontend_dir / html_file
            self.assertTrue(path.exists(), f"Frontend file missing: {html_file}")
            content = path.read_text(encoding="utf-8")
            self.assertIn("HSMLE India Corporation", content)
            self.assertIn("ISO 9001:2015", content)

        required_js = [
            "js/api.js",
            "js/rfq.js",
            "js/compare.js",
            "js/app.js",
            "js/home.js",
            "js/catalog.js",
            "js/product-detail.js",
            "js/contact.js"
        ]
        for js_file in required_js:
            path = self.frontend_dir / js_file
            self.assertTrue(path.exists(), f"JavaScript file missing: {js_file}")

    def test_02_all_214_catalogues_accessible_and_valid(self):
        """Verify all 214 products have their authentic original PDF on disk"""
        products = self.db.query(Product).all()
        self.assertEqual(len(products), 214)

        missing_pdfs = []
        for p in products:
            pdf_path = self.catalogues_dir / p.original_filename
            if not pdf_path.exists():
                missing_pdfs.append((p.id, p.original_filename))

        self.assertEqual(len(missing_pdfs), 0, f"Missing PDFs on disk: {missing_pdfs}")

    def test_03_all_214_product_images_verified_or_placeholder(self):
        """Verify 211 high-res images exist and exactly 3 placeholders are assigned"""
        products = self.db.query(Product).all()
        verified_count = 0
        placeholder_count = 0

        for p in products:
            if p.has_verified_image:
                verified_count += 1
                img_rel = p.image_url.replace("/static/", "")
                img_path = self.static_dir / img_rel
                self.assertTrue(img_path.exists(), f"Verified image not found on disk: {img_path}")
            else:
                placeholder_count += 1
                self.assertIn("product-placeholder.svg", p.image_url)
                self.assertIn(p.id, [92, 120, 193])

        self.assertEqual(verified_count, 211)
        self.assertEqual(placeholder_count, 3)

    def test_04_category_filtering(self):
        """Test product listing filtering by category slug"""
        res = list_products(category_slug="hardness-testing-equipment", page=1, limit=50, db=self.db)
        self.assertEqual(res["total"], 41)
        self.assertEqual(len(res["items"]), 41)
        for item in res["items"]:
            self.assertEqual(item.category_name, "Hardness Testing Equipment")

    def test_05_subcategory_filtering(self):
        """Test product listing filtering by subcategory slug"""
        res = list_products(subcategory_slug="rockwell-hardness-testers", page=1, limit=50, db=self.db)
        self.assertGreater(res["total"], 0)
        for item in res["items"]:
            self.assertEqual(item.subcategory_name, "Rockwell Hardness Testers")

    def test_06_live_search(self):
        """Test multi-keyword live search for products and models"""
        res = list_products(search="digital rockwell", page=1, limit=20, db=self.db)
        self.assertGreater(res["total"], 0)
        for item in res["items"]:
            name_or_desc = (item.product_name + " " + (item.description or "")).lower()
            self.assertTrue("digital" in name_or_desc or "rockwell" in name_or_desc)

    def test_07_pagination(self):
        """Test pagination slices across all 214 products"""
        res_page1 = list_products(page=1, limit=12, db=self.db)
        res_page2 = list_products(page=2, limit=12, db=self.db)
        self.assertEqual(res_page1["total"], 214)
        self.assertEqual(res_page1["total_pages"], 18)
        self.assertEqual(len(res_page1["items"]), 12)
        self.assertEqual(len(res_page2["items"]), 12)
        # Ensure page 1 and page 2 items are distinct
        ids1 = {i.id for i in res_page1["items"]}
        ids2 = {i.id for i in res_page2["items"]}
        self.assertEqual(len(ids1.intersection(ids2)), 0)

    def test_08_product_detail_and_specs(self):
        """Test loading full product details with specifications and features"""
        p = get_product("1", db=self.db)
        self.assertEqual(p.id, 1)
        self.assertEqual(p.model_number, "HVH-5-10-30-50AT-8P-MT-8P")
        self.assertGreater(len(p.features), 0)
        self.assertIsNotNone(p.catalogue_path)

    def test_09_product_comparison_matrix_alignment(self):
        """Test side-by-side comparison for up to 4 models with spec alignment"""
        res = compare_products("1,5,8,19", db=self.db)
        self.assertEqual(len(res["products"]), 4)
        self.assertIn("spec_keys", res)
        # Verify aligned_specs contains entry for each key
        for prod in res["products"]:
            self.assertIn("aligned_specs", prod)
            for k in res["spec_keys"]:
                self.assertIn(k, prod["aligned_specs"])

    def test_10_enquiry_flow(self):
        """Test enquiry submission from contact/enquiry modals"""
        enq_data = EnquiryCreate(
            product_id=5,
            product_name="Advanced Touch Screen Digital Rockwell Hardness Tester",
            model_number="RH-150DT",
            full_name="Vikram Singh",
            company_name="Bharat Heavy Engineering",
            email="vikram@bhe.in",
            phone="+91 9811223344",
            city="Ghaziabad",
            country="India",
            subject="Commercial Price and FAT Protocol",
            message="Please provide quotation including diamond indenter and 3 test blocks."
        )
        scope = {"type": "http", "client": ("127.0.0.1", 12345)}
        req = Request(scope)
        res = submit_enquiry(enq_data, req, db=self.db)
        self.assertTrue(res.enquiry_number.startswith("ENQ-"))
        self.assertEqual(res.status.lower(), "new")

    def test_11_multi_product_quotation_rfq_flow(self):
        """Test multi-product RFQ submission with customization notes"""
        rfq_data = QuotationCreate(
            company_name="Tata Advanced Systems",
            contact_person="Anand Verma",
            email="anand.verma@tata-advanced.com",
            phone="+91 9988776655",
            delivery_city="Bengaluru",
            delivery_state="Karnataka",
            gst_number="29AAACT2727Q1ZT",
            industry_sector="Aerospace & Defense",
            requirements_notes="Requires calibration with NABL traceable masters",
            target_delivery_date="2026-11-30",
            items=[
                QuotationItemCreate(
                    product_id=1,
                    product_name="Advanced Digital Vickers Hardness Tester",
                    model_number="HVH-5-10-30-50AT-8P-MT-8P",
                    quantity=2,
                    customization_notes="Include turret auto-measurement"
                ),
                QuotationItemCreate(
                    product_id=19,
                    product_name="Torsion Testing Machine",
                    model_number="HT-A",
                    quantity=1,
                    customization_notes="Include digital torque transducer"
                )
            ]
        )
        scope = {"type": "http", "client": ("127.0.0.1", 12345)}
        req = Request(scope)
        res = submit_quotation_request(rfq_data, req, db=self.db)
        self.assertTrue(res.rfq_number.startswith("RFQ-"))
        self.assertEqual(len(res.items), 2)
        self.assertEqual(res.status.lower(), "pending")

    def test_12_download_pdf_endpoint(self):
        """Test catalogue PDF download endpoint returns valid FileResponse"""
        resp = download_catalogue_pdf(1, db=self.db)
        self.assertEqual(resp.media_type, "application/pdf")
        self.assertTrue(os.path.exists(resp.path))

if __name__ == '__main__':
    unittest.main()
