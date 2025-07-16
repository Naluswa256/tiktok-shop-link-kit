#!/usr/bin/env python3
"""
YOLO-based frame analyzer for thumbnail generation
Analyzes video frames to detect products and assess quality
"""

import sys
import json
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import logging

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Suppress YOLO verbose output

class FrameAnalyzer:
    def __init__(self, model_path: str, confidence_threshold: float = 0.5, iou_threshold: float = 0.5):
        """Initialize the YOLO model and thresholds"""
        try:
            # Use YOLOv8n (nano) for speed and efficiency
            if Path(model_path).exists():
                self.model = YOLO(model_path)
            else:
                # Download YOLOv8n if custom model not found
                self.model = YOLO('yolov8n.pt')
                
            self.confidence_threshold = confidence_threshold
            self.iou_threshold = iou_threshold
            
            # Product-related classes from COCO dataset
            self.product_classes = {
                'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
                'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
                'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
                'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
                'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
                'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
                'toothbrush', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
                'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
                'tennis racket', 'backpack', 'umbrella'
            }
            
        except Exception as e:
            raise RuntimeError(f"Failed to initialize YOLO model: {e}")

    def analyze_frame(self, image_path: str) -> dict:
        """Analyze a single frame and return quality metrics and detections"""
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Run YOLO detection
            results = self.model(image, conf=self.confidence_threshold, iou=self.iou_threshold, verbose=False)
            
            # Extract detections
            detected_objects = []
            has_product = False
            
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for i in range(len(boxes)):
                    # Get class name
                    class_id = int(boxes.cls[i])
                    class_name = self.model.names[class_id]
                    confidence = float(boxes.conf[i])
                    
                    # Get bounding box (normalized)
                    x1, y1, x2, y2 = boxes.xyxyn[i].tolist()
                    
                    detected_objects.append({
                        'class_name': class_name,
                        'confidence': confidence,
                        'bbox': {
                            'x': x1,
                            'y': y1,
                            'width': x2 - x1,
                            'height': y2 - y1
                        }
                    })
                    
                    # Check if it's a product-related object
                    if class_name in self.product_classes:
                        has_product = True
            
            # Calculate quality metrics
            quality_metrics = self._calculate_quality_metrics(image)
            
            # Calculate composition score based on detections
            composition_score = self._calculate_composition_score(detected_objects, image.shape)
            
            return {
                'detected_objects': detected_objects,
                'has_product': has_product,
                'quality_score': quality_metrics['overall_quality'],
                'blur_score': quality_metrics['blur_score'],
                'brightness_score': quality_metrics['brightness_score'],
                'composition_score': composition_score
            }
            
        except Exception as e:
            raise RuntimeError(f"Frame analysis failed: {e}")

    def _calculate_quality_metrics(self, image: np.ndarray) -> dict:
        """Calculate image quality metrics"""
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Calculate blur score using Laplacian variance
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        # Normalize blur score (higher variance = less blur)
        normalized_blur = min(blur_score / 1000.0, 1.0)  # Normalize to 0-1
        blur_score_final = 1.0 - normalized_blur  # Invert so lower is better
        
        # Calculate brightness score
        brightness = np.mean(gray) / 255.0
        # Optimal brightness is around 0.4-0.8
        if brightness < 0.2:
            brightness_score = brightness * 2.5  # Scale up dark images
        elif brightness > 0.8:
            brightness_score = (1.0 - brightness) * 5  # Scale down bright images
        else:
            brightness_score = 1.0  # Optimal range
        
        brightness_score = max(0.0, min(1.0, brightness_score))
        
        # Calculate contrast score
        contrast = gray.std() / 255.0
        contrast_score = min(contrast * 2, 1.0)  # Normalize to 0-1
        
        # Overall quality score
        overall_quality = (
            (1.0 - blur_score_final) * 0.4 +  # Less blur is better
            brightness_score * 0.3 +
            contrast_score * 0.3
        )
        
        return {
            'blur_score': blur_score_final,
            'brightness_score': brightness_score,
            'contrast_score': contrast_score,
            'overall_quality': overall_quality
        }

    def _calculate_composition_score(self, detected_objects: list, image_shape: tuple) -> float:
        """Calculate composition score based on object placement"""
        if not detected_objects:
            return 0.3  # Low score for no objects
        
        height, width = image_shape[:2]
        center_x, center_y = 0.5, 0.5
        
        composition_score = 0.0
        max_confidence = 0.0
        
        for obj in detected_objects:
            bbox = obj['bbox']
            confidence = obj['confidence']
            
            # Calculate object center
            obj_center_x = bbox['x'] + bbox['width'] / 2
            obj_center_y = bbox['y'] + bbox['height'] / 2
            
            # Distance from image center (rule of thirds consideration)
            distance_from_center = np.sqrt(
                (obj_center_x - center_x) ** 2 + (obj_center_y - center_y) ** 2
            )
            
            # Prefer objects not exactly in center but not too far
            center_score = 1.0 - min(distance_from_center * 2, 1.0)
            
            # Size score - prefer objects that are not too small or too large
            obj_area = bbox['width'] * bbox['height']
            if 0.1 <= obj_area <= 0.6:  # Good size range
                size_score = 1.0
            elif obj_area < 0.1:
                size_score = obj_area * 10  # Scale up small objects
            else:
                size_score = max(0.2, 1.0 - (obj_area - 0.6) * 2)  # Scale down large objects
            
            # Combined score for this object
            obj_score = (center_score * 0.4 + size_score * 0.6) * confidence
            composition_score = max(composition_score, obj_score)
            max_confidence = max(max_confidence, confidence)
        
        # Boost score if we have high-confidence detections
        if max_confidence > 0.8:
            composition_score *= 1.2
        
        return min(composition_score, 1.0)

def main():
    """Main function for command-line usage"""
    if len(sys.argv) != 5:
        print("Usage: python yolo_analyzer.py <image_path> <model_path> <confidence_threshold> <iou_threshold>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_path = sys.argv[2]
    confidence_threshold = float(sys.argv[3])
    iou_threshold = float(sys.argv[4])
    
    try:
        analyzer = FrameAnalyzer(model_path, confidence_threshold, iou_threshold)
        result = analyzer.analyze_frame(image_path)
        
        # Output JSON result
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'detected_objects': [],
            'has_product': False,
            'quality_score': 0.0,
            'blur_score': 1.0,
            'brightness_score': 0.0,
            'composition_score': 0.0
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
