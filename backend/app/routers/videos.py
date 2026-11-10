"""
FastAPI Router for HSMLE 30-Second Product Video Generation & Batch Management.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Body
from pydantic import BaseModel

from ..video.generator import (
    generate_product_video,
    get_video_status,
    delete_product_video,
    start_batch_generation,
    get_batch_status,
    VideoGenerationError
)

router = APIRouter(prefix="/videos", tags=["Videos"])

class BatchGenerateRequest(BaseModel):
    product_ids: Optional[List[int]] = None

@router.get("/status/{product_id}")
def check_video_status(product_id: int):
    """Check whether a 30s video exists for product_id and return metadata."""
    try:
        return get_video_status(product_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate/{product_id}")
def generate_single_video(
    product_id: int,
    force: bool = Query(False, description="Force re-render even if video exists"),
    background: bool = Query(False, description="Run generation asynchronously in background task"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Generate professional 30-second 1080p MP4 video for product_id.
    Can be run synchronously or as a background task.
    """
    if background:
        background_tasks.add_task(generate_product_video, product_id, force=force)
        return {
            "status": "queued",
            "product_id": product_id,
            "message": "Video generation task scheduled in background."
        }
    
    try:
        result = generate_product_video(product_id, force=force)
        return result
    except VideoGenerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected video generation error: {str(e)}")

@router.delete("/{product_id}")
def remove_product_video(product_id: int):
    """Delete generated 30s video file and clear database reference."""
    try:
        return delete_product_video(product_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-generate")
def trigger_batch_generation(req: BatchGenerateRequest = Body(...)):
    """
    Start background batch generation for specified product IDs or all active products.
    """
    try:
        result = start_batch_generation(req.product_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batch-status")
def check_batch_progress():
    """Get live progress of the video generation batch queue."""
    try:
        return get_batch_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
