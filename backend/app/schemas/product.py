from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from datetime import datetime

class SpecificationSchema(BaseModel):
    spec_key: str
    spec_value: str
    display_order: Optional[int] = 0

    class Config:
        from_attributes = True

class FeatureSchema(BaseModel):
    feature_text: str
    display_order: Optional[int] = 0

    class Config:
        from_attributes = True

class SubcategoryBase(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    product_count: Optional[int] = 0

    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    total_products: Optional[int] = 0
    subcategories: List[SubcategoryBase] = []

    class Config:
        from_attributes = True

class ProductListSchema(BaseModel):
    id: int
    product_name: str
    slug: str
    model_number: str
    category_id: int
    category_name: str
    category_slug: Optional[str] = None
    subcategory_id: int
    subcategory_name: str
    subcategory_slug: Optional[str] = None
    description: Optional[str] = None
    image_url: str
    video_url: Optional[str] = None
    has_verified_image: bool
    catalogue_path: str
    catalogue_pages: int
    is_featured: bool
    spec_count: Optional[int] = 0
    key_specs: List[SpecificationSchema] = []

    class Config:
        from_attributes = True

class ProductDetailSchema(BaseModel):
    id: int
    product_name: str
    slug: str
    model_number: str
    all_detected_models: Optional[str] = None
    category_id: int
    category_name: str
    category_slug: Optional[str] = None
    subcategory_id: int
    subcategory_name: str
    subcategory_slug: Optional[str] = None
    description: Optional[str] = None
    original_filename: str
    catalogue_path: str
    catalogue_size_bytes: int
    catalogue_sha256: str
    catalogue_pages: int
    image_url: str
    video_url: Optional[str] = None
    has_verified_image: bool
    is_duplicate: bool
    duplicate_of: Optional[str] = None
    is_featured: bool
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    features: List[FeatureSchema] = []
    specifications: List[SpecificationSchema] = []

    class Config:
        from_attributes = True
