from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from ..database import Base

class Enquiry(Base):
    __tablename__ = "enquiries"

    id = Column(Integer, primary_key=True, index=True)
    enquiry_number = Column(String(30), unique=True, index=True, nullable=False)
    
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_name = Column(String(255), nullable=True)
    model_number = Column(String(100), nullable=True)
    
    full_name = Column(String(150), nullable=False)
    company_name = Column(String(150), nullable=False)
    email = Column(String(150), index=True, nullable=False)
    phone = Column(String(50), nullable=False)
    city = Column(String(100), nullable=True)
    country = Column(String(100), default="India")
    
    subject = Column(String(200), default="Product Information Enquiry")
    message = Column(Text, nullable=False)
    status = Column(String(50), default="New", index=True) # New, In Progress, Quoted, Closed
    admin_notes = Column(Text, nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
