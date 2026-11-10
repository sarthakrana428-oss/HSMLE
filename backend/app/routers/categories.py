from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.product import Category, Subcategory, Product
from ..schemas.product import CategoryBase, SubcategoryBase

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryBase])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.display_order, Category.name).all()
    result = []
    
    for cat in categories:
        subcats = []
        for sub in sorted(cat.subcategories, key=lambda s: s.name):
            p_count = db.query(func.count(Product.id)).filter(Product.subcategory_id == sub.id, Product.is_active == True).scalar()
            subcats.append(SubcategoryBase(
                id=sub.id,
                name=sub.name,
                slug=sub.slug,
                description=sub.description,
                product_count=p_count
            ))
            
        total_p = db.query(func.count(Product.id)).filter(Product.category_id == cat.id, Product.is_active == True).scalar()
        result.append(CategoryBase(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            description=cat.description,
            total_products=total_p,
            subcategories=subcats
        ))
        
    return result

@router.get("/{slug}", response_model=CategoryBase)
def get_category_by_slug(slug: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.slug == slug).first()
    if not cat and slug == "mechanical-universal-testing-machines":
        cat = db.query(Category).filter(Category.slug == "testing-machines").first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
        
    subcats = []
    for sub in sorted(cat.subcategories, key=lambda s: s.name):
        p_count = db.query(func.count(Product.id)).filter(Product.subcategory_id == sub.id, Product.is_active == True).scalar()
        subcats.append(SubcategoryBase(
            id=sub.id,
            name=sub.name,
            slug=sub.slug,
            description=sub.description,
            product_count=p_count
        ))
        
    total_p = db.query(func.count(Product.id)).filter(Product.category_id == cat.id, Product.is_active == True).scalar()
    return CategoryBase(
        id=cat.id,
        name=cat.name,
        slug=cat.slug,
        description=cat.description,
        total_products=total_p,
        subcategories=subcats
    )
