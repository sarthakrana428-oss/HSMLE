from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from ..database import Base

class NotificationRecord(Base):
    __tablename__ = "notification_records"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, nullable=True, index=True)
    rfq_reference = Column(String(50), nullable=True, index=True)
    channel = Column(String(30), nullable=False, default="email")  # 'email', 'whatsapp', 'sms'
    recipient = Column(String(150), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="queued", index=True)  # 'sent', 'queued', 'failed', 'awaiting_credentials'
    provider_message_id = Column(String(150), nullable=True)
    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    sent_at = Column(DateTime, nullable=True)

