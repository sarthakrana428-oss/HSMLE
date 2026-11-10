from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import os

from ..database import get_db
from ..config import settings
from ..models.product import Product, Category, Subcategory, ProductSpecification, ProductFeature
from ..schemas.product import ProductListSchema, ProductDetailSchema

router = APIRouter(prefix="/products", tags=["Products"])

def format_product_list_item(p: Product) -> ProductListSchema:
    all_specs = p.specifications or []
    preferred_keywords = (
        "range", "capacity", "resolution", "magnification", "diameter",
        "force", "load", "speed", "travel", "accuracy", "turret", "power"
    )
    high_priority = []
    other_core = []
    for s in all_specs:
        kl = s.spec_key.lower()
        if (
            kl.startswith("model")
            or "accessories" in kl
            or "conversion" in kl
            or "packing" in kl
            or kl.startswith("hardness scale")
            or kl.startswith("supported hardness")
        ):
            continue
        if any(pk in kl for pk in preferred_keywords):
            high_priority.append(s)
        else:
            other_core.append(s)

    combined = high_priority + other_core
    selected_specs = (combined if len(combined) >= 2 else all_specs)[:2]
    return ProductListSchema(
        id=p.id,
        product_name=p.product_name,
        slug=p.slug,
        model_number=p.model_number,
        category_id=p.category_id,
        category_name=p.category.name if p.category else "",
        category_slug=p.category.slug if p.category else "",
        subcategory_id=p.subcategory_id,
        subcategory_name=p.subcategory.name if p.subcategory else "",
        subcategory_slug=p.subcategory.slug if p.subcategory else "",
        description=p.description,
        image_url=p.image_url,
        video_url=p.video_url,
        has_verified_image=p.has_verified_image,
        catalogue_path=p.catalogue_path,
        catalogue_pages=p.catalogue_pages,
        is_featured=p.is_featured,
        spec_count=len(all_specs),
        key_specs=selected_specs
    )

def format_product_detail(p: Product) -> ProductDetailSchema:
    return ProductDetailSchema(
        id=p.id,
        product_name=p.product_name,
        slug=p.slug,
        model_number=p.model_number,
        all_detected_models=p.all_detected_models,
        category_id=p.category_id,
        category_name=p.category.name if p.category else "",
        category_slug=p.category.slug if p.category else "",
        subcategory_id=p.subcategory_id,
        subcategory_name=p.subcategory.name if p.subcategory else "",
        subcategory_slug=p.subcategory.slug if p.subcategory else "",
        description=p.description,
        original_filename=p.original_filename,
        catalogue_path=p.catalogue_path,
        catalogue_size_bytes=p.catalogue_size_bytes,
        catalogue_sha256=p.catalogue_sha256,
        catalogue_pages=p.catalogue_pages,
        image_url=p.image_url,
        video_url=p.video_url,
        has_verified_image=p.has_verified_image,
        is_duplicate=p.is_duplicate,
        duplicate_of=p.duplicate_of,
        is_featured=p.is_featured,
        meta_title=p.meta_title,
        meta_description=p.meta_description,
        features=p.features,
        specifications=p.specifications
    )

@router.get("", response_model=Dict[str, Any])
def list_products(
    category_slug: Optional[str] = None,
    subcategory_slug: Optional[str] = None,
    search: Optional[str] = None,
    featured_only: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=2000),
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.is_active == True)

    if category_slug:
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if not cat and category_slug == "mechanical-universal-testing-machines":
            cat = db.query(Category).filter(Category.slug == "testing-machines").first()
        if cat:
            query = query.filter(Product.category_id == cat.id)
            
    if subcategory_slug:
        sub = db.query(Subcategory).filter(Subcategory.slug == subcategory_slug).first()
        if sub:
            query = query.filter(Product.subcategory_id == sub.id)

    if search:
        search_terms = search.strip().split()
        for term in search_terms:
            t_pat = f"%{term}%"
            query = query.filter(
                or_(
                    Product.product_name.ilike(t_pat),
                    Product.model_number.ilike(t_pat),
                    Product.all_detected_models.ilike(t_pat),
                    Product.description.ilike(t_pat)
                )
            )

    if featured_only:
        query = query.filter(Product.is_featured == True)

    total = query.count()
    items = query.order_by(Product.id).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "items": [format_product_list_item(p) for p in items]
    }

@router.get("/featured", response_model=List[ProductListSchema])
def get_featured_products(limit: int = Query(8, ge=1, le=20), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.is_featured == True).limit(limit).all()
    return [format_product_list_item(p) for p in products]

@router.get("/compare", response_model=Dict[str, Any])
def compare_products(
    ids: str = Query(..., description="Comma separated product IDs, e.g. 1,2,3"),
    db: Session = Depends(get_db)
):
    try:
        p_ids = [int(i.strip()) for i in ids.split(',') if i.strip().isdigit()]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product IDs")

    if not p_ids:
        raise HTTPException(status_code=400, detail="No product IDs provided")

    if len(p_ids) > 4:
        p_ids = p_ids[:4] # max 4 products for comparison

    products = db.query(Product).filter(Product.id.in_(p_ids)).all()
    
    # Collect all unique spec keys across compared products
    all_spec_keys = []
    seen_keys = set()
    for p in products:
        for s in p.specifications:
            if s.spec_key not in seen_keys:
                seen_keys.add(s.spec_key)
                all_spec_keys.append(s.spec_key)

    # Build aligned matrix
    compared_list = []
    for p in products:
        p_dict = format_product_detail(p).model_dump()
        specs_dict = {s.spec_key: s.spec_value for s in p.specifications}
        p_dict["aligned_specs"] = {k: specs_dict.get(k, "—") for k in all_spec_keys}
        compared_list.append(p_dict)

    return {
        "spec_keys": all_spec_keys,
        "products": compared_list
    }

@router.get("/{id_or_slug}", response_model=ProductDetailSchema)
def get_product(id_or_slug: str, db: Session = Depends(get_db)):
    if id_or_slug.isdigit():
        p = db.query(Product).filter(Product.id == int(id_or_slug)).first()
    else:
        p = db.query(Product).filter(Product.slug == id_or_slug).first()

    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    return format_product_detail(p)

@router.get("/{product_id}/download-pdf")
def download_catalogue_pdf(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    file_path = os.path.join(settings.CATALOGUES_DIR, p.original_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Catalogue PDF file not found on server")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=p.original_filename
    )
