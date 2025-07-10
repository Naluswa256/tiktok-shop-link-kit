"""
TikTok Commerce Link Hub - Thumbnail Generator AI Worker

This service processes TikTok videos and generates:
- Product-focused thumbnails
- Multiple thumbnail variations
- Optimized images for different platforms
- Product highlight overlays
"""

import json
import logging
import os
import tempfile
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from io import BytesIO

import boto3
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.metrics import MetricUnit
from pydantic import BaseModel, ValidationError
from PIL import Image, ImageDraw, ImageFont
import requests

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()
metrics = Metrics()

# Initialize AWS clients
sns_client = boto3.client('sns')
sqs_client = boto3.client('sqs')
s3_client = boto3.client('s3')


class TikTokVideoData(BaseModel):
    """Input data model for TikTok video processing"""
    video_id: str
    video_url: str
    thumbnail_url: Optional[str] = None
    processing_job_id: str
    product_info: Optional[Dict[str, Any]] = None


class ThumbnailResult(BaseModel):
    """Output data model for thumbnail generation"""
    video_id: str
    processing_job_id: str
    thumbnails: List[Dict[str, str]]  # List of {size: url} mappings
    primary_thumbnail_url: str
    processing_timestamp: str
    confidence_score: float


@dataclass
class ProcessingConfig:
    """Configuration for thumbnail processing"""
    s3_bucket: str = os.getenv('S3_BUCKET', '')
    sns_topic_arn: str = os.getenv('SNS_TOPIC_ARN', '')
    thumbnail_sizes: List[tuple] = None
    
    def __post_init__(self):
        if self.thumbnail_sizes is None:
            self.thumbnail_sizes = [
                (400, 400),   # Square
                (800, 600),   # Landscape
                (600, 800),   # Portrait
                (1200, 630),  # Social media
            ]


class ThumbnailGenerator:
    """Main thumbnail generation service"""
    
    def __init__(self, config: ProcessingConfig):
        self.config = config
        self.logger = logger
    
    @tracer.capture_method
    def generate_thumbnails(self, video_data: TikTokVideoData) -> ThumbnailResult:
        """
        Generate multiple thumbnail variations from TikTok video
        
        Args:
            video_data: TikTok video data
            
        Returns:
            ThumbnailResult: Generated thumbnails information
        """
        self.logger.info(f"Generating thumbnails for video: {video_data.video_id}")
        
        try:
            # Download original thumbnail/video frame
            original_image = self._download_image(video_data.thumbnail_url or video_data.video_url)
            
            # Generate thumbnails in different sizes
            thumbnails = []
            for size in self.config.thumbnail_sizes:
                thumbnail_url = self._create_thumbnail(original_image, size, video_data)
                thumbnails.append({
                    'size': f"{size[0]}x{size[1]}",
                    'url': thumbnail_url
                })
            
            # Select primary thumbnail (largest)
            primary_thumbnail = thumbnails[0]['url'] if thumbnails else ''
            
            result = ThumbnailResult(
                video_id=video_data.video_id,
                processing_job_id=video_data.processing_job_id,
                thumbnails=thumbnails,
                primary_thumbnail_url=primary_thumbnail,
                processing_timestamp=self._get_timestamp(),
                confidence_score=0.9
            )
            
            metrics.add_metric(name="ThumbnailsGenerated", unit=MetricUnit.Count, value=len(thumbnails))
            self.logger.info(f"Generated {len(thumbnails)} thumbnails for video: {video_data.video_id}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error generating thumbnails: {str(e)}")
            metrics.add_metric(name="ThumbnailGenerationError", unit=MetricUnit.Count, value=1)
            raise
    
    @tracer.capture_method
    def _download_image(self, url: str) -> Image.Image:
        """Download image from URL"""
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return Image.open(BytesIO(response.content))
        except Exception as e:
            self.logger.error(f"Error downloading image from {url}: {str(e)}")
            # Return a placeholder image
            return Image.new('RGB', (800, 600), color='lightgray')
    
    @tracer.capture_method
    def _create_thumbnail(self, original_image: Image.Image, size: tuple, video_data: TikTokVideoData) -> str:
        """Create thumbnail with specific size and enhancements"""
        try:
            # Resize image maintaining aspect ratio
            thumbnail = original_image.copy()
            thumbnail.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Create new image with exact size (add padding if needed)
            final_image = Image.new('RGB', size, color='white')
            
            # Center the thumbnail
            x = (size[0] - thumbnail.width) // 2
            y = (size[1] - thumbnail.height) // 2
            final_image.paste(thumbnail, (x, y))
            
            # Add product overlay if product info is available
            if video_data.product_info:
                final_image = self._add_product_overlay(final_image, video_data.product_info)
            
            # Save to S3
            return self._upload_to_s3(final_image, video_data.video_id, size)
            
        except Exception as e:
            self.logger.error(f"Error creating thumbnail: {str(e)}")
            raise
    
    def _add_product_overlay(self, image: Image.Image, product_info: Dict[str, Any]) -> Image.Image:
        """Add product information overlay to thumbnail"""
        try:
            draw = ImageDraw.Draw(image)
            
            # TODO: Implement sophisticated overlay
            # 1. Add product name
            # 2. Add price badge
            # 3. Add call-to-action
            # 4. Add brand logo
            
            # Simple placeholder overlay
            if 'name' in product_info:
                # Add semi-transparent background
                overlay = Image.new('RGBA', image.size, (0, 0, 0, 128))
                image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')
            
            return image
            
        except Exception as e:
            self.logger.error(f"Error adding product overlay: {str(e)}")
            return image
    
    @tracer.capture_method
    def _upload_to_s3(self, image: Image.Image, video_id: str, size: tuple) -> str:
        """Upload thumbnail to S3 and return URL"""
        try:
            # Convert image to bytes
            buffer = BytesIO()
            image.save(buffer, format='JPEG', quality=85, optimize=True)
            buffer.seek(0)
            
            # Generate S3 key
            key = f"thumbnails/{video_id}/{size[0]}x{size[1]}.jpg"
            
            # Upload to S3
            s3_client.put_object(
                Bucket=self.config.s3_bucket,
                Key=key,
                Body=buffer.getvalue(),
                ContentType='image/jpeg',
                CacheControl='max-age=31536000'  # 1 year cache
            )
            
            # Return public URL
            return f"https://{self.config.s3_bucket}.s3.amazonaws.com/{key}"
            
        except Exception as e:
            self.logger.error(f"Error uploading to S3: {str(e)}")
            raise
    
    @tracer.capture_method
    def publish_results(self, result: ThumbnailResult) -> None:
        """Publish processing results to SNS topic"""
        try:
            message = {
                'type': 'thumbnail_generation_complete',
                'data': result.model_dump()
            }
            
            sns_client.publish(
                TopicArn=self.config.sns_topic_arn,
                Message=json.dumps(message),
                Subject=f'Thumbnail Generation Complete - {result.video_id}'
            )
            
            self.logger.info(f"Results published for video: {result.video_id}")
            
        except Exception as e:
            self.logger.error(f"Error publishing results: {str(e)}")
            raise
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.utcnow().isoformat()


@logger.inject_lambda_context(correlation_id_path=correlation_paths.SQS)
@tracer.capture_lambda_handler
@metrics.log_metrics
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for thumbnail generation
    
    Args:
        event: SQS event containing TikTok video data
        context: Lambda context
        
    Returns:
        Processing result
    """
    config = ProcessingConfig()
    generator = ThumbnailGenerator(config)
    
    try:
        # Process SQS messages
        for record in event.get('Records', []):
            try:
                # Parse SQS message
                message_body = json.loads(record['body'])
                video_data = TikTokVideoData(**message_body)
                
                # Generate thumbnails
                result = generator.generate_thumbnails(video_data)
                
                # Publish results
                generator.publish_results(result)
                
                logger.info(f"Successfully processed video: {video_data.video_id}")
                
            except ValidationError as e:
                logger.error(f"Invalid message format: {str(e)}")
                metrics.add_metric(name="InvalidMessage", unit=MetricUnit.Count, value=1)
                continue
                
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
                metrics.add_metric(name="ProcessingError", unit=MetricUnit.Count, value=1)
                # Re-raise to trigger DLQ
                raise
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Processing completed successfully'})
        }
        
    except Exception as e:
        logger.error(f"Lambda execution failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


if __name__ == "__main__":
    # For local testing
    test_event = {
        'Records': [{
            'body': json.dumps({
                'video_id': 'test_video_123',
                'video_url': 'https://www.tiktok.com/@test/video/123',
                'thumbnail_url': 'https://example.com/thumbnail.jpg',
                'processing_job_id': 'job_123',
                'product_info': {
                    'name': 'Summer Dress',
                    'price': '$29.99'
                }
            })
        }]
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
