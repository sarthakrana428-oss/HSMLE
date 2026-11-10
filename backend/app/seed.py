import os
import sys
import re
import json
from datetime import datetime

# Add app to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.stdout.reconfigure(encoding='utf-8')

from app.database import engine, SessionLocal, Base
from app.models.product import Category, Subcategory, Product, ProductSpecification, ProductFeature
from app.models.admin import AdminUser
from app.models.enquiry import Enquiry
from app.models.quotation import QuotationRequest, QuotationItem
from app.security import get_password_hash
from app.config import settings

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text

def seed_database():
    print("=" * 60)
    print("HSMLE INDIA CORPORATION - DATABASE INITIALIZATION & SEEDING")
    print("=" * 60)
    
    # 1. Create all tables
    print("\n[1/6] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 2. Seed Admin User
    print("\n[2/6] Seeding Admin User...")
    admin = db.query(AdminUser).filter(AdminUser.username == settings.ADMIN_USERNAME).first()
    if not admin:
        admin = AdminUser(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            is_active=True,
            is_superadmin=True
        )
        db.add(admin)
        db.commit()
        print(f"  ✓ Admin user created: '{settings.ADMIN_USERNAME}' (email: {settings.ADMIN_EMAIL})")
    else:
        print(f"  ✓ Admin user '{settings.ADMIN_USERNAME}' already exists.")

    # 3. Load Catalogue Data & Image Mappings
    print("\n[3/6] Loading source catalogue dataset and asset mappings...")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_root = os.path.dirname(backend_dir)
    workspace_root = os.path.dirname(app_root)
    json_path = os.path.join(workspace_root, '02_PIPELINES_AND_DATA', 'DATA', 'legacy_source', 'catalogue_data.json')
    img_map_path = os.path.join(backend_dir, 'data', 'image_mappings.json')

    with open(json_path, 'r', encoding='utf-8') as f:
        catalogue_data = json.load(f)

    image_mappings = {}
    if os.path.exists(img_map_path):
        with open(img_map_path, 'r', encoding='utf-8') as f:
            image_mappings = json.load(f)

    # 4. Seed Categories and Subcategories
    print("\n[4/6] Seeding Categories and Subcategories...")
    category_map = {} # name -> Category object
    subcategory_map = {} # (cat_name, subcat_name) -> Subcategory object

    for cat_order, cat_info in enumerate(catalogue_data['categories'], start=1):
        cat_name = cat_info['name']
        cat_slug = slugify(cat_name)
        
        category = db.query(Category).filter(Category.name == cat_name).first()
        if not category:
            category = Category(
                name=cat_name,
                slug=cat_slug,
                description=f"Official {cat_name} range engineered by HSMLE India Corporation.",
                display_order=cat_order
            )
            db.add(category)
            db.flush()
        category_map[cat_name] = category

        for sub_order, sub_info in enumerate(cat_info['subcategories'], start=1):
            sub_name = sub_info['name']
            sub_slug = slugify(sub_name)
            
            subcategory = db.query(Subcategory).filter(
                Subcategory.category_id == category.id,
                Subcategory.name == sub_name
            ).first()
            if not subcategory:
                subcategory = Subcategory(
                    category_id=category.id,
                    name=sub_name,
                    slug=sub_slug,
                    description=f"High-precision {sub_name} for metallurgical and industrial quality assurance.",
                    display_order=sub_order
                )
                db.add(subcategory)
                db.flush()
            subcategory_map[(cat_name, sub_name)] = subcategory

    db.commit()
    print(f"  ✓ Seeded {len(category_map)} Categories and {len(subcategory_map)} Subcategories.")

    # 5. Seed Products
    print("\n[5/6] Seeding 214 Products with Specifications & Features...")
    existing_product_count = db.query(Product).count()
    if existing_product_count > 0:
        print(f"  Note: {existing_product_count} products already in database. Clearing to ensure clean sync...")
        db.query(ProductFeature).delete()
        db.query(ProductSpecification).delete()
        db.query(Product).delete()
        db.commit()

    products_seeded = 0
    specs_seeded = 0
    features_seeded = 0
    placeholder_products = []

    used_slugs = set()

    for idx, p in enumerate(catalogue_data['products'], start=1):
        cat_name = p['category']
        sub_name = p['subcategory']
        
        category = category_map[cat_name]
        subcategory = subcategory_map[(cat_name, sub_name)]
        
        # Build unique SEO slug
        base_slug = slugify(f"{p['product_name']}-{p['model_number']}")
        slug = base_slug
        counter = 1
        while slug in used_slugs:
            slug = f"{base_slug}-{counter}"
            counter += 1
        used_slugs.add(slug)

        # Image mapping
        str_id = str(p['id'])
        img_info = image_mappings.get(str_id, {})
        img_url = img_info.get('image_url', '/static/images/placeholders/product-placeholder.svg')
        has_verified = img_info.get('has_verified_image', False)

        if not has_verified:
            placeholder_products.append((p['id'], p['product_name'], p['model_number']))

        # Featured flag for popular machines
        is_featured = idx in [1, 5, 8, 12, 19, 23, 27, 45, 60, 80, 100, 120]

        prod = Product(
            id=p['id'],
            product_name=p['product_name'],
            slug=slug,
            model_number=p['model_number'],
            all_detected_models="; ".join(p['all_detected_models']),
            category_id=category.id,
            subcategory_id=subcategory.id,
            description=p['description'],
            original_filename=p['filename'],
            catalogue_path=f"/static/catalogues/{p['filename']}",
            catalogue_size_bytes=p['file_size_bytes'],
            catalogue_sha256=p['file_sha256'],
            catalogue_pages=p['page_count'],
            image_url=img_url,
            has_verified_image=has_verified,
            is_duplicate=p['is_duplicate'],
            duplicate_of=p['duplicate_of'],
            is_featured=is_featured,
            meta_title=f"{p['product_name']} ({p['model_number']}) | HSMLE India Corporation",
            meta_description=f"Official technical specifications and catalogue for {p['product_name']} (Model: {p['model_number']}) manufactured by HSMLE India Corporation."
        )
        db.add(prod)
        db.flush()
        products_seeded += 1

        # Seed Features
        for f_idx, feat in enumerate(p['features'], start=1):
            pf = ProductFeature(
                product_id=prod.id,
                feature_text=feat,
                display_order=f_idx
            )
            db.add(pf)
            features_seeded += 1

        # Seed Specifications
        for s_idx, (k, v) in enumerate(p['technical_specifications'].items(), start=1):
            ps = ProductSpecification(
                product_id=prod.id,
                spec_key=k,
                spec_value=v,
                display_order=s_idx
            )
            db.add(ps)
            specs_seeded += 1

    db.commit()
    print(f"  ✓ Seeded {products_seeded} Products.")
    print(f"  ✓ Seeded {specs_seeded} Technical Specifications.")
    print(f"  ✓ Seeded {features_seeded} Product Features.")

    # 6. Seed Sample Enquiries and RFQ
    print("\n[6/6] Seeding Verification Demo Enquiries & Quotation Requests...")
    if db.query(Enquiry).count() == 0:
        demo_enquiry = Enquiry(
            enquiry_number="ENQ-2026-0001-842",
            product_id=5,
            product_name="Advanced Touch Screen Digital Rockwell Hardness Tester",
            model_number="RH-150DT",
            full_name="Rajesh Sharma",
            company_name="Mahindra Automotive Quality Division",
            email="rajesh.sharma@mahindra.example.com",
            phone="+91 9811223344",
            city="Pune",
            country="India",
            subject="Rockwell Hardness Tester RH-150DT Technical Enquiry",
            message="Please provide calibration certification details and delivery schedule for 2 units of RH-150DT for our testing lab in Chakan.",
            status="New",
            ip_address="127.0.0.1"
        )
        db.add(demo_enquiry)

    if db.query(QuotationRequest).count() == 0:
        demo_rfq = QuotationRequest(
            rfq_number="RFQ-2026-0001-915",
            company_name="Tata Motors Heavy Vehicle Testing Center",
            contact_person="Vikram Malhotra",
            email="v.malhotra@tatamotors.example.com",
            phone="+91 9822001122",
            delivery_city="Jamshedpur",
            delivery_state="Jharkhand",
            gst_number="20AAACT2727Q1ZW",
            industry_sector="Automobile & Commercial Vehicles",
            requirements_notes="Requires factory installation, NABL calibration certificate, and 2-year AMC package.",
            target_delivery_date="Within 30 Days",
            status="Pending",
            ip_address="127.0.0.1"
        )
        db.add(demo_rfq)
        db.flush()

        item1 = QuotationItem(
            quotation_id=demo_rfq.id,
            product_id=12,
            product_name="Automatic Grinding & Polishing Machine",
            model_number="HUTOPOL-2000XP",
            quantity=1,
            customization_notes="Include magnetic disc and 230mm platen set"
        )
        item2 = QuotationItem(
            quotation_id=demo_rfq.id,
            product_id=8,
            product_name="Auto Turret Micro Vickers Hardness Tester",
            model_number="HVH-1000A",
            quantity=1,
            customization_notes="Equip with 40X objective and LCD measuring system"
        )
        db.add(item1)
        db.add(item2)

    db.commit()
    db.close()

    print("\n" + "=" * 60)
    print("DATABASE SEEDING COMPLETED SUCCESSFULLY!")
    print(f"Total Products Imported: {products_seeded}")
    print(f"Products with Verified High-Res Images: {products_seeded - len(placeholder_products)}")
    print(f"Products using Verification Placeholders: {len(placeholder_products)}")
    for pid, pname, pmodel in placeholder_products:
        print(f"   -> ID {pid}: {pname} (Model: {pmodel})")
    print("=" * 60)

if __name__ == '__main__':
    seed_database()
