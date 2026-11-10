import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.stdout.reconfigure(encoding='utf-8')

from app.main import app
from app.config import settings

client = TestClient(app)

def test_api_suite():
    print("\n" + "=" * 60)
    print("RUNNING HSMLE FASTAPI BACKEND TEST SUITE")
    print("=" * 60)
    
    passed = 0
    total = 0

    # 1. Root & Healthcheck
    total += 1
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["company"] == "HSMLE India Corporation"
    passed += 1
    print("✓ [PASS] Root endpoint / -> 200 OK")

    total += 1
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    passed += 1
    print("✓ [PASS] Healthcheck /health -> 200 OK")

    # 2. Categories
    total += 1
    res = client.get("/api/categories")
    assert res.status_code == 200
    categories = res.json()
    assert len(categories) == 9
    total_prod = sum(c["total_products"] for c in categories)
    assert total_prod == 214
    passed += 1
    print(f"✓ [PASS] GET /api/categories -> 200 OK ({len(categories)} categories, {total_prod} total products)")

    # 3. Products Listing & Filters
    total += 1
    res = client.get("/api/products?page=1&limit=24")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 214
    assert len(data["items"]) == 24
    passed += 1
    print(f"✓ [PASS] GET /api/products (page 1) -> 200 OK (total: {data['total']})")

    # Filter by category
    total += 1
    cat_slug = categories[0]["slug"]
    res = client.get(f"/api/products?category_slug={cat_slug}")
    assert res.status_code == 200
    assert res.json()["total"] == categories[0]["total_products"]
    passed += 1
    print(f"✓ [PASS] GET /api/products?category_slug={cat_slug} -> 200 OK ({res.json()['total']} items)")

    # Search filter
    total += 1
    res = client.get("/api/products?search=vickers")
    assert res.status_code == 200
    search_total = res.json()["total"]
    assert search_total > 0
    passed += 1
    print(f"✓ [PASS] GET /api/products?search=vickers -> 200 OK ({search_total} matches)")

    # 4. Product Detail (by ID and by slug)
    total += 1
    res = client.get("/api/products/5")
    assert res.status_code == 200
    p5 = res.json()
    assert p5["id"] == 5
    assert p5["model_number"] == "RH-150DT"
    assert len(p5["specifications"]) > 0
    assert len(p5["features"]) > 0
    assert p5["has_verified_image"] is True
    passed += 1
    print(f"✓ [PASS] GET /api/products/5 -> 200 OK ({p5['product_name']})")

    total += 1
    res = client.get(f"/api/products/{p5['slug']}")
    assert res.status_code == 200
    assert res.json()["id"] == 5
    passed += 1
    print(f"✓ [PASS] GET /api/products/{p5['slug']} (by SEO slug) -> 200 OK")

    # Check unverified placeholder products
    total += 1
    res92 = client.get("/api/products/92")
    assert res92.status_code == 200
    p92 = res92.json()
    assert p92["has_verified_image"] is False
    assert "placeholder" in p92["image_url"]
    passed += 1
    print(f"✓ [PASS] Unverified image verification: Product 92 has_verified_image=False and uses placeholder")

    # 5. Product Comparison
    total += 1
    res = client.get("/api/products/compare?ids=5,8,12")
    assert res.status_code == 200
    comp_data = res.json()
    assert len(comp_data["products"]) == 3
    assert len(comp_data["spec_keys"]) > 0
    passed += 1
    print(f"✓ [PASS] GET /api/products/compare?ids=5,8,12 -> 200 OK ({len(comp_data['spec_keys'])} spec matrix keys aligned)")

    # 6. PDF Catalogue Download
    total += 1
    res = client.get("/api/products/5/download-pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 100000
    passed += 1
    print(f"✓ [PASS] GET /api/products/5/download-pdf -> 200 OK ({len(res.content):,} bytes PDF streamed)")

    # 7. Customer Enquiry Submission
    total += 1
    enq_payload = {
        "product_id": 5,
        "product_name": "Advanced Touch Screen Digital Rockwell Hardness Tester",
        "model_number": "RH-150DT",
        "full_name": "Test Engineer",
        "company_name": "Bharat Heavy Electricals Limited",
        "email": "engineer@bhel.example.com",
        "phone": "+91 9988776655",
        "city": "Haridwar",
        "country": "India",
        "subject": "Calibration and Pricing",
        "message": "Testing automated enquiry creation."
    }
    res = client.post("/api/enquiries", json=enq_payload)
    assert res.status_code == 201
    enq_res = res.json()
    assert enq_res["enquiry_number"].startswith("ENQ-")
    assert enq_res["status"] == "New"
    passed += 1
    print(f"✓ [PASS] POST /api/enquiries -> 201 Created ({enq_res['enquiry_number']})")

    # 8. Quotation Request (RFQ with Multiple Items)
    total += 1
    rfq_payload = {
        "company_name": "Precision Auto Components Ltd",
        "contact_person": "Sunil Verma",
        "email": "s.verma@precisionauto.example.com",
        "phone": "+91 9876543210",
        "delivery_city": "Chennai",
        "delivery_state": "Tamil Nadu",
        "gst_number": "33AAACP1234Q1Z5",
        "industry_sector": "Automobile Components",
        "requirements_notes": "Urgent requirement for Q1 testing lab expansion.",
        "target_delivery_date": "15 Days",
        "items": [
            {
                "product_id": 5,
                "product_name": "Advanced Touch Screen Digital Rockwell Hardness Tester",
                "model_number": "RH-150DT",
                "quantity": 2,
                "customization_notes": "Include diamond indenters"
            },
            {
                "product_id": 12,
                "product_name": "Automatic Grinding & Polishing Machine",
                "model_number": "HUTOPOL-2000XP",
                "quantity": 1,
                "customization_notes": "230mm platen set"
            }
        ]
    }
    res = client.post("/api/quotations", json=rfq_payload)
    assert res.status_code == 201
    rfq_res = res.json()
    assert rfq_res["rfq_number"].startswith("RFQ-")
    assert len(rfq_res["items"]) == 2
    passed += 1
    print(f"✓ [PASS] POST /api/quotations (Multi-item RFQ) -> 201 Created ({rfq_res['rfq_number']}, {len(rfq_res['items'])} items)")

    # 9. Admin Authentication & Security
    total += 1
    # Invalid login
    res = client.post("/api/admin/login", json={"username": "admin", "password": "WrongPassword!"})
    assert res.status_code == 401
    passed += 1
    print("✓ [PASS] POST /api/admin/login (invalid password) -> 401 Unauthorized")

    total += 1
    # Valid login
    res = client.post("/api/admin/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    assert res.status_code == 200
    token_data = res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    passed += 1
    print(f"✓ [PASS] POST /api/admin/login (valid password) -> 200 OK (JWT Token issued)")

    # 10. Authenticated Admin Endpoints
    headers = {"Authorization": f"Bearer {token}"}
    
    total += 1
    res = client.get("/api/admin/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["username"] == settings.ADMIN_USERNAME
    passed += 1
    print(f"✓ [PASS] GET /api/admin/me (authenticated) -> 200 OK ({res.json()['username']})")

    total += 1
    res = client.get("/api/admin/stats", headers=headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_products"] == 214
    assert stats["total_categories"] == 9
    assert stats["total_enquiries"] >= 2
    assert stats["total_quotations"] >= 2
    passed += 1
    print(f"✓ [PASS] GET /api/admin/stats -> 200 OK (Products: {stats['total_products']}, Categories: {stats['total_categories']}, Enquiries: {stats['total_enquiries']}, RFQs: {stats['total_quotations']})")

    print("\n" + "=" * 60)
    print(f"ALL TESTS PASSED! ({passed} / {total} tests passed, 100% success)")
    print("=" * 60 + "\n")

if __name__ == '__main__':
    test_api_suite()
