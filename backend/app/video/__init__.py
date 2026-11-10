"""
HSMLE India Corporation - Automated 30-Second Industrial Product Video Engine
Produces professional, broadcast-quality 1080p MP4 videos for HSMLE machinery
preserving 100% mechanical fidelity, technical specifications and corporate branding.
"""

from .generator import (
    generate_product_video,
    get_video_status,
    delete_product_video,
    start_batch_generation,
    get_batch_status,
    VideoGenerationError
)

__all__ = [
    "generate_product_video",
    "get_video_status",
    "delete_product_video",
    "start_batch_generation",
    "get_batch_status",
    "VideoGenerationError"
]
