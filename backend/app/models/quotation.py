from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class QuotationRequest(Base):
    __tablename__ = "quotation_requests"

    id = Column(Integer, primary_key=True, index=True)
    rfq_number = Column(String(30), unique=True, index=True, nullable=False)
    
    company_name = Column(String(150), nullable=False)
    contact_person = Column(String(150), nullable=False)
    email = Column(String(150), index=True, nullable=False)
    phone = Column(String(50), nullable=False)
    delivery_city = Column(String(100), nullable=True)
    delivery_state = Column(String(100), nullable=True)
    gst_number = Column(String(50), nullable=True)
    industry_sector = Column(String(100), nullable=True) # Automobile, Railways, Aerospace, etc.
    
    requirements_notes = Column(Text, nullable=True)
    target_delivery_date = Column(String(100), nullable=True)
    
    status = Column(String(50), default="Pending", index=True) # Pending, Under Review, Quoted, Completed, Cancelled
    admin_notes = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotation_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(255), nullable=False)
    model_number = Column(String(100), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    customization_notes = Column(Text, nullable=True)

    quotation = relationship("QuotationRequest", back_populates="items")
