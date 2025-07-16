#!/usr/bin/env python3
"""
Production YOLO service for frame analysis
Provides REST API for analyzing video frames and detecting products
"""

import os
import sys
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import torch
from ultralytics import YOLO
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FrameAnalysisRequest(BaseModel):
    frame_path: str
    frame_index: int
    timestamp: float

class DetectedObject(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]

class FrameAnalysisResponse(BaseModel):
    frame_index: int
    timestamp: float
    has_product: bool
    quality_score: float
    brightness_score: float
    blur_score: float
    detected_objects: List[DetectedObject]

class YOLOService:
    def __init__(self, model_path: str = "yolov8n.pt", confidence_threshold: float = 0.5):
        """Initialize YOLO service with model loading"""
        self.confidence_threshold = confidence_threshold
        self.model_path = model_path
        self.model = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # Product-related class names from COCO dataset
        self.product_classes = {
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
            'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
            'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
            'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
            'toothbrush', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
            'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
            'tennis racket', 'backpack', 'umbrella', 'shoe'
        }
        
        self.load_model()
    
    def load_model(self):
        """Load YOLO model"""
        try:
            logger.info(f"Loading YOLO model: {self.model_path} on device: {self.device}")
            self.model = YOLO(self.model_path)
            self.model.to(self.device)
            logger.info("YOLO model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise
    
    def calculate_blur_score(self, image: np.ndarray) -> float:
        """Calculate blur score using Laplacian variance"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            # Normalize to 0-1 scale (higher = less blurry)
            blur_score = min(laplacian_var / 1000.0, 1.0)
            return blur_score
        except Exception as e:
            logger.warning(f"Failed to calculate blur score: {e}")
            return 0.5
    
    def calculate_brightness_score(self, image: np.ndarray) -> float:
        """Calculate brightness score"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            mean_brightness = np.mean(gray) / 255.0
            # Optimal brightness is around 0.4-0.7, penalize too dark or too bright
            if 0.3 <= mean_brightness <= 0.8:
                brightness_score = 1.0
            elif mean_brightness < 0.3:
                brightness_score = mean_brightness / 0.3
            else:
                brightness_score = (1.0 - mean_brightness) / 0.2
            return max(0.0, min(1.0, brightness_score))
        except Exception as e:
            logger.warning(f"Failed to calculate brightness score: {e}")
            return 0.5
    
    def analyze_frame(self, frame_path: str, frame_index: int, timestamp: float) -> FrameAnalysisResponse:
        """Analyze a single frame for product detection and quality"""
        try:
            # Load image
            if not os.path.exists(frame_path):
                raise FileNotFoundError(f"Frame not found: {frame_path}")
            
            image = cv2.imread(frame_path)
            if image is None:
                raise ValueError(f"Could not load image: {frame_path}")
            
            # Run YOLO detection
            results = self.model(image, conf=self.confidence_threshold, verbose=False)
            
            # Process detections
            detected_objects = []
            has_product = False
            
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        # Get class name
                        class_id = int(box.cls[0])
                        class_name = self.model.names[class_id]
                        confidence = float(box.conf[0])
                        
                        # Check if it's a product
                        if class_name in self.product_classes:
                            has_product = True
                        
                        # Get bounding box coordinates
                        bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                        
                        detected_objects.append(DetectedObject(
                            class_name=class_name,
                            confidence=confidence,
                            bbox=bbox
                        ))
            
            # Calculate quality metrics
            blur_score = self.calculate_blur_score(image)
            brightness_score = self.calculate_brightness_score(image)
            
            # Calculate overall quality score
            detection_score = 1.0 if has_product else 0.3
            quality_score = (detection_score * 0.4 + blur_score * 0.3 + brightness_score * 0.3)
            
            return FrameAnalysisResponse(
                frame_index=frame_index,
                timestamp=timestamp,
                has_product=has_product,
                quality_score=quality_score,
                brightness_score=brightness_score,
                blur_score=blur_score,
                detected_objects=detected_objects
            )
            
        except Exception as e:
            logger.error(f"Frame analysis failed for {frame_path}: {e}")
            # Return default response for failed analysis
            return FrameAnalysisResponse(
                frame_index=frame_index,
                timestamp=timestamp,
                has_product=False,
                quality_score=0.0,
                brightness_score=0.0,
                blur_score=0.0,
                detected_objects=[]
            )

# FastAPI app
app = FastAPI(title="YOLO Frame Analysis Service", version="1.0.0")
yolo_service = None

@app.on_event("startup")
async def startup_event():
    """Initialize YOLO service on startup"""
    global yolo_service
    model_path = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    confidence_threshold = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.5"))
    yolo_service = YOLOService(model_path, confidence_threshold)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": yolo_service is not None}

@app.post("/analyze", response_model=FrameAnalysisResponse)
async def analyze_frame(request: FrameAnalysisRequest):
    """Analyze a frame for product detection and quality"""
    if yolo_service is None:
        raise HTTPException(status_code=503, detail="YOLO service not initialized")
    
    try:
        result = yolo_service.analyze_frame(
            request.frame_path,
            request.frame_index,
            request.timestamp
        )
        return result
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/analyze_batch")
async def analyze_batch(requests: List[FrameAnalysisRequest]):
    """Analyze multiple frames in batch"""
    if yolo_service is None:
        raise HTTPException(status_code=503, detail="YOLO service not initialized")
    
    results = []
    for request in requests:
        try:
            result = yolo_service.analyze_frame(
                request.frame_path,
                request.frame_index,
                request.timestamp
            )
            results.append(result)
        except Exception as e:
            logger.error(f"Batch analysis failed for frame {request.frame_index}: {e}")
            # Add failed result
            results.append(FrameAnalysisResponse(
                frame_index=request.frame_index,
                timestamp=request.timestamp,
                has_product=False,
                quality_score=0.0,
                brightness_score=0.0,
                blur_score=0.0,
                detected_objects=[]
            ))
    
    return results

if __name__ == "__main__":
    port = int(os.getenv("YOLO_SERVICE_PORT", "8000"))
    host = os.getenv("YOLO_SERVICE_HOST", "0.0.0.0")
    
    logger.info(f"Starting YOLO service on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
