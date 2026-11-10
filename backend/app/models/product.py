from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    subcategories = relationship("Subcategory", back_populates="category", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="category")


class Subcategory(Base):
    __tablename__ = "subcategories"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), index=True, nullable=False)
    slug = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)

    category = relationship("Category", back_populates="subcategories")
    products = relationship("Product", back_populates="subcategory")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(255), index=True, nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    model_number = Column(String(100), index=True, nullable=False)
    all_detected_models = Column(Text, nullable=True)
    
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"), nullable=False, index=True)
    
    description = Column(Text, nullable=True)
    original_filename = Column(String(255), unique=True, nullable=False)
    catalogue_path = Column(String(255), nullable=False)
    catalogue_size_bytes = Column(Integer, default=0)
    catalogue_sha256 = Column(String(64), index=True, nullable=False)
    catalogue_pages = Column(Integer, default=1)
    
    image_url = Column(String(255), nullable=False)
    video_url = Column(String(500), nullable=True)
    has_verified_image = Column(Boolean, default=True)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(String(255), nullable=True)
    is_featured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="products")
    subcategory = relationship("Subcategory", back_populates="products")
    specifications = relationship("ProductSpecification", back_populates="product", cascade="all, delete-orphan", order_by="ProductSpecification.display_order")
    features = relationship("ProductFeature", back_populates="product", cascade="all, delete-orphan", order_by="ProductFeature.display_order")


class ProductSpecification(Base):
    __tablename__ = "product_specifications"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    spec_key = Column(String(150), index=True, nullable=False)
    spec_value = Column(Text, nullable=False)
    display_order = Column(Integer, default=0)

    product = relationship("Product", back_populates="specifications")


class ProductFeature(Base):
    __tablename__ = "product_features"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_text = Column(Text, nullable=False)
    display_order = Column(Integer, default=0)

    product = relationship("Product", back_populates="features")
