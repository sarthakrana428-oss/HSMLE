from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class EnquiryCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    model_number: Optional[str] = None
    full_name: str
    company_name: str
    email: str
    phone: str
    city: Optional[str] = None
    country: Optional[str] = "India"
    subject: Optional[str] = "Product Information Enquiry"
    message: str

class EnquiryResponse(BaseModel):
    id: int
    enquiry_number: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    model_number: Optional[str] = None
    full_name: str
    company_name: str
    email: str
    phone: str
    city: Optional[str] = None
    country: Optional[str] = None
    subject: str
    message: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class EnquiryStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None
