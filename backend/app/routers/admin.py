import os
import re
import hashlib
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from ..database import get_db
from ..config import settings
from ..models.admin import AdminUser, AdminAuditLog
from ..models.product import Product, Category, Subcategory, ProductSpecification, ProductFeature
from ..models.enquiry import Enquiry
from ..models.quotation import QuotationRequest, QuotationItem
from ..schemas.admin import (
    AdminLogin, Token, AdminUserResponse, DashboardStats,
    ProductAdminCreate, ProductAdminUpdate,
    CategoryAdminCreate, CategoryAdminUpdate,
    SubcategoryAdminCreate, SubcategoryAdminUpdate,
    EnquiryUpdate, QuotationUpdate, AuditLogResponse
)
from ..schemas.product import ProductDetailSchema, ProductListSchema
from ..security import (
    verify_password,
    create_access_token,
    get_current_admin,
    require_superadmin,
    check_ip_rate_limit,
    record_failed_login,
    clear_failed_logins,
    log_admin_activity
)

router = APIRouter(prefix="/admin", tags=["Admin"])

def sanitize_filename(filename: str) -> str:
    filename = os.path.basename(filename)
    filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    return filename

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '-', text)

# =========================================================================
# 1. AUTHENTICATION & PROFILE
# =========================================================================

@router.post("/login", response_model=Token)
def admin_login(
    payload: AdminLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if not check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please wait {settings.LOCKOUT_MINUTES} minutes before trying again."
        )

    admin = db.query(AdminUser).filter(AdminUser.username == payload.username.strip()).first()
    if not admin or not verify_password(payload.password, admin.hashed_password):
        record_failed_login(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative username or password"
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative account is currently deactivated"
        )

    clear_failed_logins(client_ip)
    admin.last_login = datetime.utcnow()
    db.commit()

    log_admin_activity(
        db, admin,
        action="LOGIN_SUCCESS",
        target_type="admin_user",
        target_id=admin.id,
        details=f"Admin logged in from {client_ip}",
        ip_address=client_ip
    )

    role = getattr(admin, "role", "super_admin") or "super_admin"
    token = create_access_token(data={"sub": admin.username, "email": admin.email, "role": role})

    display_name = "Azad Sirohi" if admin.username == "admin" else admin.username
    return Token(
        access_token=token,
        token_type="bearer",
        username=display_name,
        email=admin.email,
        role=role,
        full_name=display_name
    )

@router.get("/me", response_model=AdminUserResponse)
def get_current_user_profile(current_admin: AdminUser = Depends(get_current_admin)):
    display_name = "Azad Sirohi" if current_admin.username == "admin" else current_admin.username
    return AdminUserResponse(
        id=current_admin.id,
        username=display_name,
        email=current_admin.email,
        role=getattr(current_admin, "role", "super_admin") or "super_admin",
        is_active=current_admin.is_active,
        is_superadmin=current_admin.is_superadmin,
        last_login=current_admin.last_login,
        full_name=display_name
    )

# =========================================================================
# 2. DASHBOARD & ANALYTICS
# =========================================================================

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    total_p = db.query(func.count(Product.id)).scalar() or 0
    total_c = db.query(func.count(Category.id)).scalar() or 0
    total_sub = db.query(func.count(Subcategory.id)).scalar() or 0
    
    total_enq = db.query(func.count(Enquiry.id)).scalar() or 0
    new_enq = db.query(func.count(Enquiry.id)).filter(func.lower(Enquiry.status) == "new").scalar() or 0
    
    total_rfq = db.query(func.count(QuotationRequest.id)).scalar() or 0
    pending_rfq = db.query(func.count(QuotationRequest.id)).filter(func.lower(QuotationRequest.status) == "pending").scalar() or 0

    # Recent enquiries (latest 5)
    recent_enqs = db.query(Enquiry).order_by(desc(Enquiry.created_at)).limit(5).all()
    recent_enq_list = [
        {
            "id": e.id,
            "enquiry_number": e.enquiry_number,
            "full_name": e.full_name,
            "company_name": e.company_name,
            "email": e.email,
            "status": e.status,
            "product_name": e.product_name or "General",
            "created_at": e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else ""
        }
        for e in recent_enqs
    ]

    # Recent RFQs (latest 5)
    recent_rfqs = db.query(QuotationRequest).order_by(desc(QuotationRequest.created_at)).limit(5).all()
    recent_rfq_list = [
        {
            "id": r.id,
            "rfq_number": r.rfq_number,
            "contact_person": r.contact_person,
            "company_name": r.company_name,
            "email": r.email,
            "status": r.status,
            "items_count": len(r.items),
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
        }
        for r in recent_rfqs
    ]

    # Category distribution for charts
    categories = db.query(Category).order_by(Category.display_order, Category.name).all()
    cat_dist = []
    for cat in categories:
        count = db.query(func.count(Product.id)).filter(Product.category_id == cat.id).scalar() or 0
        cat_dist.append({
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "product_count": count
        })

    # Top viewed products (Fresh start - 0 views until traffic records)
    top_products = db.query(Product).order_by(desc(Product.is_featured), desc(Product.id)).limit(5).all()
    top_viewed = [
        {
            "id": p.id,
            "product_name": p.product_name,
            "model_number": p.model_number or "Standard",
            "category_name": p.category.name if p.category else "Industrial Metrology",
            "view_count": 0,
            "inquiries_count": 0
        }
        for p in top_products
    ]

    traffic_sources = [
        {"source": "Direct / Tier-1 Enterprise Plants", "percentage": 0, "visitors": 0},
        {"source": "Google / Industrial Organic Search", "percentage": 0, "visitors": 0},
        {"source": "Defense & Indian Railways Portals", "percentage": 0, "visitors": 0},
        {"source": "Direct B2B Procurement Referrals", "percentage": 0, "visitors": 0}
    ]

    pipeline_val = f"₹{total_rfq * 1500000:,}" if total_rfq > 0 else "₹0"

    return DashboardStats(
        total_products=total_p,
        total_categories=total_c,
        total_subcategories=total_sub,
        total_catalogues=total_p,
        total_enquiries=total_enq,
        new_enquiries=new_enq,
        total_quotations=total_rfq,
        pending_quotations=pending_rfq,
        total_visitors=0,
        unique_visitors=0,
        today_visitors=0,
        estimated_pipeline_value=pipeline_val,
        top_viewed_products=top_viewed,
        traffic_sources=traffic_sources,
        recent_enquiries=recent_enq_list,
        recent_quotations=recent_rfq_list,
        category_distribution=cat_dist
    )

@router.get("/audit-logs", response_model=Dict[str, Any])
def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    action: Optional[str] = None,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    page = int(getattr(page, "default", page))
    limit = int(getattr(limit, "default", limit))
    query = db.query(AdminAuditLog)
    if action:
        query = query.filter(AdminAuditLog.action == action)

    total = query.count()
    logs = query.order_by(desc(AdminAuditLog.created_at)).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "items": [
            AuditLogResponse.model_validate(l) for l in logs
        ]
    }

# =========================================================================
# 3. PRODUCT INVENTORY MANAGEMENT
# =========================================================================

@router.get("/products", response_model=Dict[str, Any])
def admin_list_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    subcategory_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    page = int(getattr(page, "default", page))
    limit = int(getattr(limit, "default", limit))
    query = db.query(Product)

    if category_id:
        query = query.filter(Product.category_id == category_id)
    if subcategory_id:
        query = query.filter(Product.subcategory_id == subcategory_id)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if search:
        search_terms = search.strip().split()
        for term in search_terms:
            t_pat = f"%{term}%"
            query = query.filter(
                or_(
                    Product.product_name.ilike(t_pat),
                    Product.model_number.ilike(t_pat),
                    Product.all_detected_models.ilike(t_pat)
                )
            )

    total = query.count()
    items = query.order_by(Product.id).offset((page - 1) * limit).limit(limit).all()

    formatted_items = []
    for p in items:
        formatted_items.append({
            "id": p.id,
            "product_name": p.product_name,
            "slug": p.slug,
            "model_number": p.model_number,
            "category_id": p.category_id,
            "category_name": p.category.name if p.category else "",
            "category_slug": p.category.slug if p.category else "",
            "subcategory_id": p.subcategory_id,
            "subcategory_name": p.subcategory.name if p.subcategory else "",
            "description": p.description,
            "image_url": p.image_url,
            "has_verified_image": p.has_verified_image,
            "catalogue_path": p.catalogue_path,
            "catalogue_pages": p.catalogue_pages,
            "is_featured": p.is_featured,
            "is_active": p.is_active if hasattr(p, "is_active") else True
        })

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "items": formatted_items
    }

@router.get("/products/{product_id}")
def admin_get_product(
    product_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "id": p.id,
        "product_name": p.product_name,
        "slug": p.slug,
        "model_number": p.model_number,
        "all_detected_models": p.all_detected_models,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else "",
        "subcategory_id": p.subcategory_id,
        "subcategory_name": p.subcategory.name if p.subcategory else "",
        "description": p.description,
        "original_filename": p.original_filename,
        "catalogue_path": p.catalogue_path,
        "catalogue_size_bytes": p.catalogue_size_bytes,
        "catalogue_pages": p.catalogue_pages,
        "image_url": p.image_url,
        "has_verified_image": p.has_verified_image,
        "is_featured": p.is_featured,
        "is_active": p.is_active if hasattr(p, "is_active") else True,
        "meta_title": p.meta_title,
        "meta_description": p.meta_description,
        "specifications": [
            {"id": s.id, "spec_key": s.spec_key, "spec_value": s.spec_value, "display_order": s.display_order}
            for s in p.specifications
        ],
        "features": [
            {"id": f.id, "feature_text": f.feature_text, "display_order": f.display_order}
            for f in p.features
        ]
    }

@router.post("/products", status_code=201)
def admin_create_product(
    payload: ProductAdminCreate,
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    base_slug = slugify(f"{payload.product_name}-{payload.model_number}")
    existing = db.query(Product).filter(Product.slug == base_slug).first()
    if existing:
        base_slug = f"{base_slug}-{int(datetime.utcnow().timestamp())}"

    # Default placeholder image and dummy catalogue placeholder until uploaded
    placeholder_img = "/static/images/placeholders/product-placeholder.svg"
    placeholder_pdf = f"{base_slug}.pdf"

    new_prod = Product(
        product_name=payload.product_name.strip(),
        slug=base_slug,
        model_number=payload.model_number.strip(),
        all_detected_models=payload.all_detected_models or payload.model_number.strip(),
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        description=payload.description,
        original_filename=placeholder_pdf,
        catalogue_path=f"/static/catalogues/{placeholder_pdf}",
        catalogue_size_bytes=0,
        catalogue_sha256="pending_upload",
        catalogue_pages=1,
        image_url=placeholder_img,
        has_verified_image=False,
        is_featured=payload.is_featured,
        is_active=payload.is_active,
        meta_title=payload.meta_title or f"{payload.product_name} | HSMLE India",
        meta_description=payload.meta_description or f"Official specifications for {payload.product_name} from HSMLE India."
    )
    db.add(new_prod)
    db.flush()

    # Add specifications
    for idx, spec in enumerate(payload.specifications):
        if "spec_key" in spec and "spec_value" in spec:
            s_obj = ProductSpecification(
                product_id=new_prod.id,
                spec_key=spec["spec_key"].strip(),
                spec_value=spec["spec_value"].strip(),
                display_order=idx
            )
            db.add(s_obj)

    # Add features
    for idx, feat in enumerate(payload.features):
        if feat.strip():
            f_obj = ProductFeature(
                product_id=new_prod.id,
                feature_text=feat.strip(),
                display_order=idx
            )
            db.add(f_obj)

    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="PRODUCT_CREATE",
        target_type="product",
        target_id=new_prod.id,
        details=f"Created product '{new_prod.product_name}' (Model: {new_prod.model_number})",
        ip_address=client_ip
    )

    return {"message": "Product created successfully", "id": new_prod.id, "slug": new_prod.slug}

@router.put("/products/{product_id}")
def admin_update_product(
    product_id: int,
    payload: ProductAdminUpdate,
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.product_name is not None:
        p.product_name = payload.product_name.strip()
    if payload.model_number is not None:
        p.model_number = payload.model_number.strip()
    if payload.all_detected_models is not None:
        p.all_detected_models = payload.all_detected_models
    if payload.category_id is not None:
        p.category_id = payload.category_id
    if payload.subcategory_id is not None:
        p.subcategory_id = payload.subcategory_id
    if payload.description is not None:
        p.description = payload.description
    if payload.is_featured is not None:
        p.is_featured = payload.is_featured
    if payload.is_active is not None and hasattr(p, "is_active"):
        p.is_active = payload.is_active
    if payload.meta_title is not None:
        p.meta_title = payload.meta_title
    if payload.meta_description is not None:
        p.meta_description = payload.meta_description

    # Specifications update
    if payload.specifications is not None:
        db.query(ProductSpecification).filter(ProductSpecification.product_id == p.id).delete()
        for idx, spec in enumerate(payload.specifications):
            if "spec_key" in spec and "spec_value" in spec:
                s_obj = ProductSpecification(
                    product_id=p.id,
                    spec_key=spec["spec_key"].strip(),
                    spec_value=spec["spec_value"].strip(),
                    display_order=idx
                )
                db.add(s_obj)

    # Features update
    if payload.features is not None:
        db.query(ProductFeature).filter(ProductFeature.product_id == p.id).delete()
        for idx, feat in enumerate(payload.features):
            if feat.strip():
                f_obj = ProductFeature(
                    product_id=p.id,
                    feature_text=feat.strip(),
                    display_order=idx
                )
                db.add(f_obj)

    p.updated_at = datetime.utcnow()
    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="PRODUCT_UPDATE",
        target_type="product",
        target_id=p.id,
        details=f"Updated product details for ID {p.id}",
        ip_address=client_ip
    )

    return {"message": "Product updated successfully", "id": p.id}

@router.patch("/products/{product_id}/toggle-status")
def admin_toggle_product_status(
    product_id: int,
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    current_status = getattr(p, "is_active", True)
    new_status = not current_status
    p.is_active = new_status
    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="PRODUCT_TOGGLE_ACTIVE",
        target_type="product",
        target_id=p.id,
        details=f"Changed product ID {p.id} active status to {new_status}",
        ip_address=client_ip
    )

    return {"id": p.id, "is_active": new_status, "message": f"Product is now {'Active' if new_status else 'Deactivated'}"}

@router.post("/products/{product_id}/upload-image")
async def admin_upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    request: Request = None,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate Content Type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed formats: JPEG, PNG, WebP"
        )

    # Read and check size limit (5MB)
    raw = file.read()
    contents = await raw if asyncio.iscoroutine(raw) else raw
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image size exceeds 5MB limit"
        )

    # Sanitize and write
    ext = ".jpg" if "jpeg" in file.content_type or "jpg" in file.filename.lower() else ".png"
    safe_name = f"product_{p.id}_{int(datetime.utcnow().timestamp())}{ext}"
    images_dir = os.path.join(settings.STATIC_DIR, "images", "products")
    os.makedirs(images_dir, exist_ok=True)
    file_path = os.path.join(images_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    p.image_url = f"/static/images/products/{safe_name}"
    p.has_verified_image = True
    p.updated_at = datetime.utcnow()
    db.commit()

    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="IMAGE_UPLOAD",
        target_type="product",
        target_id=p.id,
        details=f"Uploaded new verified image '{safe_name}' ({len(contents)} bytes)",
        ip_address=client_ip
    )

    return {"message": "Image uploaded successfully", "image_url": p.image_url}

@router.post("/products/{product_id}/upload-catalogue")
async def admin_upload_product_catalogue(
    product_id: int,
    file: UploadFile = File(...),
    request: Request = None,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    if not file.filename.lower().endswith(".pdf") or file.content_type not in ["application/pdf", "application/x-pdf", "binary/octet-stream"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid document format. Only official PDF catalogues are permitted."
        )

    raw = file.read()
    contents = await raw if asyncio.iscoroutine(raw) else raw
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="PDF size exceeds 25MB limit"
        )

    if not contents.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="Corrupt PDF binary structure"
        )

    # Compute hash
    sha256 = hashlib.sha256(contents).hexdigest()
    safe_name = sanitize_filename(file.filename)
    if not safe_name.lower().endswith(".pdf"):
        safe_name = f"{safe_name}.pdf"

    cat_dir = settings.CATALOGUES_DIR
    os.makedirs(cat_dir, exist_ok=True)
    file_path = os.path.join(cat_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    p.original_filename = safe_name
    p.catalogue_path = f"/static/catalogues/{safe_name}"
    p.catalogue_size_bytes = len(contents)
    p.catalogue_sha256 = sha256
    try:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(contents))
        p.catalogue_pages = len(reader.pages)
    except Exception:
        p.catalogue_pages = 2
    p.updated_at = datetime.utcnow()
    db.commit()

    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="CATALOGUE_UPLOAD",
        target_type="product",
        target_id=p.id,
        details=f"Uploaded catalogue PDF '{safe_name}' ({len(contents)} bytes)",
        ip_address=client_ip
    )

    return {"message": "Catalogue PDF uploaded successfully", "catalogue_path": p.catalogue_path}

# =========================================================================
# 4. CATEGORY & SUBCATEGORY MANAGEMENT
# =========================================================================

@router.get("/categories")
def admin_get_categories(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    categories = db.query(Category).order_by(Category.display_order, Category.name).all()
    result = []
    for cat in categories:
        subcats = []
        for sub in sorted(cat.subcategories, key=lambda s: s.name):
            p_cnt = db.query(func.count(Product.id)).filter(Product.subcategory_id == sub.id).scalar() or 0
            subcats.append({
                "id": sub.id,
                "name": sub.name,
                "slug": sub.slug,
                "description": sub.description,
                "product_count": p_cnt
            })
        total_p = db.query(func.count(Product.id)).filter(Product.category_id == cat.id).scalar() or 0
        result.append({
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "display_order": cat.display_order,
            "total_products": total_p,
            "subcategories": subcats
        })
    return result

@router.post("/categories", status_code=201)
def admin_create_category(
    payload: CategoryAdminCreate,
    request: Request,
    current_admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    slug = payload.slug or slugify(payload.name)
    existing = db.query(Category).filter(or_(Category.name == payload.name.strip(), Category.slug == slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name or slug already exists")

    cat = Category(
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
        display_order=payload.display_order
    )
    db.add(cat)
    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="CATEGORY_CREATE",
        target_type="category",
        target_id=cat.id,
        details=f"Created category '{cat.name}'",
        ip_address=client_ip
    )

    return {"message": "Category created successfully", "id": cat.id, "slug": cat.slug}

@router.put("/categories/{category_id}")
def admin_update_category(
    category_id: int,
    payload: CategoryAdminUpdate,
    request: Request,
    current_admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name is not None:
        cat.name = payload.name.strip()
    if payload.slug is not None:
        cat.slug = payload.slug.strip()
    if payload.description is not None:
        cat.description = payload.description
    if payload.display_order is not None:
        cat.display_order = payload.display_order

    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="CATEGORY_UPDATE",
        target_type="category",
        target_id=cat.id,
        details=f"Updated category ID {cat.id}",
        ip_address=client_ip
    )

    return {"message": "Category updated successfully", "id": cat.id}

@router.post("/subcategories", status_code=201)
def admin_create_subcategory(
    payload: SubcategoryAdminCreate,
    request: Request,
    current_admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    parent = db.query(Category).filter(Category.id == payload.category_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent Category not found")

    slug = payload.slug or slugify(payload.name)
    sub = Subcategory(
        category_id=payload.category_id,
        name=payload.name.strip(),
        slug=slug,
        description=payload.description
    )
    db.add(sub)
    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="SUBCATEGORY_CREATE",
        target_type="subcategory",
        target_id=sub.id,
        details=f"Created subcategory '{sub.name}' under '{parent.name}'",
        ip_address=client_ip
    )

    return {"message": "Subcategory created successfully", "id": sub.id, "slug": sub.slug}

@router.put("/subcategories/{subcategory_id}")
def admin_update_subcategory(
    subcategory_id: int,
    payload: SubcategoryAdminUpdate,
    request: Request,
    current_admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    sub = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    if payload.category_id is not None:
        sub.category_id = payload.category_id
    if payload.name is not None:
        sub.name = payload.name.strip()
    if payload.slug is not None:
        sub.slug = payload.slug.strip()
    if payload.description is not None:
        sub.description = payload.description

    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="SUBCATEGORY_UPDATE",
        target_type="subcategory",
        target_id=sub.id,
        details=f"Updated subcategory ID {sub.id}",
        ip_address=client_ip
    )

    return {"message": "Subcategory updated successfully", "id": sub.id}

# =========================================================================
# 5. ENQUIRY MANAGEMENT
# =========================================================================

@router.get("/enquiries")
def admin_get_enquiries(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    page = int(getattr(page, "default", page))
    limit = int(getattr(limit, "default", limit))
    query = db.query(Enquiry)

    if status_filter:
        query = query.filter(func.lower(Enquiry.status) == status_filter.lower())

    if search:
        s_pat = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Enquiry.full_name.ilike(s_pat),
                Enquiry.company_name.ilike(s_pat),
                Enquiry.email.ilike(s_pat),
                Enquiry.enquiry_number.ilike(s_pat),
                Enquiry.message.ilike(s_pat)
            )
        )

    total = query.count()
    items = query.order_by(desc(Enquiry.created_at)).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "items": [
            {
                "id": e.id,
                "enquiry_number": e.enquiry_number,
                "product_id": e.product_id,
                "product_name": e.product_name,
                "model_number": e.model_number,
                "full_name": e.full_name,
                "company_name": e.company_name,
                "email": e.email,
                "phone": e.phone,
                "city": e.city,
                "country": e.country,
                "subject": e.subject,
                "message": e.message,
                "status": e.status,
                "admin_notes": e.admin_notes,
                "created_at": e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else ""
            }
            for e in items
        ]
    }

@router.get("/enquiries/{enquiry_id}")
def admin_get_enquiry(
    enquiry_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    e = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    return {
        "id": e.id,
        "enquiry_number": e.enquiry_number,
        "product_id": e.product_id,
        "product_name": e.product_name,
        "model_number": e.model_number,
        "full_name": e.full_name,
        "company_name": e.company_name,
        "email": e.email,
        "phone": e.phone,
        "city": e.city,
        "country": e.country,
        "subject": e.subject,
        "message": e.message,
        "status": e.status,
        "admin_notes": e.admin_notes,
        "created_at": e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else ""
    }

@router.patch("/enquiries/{enquiry_id}")
def admin_update_enquiry_status(
    enquiry_id: int,
    payload: EnquiryUpdate,
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    e = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    valid_statuses = ["New", "Contacted", "In Progress", "Resolved"]
    # Normalise status
    matched_status = next((s for s in valid_statuses if s.lower() == payload.status.lower()), None)
    if not matched_status:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {valid_statuses}")

    old_status = e.status
    e.status = matched_status
    if payload.admin_notes is not None:
        e.admin_notes = payload.admin_notes

    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="ENQUIRY_STATUS_CHANGE",
        target_type="enquiry",
        target_id=e.id,
        details=f"Changed enquiry {e.enquiry_number} status from '{old_status}' to '{matched_status}'",
        ip_address=client_ip
    )

    return {"message": "Enquiry updated", "id": e.id, "status": e.status}

# =========================================================================
# 6. QUOTATION / RFQ MANAGEMENT
# =========================================================================

@router.get("/quotations")
def admin_get_quotations(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    page = int(getattr(page, "default", page))
    limit = int(getattr(limit, "default", limit))
    query = db.query(QuotationRequest)

    if status_filter:
        query = query.filter(func.lower(QuotationRequest.status) == status_filter.lower())

    if search:
        s_pat = f"%{search.strip()}%"
        query = query.filter(
            or_(
                QuotationRequest.contact_person.ilike(s_pat),
                QuotationRequest.company_name.ilike(s_pat),
                QuotationRequest.email.ilike(s_pat),
                QuotationRequest.rfq_number.ilike(s_pat),
                QuotationRequest.delivery_city.ilike(s_pat)
            )
        )

    total = query.count()
    items = query.order_by(desc(QuotationRequest.created_at)).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "items": [
            {
                "id": r.id,
                "rfq_number": r.rfq_number,
                "company_name": r.company_name,
                "contact_person": r.contact_person,
                "email": r.email,
                "phone": r.phone,
                "delivery_city": r.delivery_city,
                "delivery_state": r.delivery_state,
                "industry_sector": r.industry_sector,
                "status": r.status,
                "items_count": len(r.items),
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
            }
            for r in items
        ]
    }

@router.get("/quotations/{rfq_id}")
def admin_get_quotation(
    rfq_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    r = db.query(QuotationRequest).filter(QuotationRequest.id == rfq_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Quotation request not found")

    return {
        "id": r.id,
        "rfq_number": r.rfq_number,
        "company_name": r.company_name,
        "contact_person": r.contact_person,
        "email": r.email,
        "phone": r.phone,
        "delivery_city": r.delivery_city,
        "delivery_state": r.delivery_state,
        "gst_number": r.gst_number,
        "industry_sector": r.industry_sector,
        "requirements_notes": r.requirements_notes,
        "target_delivery_date": r.target_delivery_date,
        "status": r.status,
        "admin_notes": r.admin_notes,
        "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product_name,
                "model_number": i.model_number,
                "quantity": i.quantity,
                "customization_notes": i.customization_notes
            }
            for i in r.items
        ]
    }

@router.patch("/quotations/{rfq_id}")
def admin_update_quotation_status(
    rfq_id: int,
    payload: QuotationUpdate,
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    r = db.query(QuotationRequest).filter(QuotationRequest.id == rfq_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Quotation request not found")

    valid_statuses = ["New", "Reviewing", "Quoted", "Approved", "Rejected", "Pending"]
    matched_status = next((s for s in valid_statuses if s.lower() == payload.status.lower()), None)
    if not matched_status:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {valid_statuses}")

    old_status = r.status
    r.status = matched_status
    if payload.admin_notes is not None:
        r.admin_notes = payload.admin_notes

    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    log_admin_activity(
        db, current_admin,
        action="RFQ_STATUS_CHANGE",
        target_type="quotation",
        target_id=r.id,
        details=f"Changed RFQ {r.rfq_number} status from '{old_status}' to '{matched_status}'",
        ip_address=client_ip
    )

    return {"message": "Quotation updated", "id": r.id, "status": r.status}
