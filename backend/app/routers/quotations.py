import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.quotation import QuotationRequest, QuotationItem
from ..models.admin import AdminUser
from ..schemas.quotation import QuotationCreate, QuotationResponse, QuotationStatusUpdate
from ..security import get_current_admin

router = APIRouter(prefix="/quotations", tags=["Quotations"])

def generate_rfq_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(QuotationRequest).count() + 1
    rand = random.randint(100, 999)
    return f"RFQ-{year}-{count:04d}-{rand}"

@router.post("", response_model=QuotationResponse, status_code=201)
def submit_quotation_request(
    payload: QuotationCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Quotation request must contain at least one product")

    client_ip = request.client.host if (request and request.client) else "127.0.0.1"

    rfq = QuotationRequest(
        rfq_number=generate_rfq_number(db),
        company_name=payload.company_name.strip(),
        contact_person=payload.contact_person.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip(),
        delivery_city=payload.delivery_city.strip() if payload.delivery_city else None,
        delivery_state=payload.delivery_state.strip() if payload.delivery_state else None,
        gst_number=payload.gst_number.strip().upper() if payload.gst_number else None,
        industry_sector=payload.industry_sector.strip() if payload.industry_sector else None,
        requirements_notes=payload.requirements_notes.strip() if payload.requirements_notes else None,
        target_delivery_date=payload.target_delivery_date.strip() if payload.target_delivery_date else None,
        status="Pending",
        ip_address=client_ip
    )
    db.add(rfq)
    db.flush() # obtain rfq.id

    for item in payload.items:
        q_item = QuotationItem(
            quotation_id=rfq.id,
            product_id=item.product_id,
            product_name=item.product_name.strip(),
            model_number=item.model_number.strip(),
            quantity=max(1, item.quantity),
            customization_notes=item.customization_notes.strip() if item.customization_notes else None
        )
        db.add(q_item)

    db.commit()
    db.refresh(rfq)

    # Automated Customer Confirmation Email (Post-Commit Trigger)
    try:
        from ..services.notification_service import send_quotation_confirmation
        send_quotation_confirmation(rfq=rfq, db=db)
    except Exception as notify_err:
        import logging
        logging.getLogger("quotations").error(f"Failed to trigger customer confirmation email: {notify_err}")

    return rfq

@router.get("", response_model=List[QuotationResponse])
def list_quotation_requests(
    status: Optional[str] = None,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(QuotationRequest)
    if status:
        query = query.filter(QuotationRequest.status == status)
    return query.order_by(QuotationRequest.id.desc()).all()

@router.get("/{quotation_id}", response_model=QuotationResponse)
def get_quotation_request(
    quotation_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    rfq = db.query(QuotationRequest).filter(QuotationRequest.id == quotation_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="Quotation request not found")
    return rfq

@router.patch("/{quotation_id}/status", response_model=QuotationResponse)
def update_quotation_status(
    quotation_id: int,
    payload: QuotationStatusUpdate,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    rfq = db.query(QuotationRequest).filter(QuotationRequest.id == quotation_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="Quotation request not found")

    rfq.status = payload.status
    if payload.admin_notes is not None:
        rfq.admin_notes = payload.admin_notes
    db.commit()
    db.refresh(rfq)
    return rfq
