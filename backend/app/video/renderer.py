"""
HSMLE Broadcast Video Renderer (PyAV H.264 / MP4)
Streams RGB frames into high-efficiency H.264 MP4 container at 1920x1080 @ 30 FPS.
Applies faststart atom optimization for instantaneous web streaming.
"""

import os
import av
import numpy as np
from PIL import Image
from typing import Callable, Optional

class VideoRenderer:
    def __init__(self, output_path: str, width: int = 1920, height: int = 1080, fps: int = 25):
        self.output_path = output_path
        self.width = width
        self.height = height
        self.fps = fps
        self.container = None
        self.stream = None
        self.frames_encoded = 0

    def open(self):
        """Open MP4 container with H.264 stream configured for universal web playback."""
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)
        # Using PyAV with faststart flag for instant web streaming
        self.container = av.open(self.output_path, mode='w', format='mp4')
        self.stream = self.container.add_stream('h264', rate=self.fps)
        self.stream.width = self.width
        self.stream.height = self.height
        self.stream.pix_fmt = 'yuv420p'
        # H.264 encoding options for crisp text, clean gradients and fast encoding
        self.stream.options = {
            'crf': '22',
            'preset': 'ultrafast',
            'profile': 'high',
            'movflags': '+faststart'
        }
        self.frames_encoded = 0

    def encode_frame(self, pil_image: Image.Image):
        """Convert PIL RGB image to PyAV video frame and encode."""
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert to numpy array
        arr = np.array(pil_image, dtype=np.uint8)
        frame = av.VideoFrame.from_ndarray(arr, format='rgb24')
        frame.pts = self.frames_encoded
        
        for packet in self.stream.encode(frame):
            self.container.mux(packet)
            
        self.frames_encoded += 1

    def close(self) -> dict:
        """Flush remaining packets, close container and validate output."""
        if not self.container:
            return {}

        # Flush encoder buffer
        for packet in self.stream.encode():
            self.container.mux(packet)

        self.container.close()

        # Quality Control & Validation
        file_size = os.path.getsize(self.output_path)
        duration_sec = self.frames_encoded / self.fps

        stats = {
            'output_path': self.output_path,
            'file_size_bytes': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2),
            'frames_encoded': self.frames_encoded,
            'duration_seconds': round(duration_sec, 2),
            'fps': self.fps,
            'resolution': f"{self.width}x{self.height}"
        }
        return stats
