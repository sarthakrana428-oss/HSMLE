from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class AdminLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    email: str
    role: str = "super_admin"
    full_name: str = "Azad Sirohi"

class AdminUserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    is_superadmin: bool
    last_login: Optional[datetime] = None
    full_name: str = "Azad Sirohi"

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_products: int
    total_categories: int
    total_subcategories: int
    total_catalogues: int
    total_enquiries: int
    new_enquiries: int
    total_quotations: int
    pending_quotations: int
    total_visitors: int = 28450
    unique_visitors: int = 14290
    today_visitors: int = 342
    estimated_pipeline_value: str = "₹1,84,50,000"
    top_viewed_products: List[Dict[str, Any]] = []
    traffic_sources: List[Dict[str, Any]] = []
    recent_enquiries: List[Dict[str, Any]] = []
    recent_quotations: List[Dict[str, Any]] = []
    category_distribution: List[Dict[str, Any]] = []

class ProductAdminCreate(BaseModel):
    product_name: str
    model_number: str
    all_detected_models: Optional[str] = None
    category_id: int
    subcategory_id: int
    description: Optional[str] = None
    is_featured: bool = False
    is_active: bool = True
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    specifications: List[Dict[str, str]] = []
    features: List[str] = []

class ProductAdminUpdate(BaseModel):
    product_name: Optional[str] = None
    model_number: Optional[str] = None
    all_detected_models: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    description: Optional[str] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    specifications: Optional[List[Dict[str, str]]] = None
    features: Optional[List[str]] = None

class CategoryAdminCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    display_order: int = 0

class CategoryAdminUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None

class SubcategoryAdminCreate(BaseModel):
    category_id: int
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None

class SubcategoryAdminUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None

class EnquiryUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class QuotationUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: int
    admin_username: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
