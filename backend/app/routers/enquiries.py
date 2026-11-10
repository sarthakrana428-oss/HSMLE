import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.enquiry import Enquiry
from ..models.admin import AdminUser
from ..schemas.enquiry import EnquiryCreate, EnquiryResponse, EnquiryStatusUpdate
from ..security import get_current_admin

router = APIRouter(prefix="/enquiries", tags=["Enquiries"])

def generate_enquiry_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(Enquiry).count() + 1
    rand = random.randint(100, 999)
    return f"ENQ-{year}-{count:04d}-{rand}"

@router.post("", response_model=EnquiryResponse, status_code=201)
def submit_enquiry(
    payload: EnquiryCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    enq = Enquiry(
        enquiry_number=generate_enquiry_number(db),
        product_id=payload.product_id,
        product_name=payload.product_name,
        model_number=payload.model_number,
        full_name=payload.full_name.strip(),
        company_name=payload.company_name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip(),
        city=payload.city.strip() if payload.city else None,
        country=payload.country.strip() if payload.country else "India",
        subject=payload.subject.strip() if payload.subject else "Product Information Enquiry",
        message=payload.message.strip(),
        status="New",
        ip_address=client_ip
    )
    
    db.add(enq)
    db.commit()
    db.refresh(enq)
    return enq

@router.get("", response_model=List[EnquiryResponse])
def list_enquiries(
    status: Optional[str] = None,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Enquiry)
    if status:
        query = query.filter(Enquiry.status == status)
    return query.order_by(Enquiry.id.desc()).all()

@router.patch("/{enquiry_id}/status", response_model=EnquiryResponse)
def update_enquiry_status(
    enquiry_id: int,
    payload: EnquiryStatusUpdate,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    enq = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")
        
    enq.status = payload.status
    if payload.admin_notes is not None:
        enq.admin_notes = payload.admin_notes
    db.commit()
    db.refresh(enq)
    return enq
