from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class QuotationItemCreate(BaseModel):
    product_id: int
    product_name: str
    model_number: str
    quantity: int = 1
    customization_notes: Optional[str] = None

class QuotationItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    model_number: str
    quantity: int
    customization_notes: Optional[str] = None

    class Config:
        from_attributes = True

class QuotationCreate(BaseModel):
    company_name: str
    contact_person: str
    email: str
    phone: str
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    gst_number: Optional[str] = None
    industry_sector: Optional[str] = None
    requirements_notes: Optional[str] = None
    target_delivery_date: Optional[str] = None
    items: List[QuotationItemCreate]

class QuotationResponse(BaseModel):
    id: int
    rfq_number: str
    company_name: str
    contact_person: str
    email: str
    phone: str
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    gst_number: Optional[str] = None
    industry_sector: Optional[str] = None
    requirements_notes: Optional[str] = None
    target_delivery_date: Optional[str] = None
    status: str
    created_at: datetime
    items: List[QuotationItemResponse] = []

    class Config:
        from_attributes = True

class QuotationStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None
