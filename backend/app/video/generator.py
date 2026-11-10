"""
HSMLE Product Video Generator Engine & Batch Dispatcher
Orchestrates 30-second video creation, caching, quality validation, and queue management.
"""

import os
import sqlite3
import threading
import time
from typing import Dict, Any, Optional, List, Callable
from PIL import Image
import numpy as np

from .specifications import get_product_data
from .scenes import SceneDirector, TOTAL_FRAMES
from .renderer import VideoRenderer

class VideoGenerationError(Exception):
    pass

# Global Batch State Tracker
batch_state = {
    'is_running': False,
    'total': 0,
    'completed': 0,
    'failed': 0,
    'queued': 0,
    'current_id': None,
    'current_name': '',
    'progress_percent': 0,
    'errors': []
}
batch_lock = threading.Lock()

def get_base_dirs():
    """Get absolute paths to project directories."""
    app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backend_dir = os.path.dirname(app_dir)
    static_videos_dir = os.path.join(backend_dir, 'static', 'videos')
    db_path = os.path.join(backend_dir, 'data', 'hsmle.db')
    return backend_dir, static_videos_dir, db_path

def get_product_image_path(image_url: str, backend_dir: str) -> Optional[str]:
    """Resolve local filesystem path for product image."""
    if not image_url:
        return None
    # Strip leading slash
    clean_url = image_url.lstrip('/')
    local_path = os.path.join(backend_dir, clean_url)
    if os.path.exists(local_path):
        return local_path
    
    # Check alternate static directory
    alt_path = os.path.join(backend_dir, 'static', 'images', 'products', os.path.basename(image_url))
    if os.path.exists(alt_path):
        return alt_path
        
    return None

def prepare_machine_cutout(img_path: str) -> Image.Image:
    """
    Load machine image, trim exterior white padding, and preserve
    all machine casing, dials, and hardware without internal transparency holes.
    Uses fast C++ connected-components instead of Python pixel BFS.
    """
    import cv2
    bgr = cv2.imread(img_path)
    if bgr is None:
        im = Image.open(img_path).convert('RGBA')
        arr = np.array(im)
        rgb = arr[:, :, :3]
    else:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    h, w = rgb.shape[:2]
    mask = (rgb[:, :, 0] < 246) | (rgb[:, :, 1] < 246) | (rgb[:, :, 2] < 246)
    ys, xs = np.where(mask)
    if len(ys) > 0:
        pad = max(4, int(max(ys.max() - ys.min(), xs.max() - xs.min()) * 0.01))
        y0 = max(0, int(ys.min()) - pad)
        y1 = min(h, int(ys.max()) + 1 + pad)
        x0 = max(0, int(xs.min()) - pad)
        x1 = min(w, int(xs.max()) + 1 + pad)
        rgb = rgb[y0:y1, x0:x1]

    is_white = ((rgb[:, :, 0] >= 244) & (rgb[:, :, 1] >= 244) & (rgb[:, :, 2] >= 244)).astype(np.uint8)
    padded = np.pad(is_white, 1, mode='constant', constant_values=1)
    _, labels = cv2.connectedComponents(padded, connectivity=4)
    bg_mask = (labels[1:-1, 1:-1] == labels[0, 0])
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')

def generate_product_video(
    product_id: int,
    force: bool = False,
    on_progress: Optional[Callable[[int, int], None]] = None
) -> Dict[str, Any]:
    """
    Generate professional 30-second 1080p MP4 video for product_id.
    Validates output and updates database reference upon completion.
    """
    backend_dir, static_videos_dir, db_path = get_base_dirs()
    output_filename = f"{product_id}.mp4"
    output_path = os.path.join(static_videos_dir, output_filename)
    public_url = f"/static/videos/{output_filename}"

    # Cache Check
    if not force and os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        if file_size > 100000: # Valid non-empty video (>100KB)
            return {
                'status': 'cached',
                'product_id': product_id,
                'video_url': public_url,
                'file_size_bytes': file_size,
                'file_size_mb': round(file_size / (1024 * 1024), 2),
                'duration_seconds': 30.0,
                'message': 'Loaded existing cached 30-second product video.'
            }

    # 1. Load Product Data from Database
    try:
        product_data = get_product_data(product_id, db_path=db_path)
    except Exception as e:
        raise VideoGenerationError(f"Failed to load product specifications: {e}")

    # 2. Resolve & Prepare Machine Image
    img_path = get_product_image_path(product_data.get('image_url', ''), backend_dir)
    if not img_path:
        raise VideoGenerationError(f"Product image not found for Product #{product_id}")

    try:
        machine_cutout = prepare_machine_cutout(img_path)
    except Exception as e:
        raise VideoGenerationError(f"Error preparing machine image: {e}")

    # 3. Initialize Scene Director & Renderer
    director = SceneDirector(product_data, machine_cutout)
    renderer = VideoRenderer(output_path=output_path, width=1920, height=1080, fps=25)
    renderer.open()

    # 4. Render All 900 Frames (30.0s @ 30 FPS)
    t0 = time.time()
    try:
        for f in range(TOTAL_FRAMES):
            frame = director.render_frame(f)
            renderer.encode_frame(frame)
            if on_progress and (f % 30 == 0 or f == TOTAL_FRAMES - 1):
                on_progress(f + 1, TOTAL_FRAMES)
        stats = renderer.close()
    except Exception as e:
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        raise VideoGenerationError(f"Rendering failed during frame encoding: {e}")

    render_time = round(time.time() - t0, 1)

    # 5. Quality Control Validation
    if stats['file_size_bytes'] < 50000:
        raise VideoGenerationError("Generated video file size is invalid (under 50KB)")
    if abs(stats['duration_seconds'] - 30.0) > 1.0:
        raise VideoGenerationError(f"Generated video duration ({stats['duration_seconds']}s) is outside target 29-31s")

    # 6. Update Product in Database
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("UPDATE products SET video_url = ?, updated_at = datetime('now') WHERE id = ?", (public_url, product_id))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: Failed to update video_url in database: {e}")

    return {
        'status': 'generated',
        'product_id': product_id,
        'product_name': product_data['product_name'],
        'model_number': product_data.get('model_number'),
        'video_url': public_url,
        'duration_seconds': stats['duration_seconds'],
        'resolution': stats['resolution'],
        'fps': stats['fps'],
        'file_size_mb': stats['file_size_mb'],
        'render_time_sec': render_time,
        'message': f"30-second broadcast video successfully rendered in {render_time}s."
    }

def get_video_status(product_id: int) -> Dict[str, Any]:
    """Check status of video for product_id."""
    backend_dir, static_videos_dir, db_path = get_base_dirs()
    output_filename = f"{product_id}.mp4"
    output_path = os.path.join(static_videos_dir, output_filename)
    public_url = f"/static/videos/{output_filename}"

    exists = os.path.exists(output_path)
    file_size = os.path.getsize(output_path) if exists else 0

    return {
        'product_id': product_id,
        'has_video': exists,
        'video_url': public_url if exists else None,
        'file_size_mb': round(file_size / (1024 * 1024), 2) if exists else 0,
        'duration_seconds': 30.0 if exists else 0
    }

def delete_product_video(product_id: int) -> Dict[str, Any]:
    """Delete video file and clear database reference."""
    backend_dir, static_videos_dir, db_path = get_base_dirs()
    output_filename = f"{product_id}.mp4"
    output_path = os.path.join(static_videos_dir, output_filename)

    deleted = False
    if os.path.exists(output_path):
        os.remove(output_path)
        deleted = True

    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("UPDATE products SET video_url = NULL WHERE id = ? AND video_url LIKE '%/videos/%'", (product_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Warning clearing DB video_url:", e)

    return {
        'product_id': product_id,
        'deleted': deleted,
        'message': 'Video successfully removed.'
    }

def _batch_worker(product_ids: List[int]):
    """Background worker thread for processing batches sequentially."""
    global batch_state
    for pid in product_ids:
        with batch_lock:
            batch_state['current_id'] = pid
            batch_state['current_name'] = f"Machine #{pid}"
            batch_state['queued'] = len(product_ids) - (batch_state['completed'] + batch_state['failed'])

        try:
            res = generate_product_video(pid, force=True)
            with batch_lock:
                batch_state['completed'] += 1
                batch_state['progress_percent'] = int((batch_state['completed'] + batch_state['failed']) / batch_state['total'] * 100)
        except Exception as e:
            with batch_lock:
                batch_state['failed'] += 1
                batch_state['errors'].append({'product_id': pid, 'error': str(e)})

    with batch_lock:
        batch_state['is_running'] = False
        batch_state['current_id'] = None
        batch_state['current_name'] = ''

def start_batch_generation(product_ids: Optional[List[int]] = None) -> Dict[str, Any]:
    """Start queued background batch generation."""
    global batch_state
    with batch_lock:
        if batch_state['is_running']:
            return {'status': 'busy', 'message': 'A batch generation job is already running.'}

        backend_dir, static_videos_dir, db_path = get_base_dirs()
        if not product_ids:
            # Query all active product IDs from database
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("SELECT id FROM products WHERE is_active = 1 ORDER BY id ASC")
            product_ids = [r[0] for r in c.fetchall()]
            conn.close()

        batch_state = {
            'is_running': True,
            'total': len(product_ids),
            'completed': 0,
            'failed': 0,
            'queued': len(product_ids),
            'current_id': None,
            'current_name': '',
            'progress_percent': 0,
            'errors': []
        }

    # Start background daemon thread
    thread = threading.Thread(target=_batch_worker, args=(product_ids,), daemon=True)
    thread.start()

    return {
        'status': 'started',
        'total_queued': len(product_ids),
        'message': f"Queued {len(product_ids)} machine videos for background processing."
    }

def get_batch_status() -> Dict[str, Any]:
    """Return live status of the batch generation queue."""
    with batch_lock:
        return dict(batch_state)
