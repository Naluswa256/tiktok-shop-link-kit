"""
TikTok Commerce Link Hub - Auto-Tagger AI Worker

This service processes TikTok content and generates:
- Relevant product tags
- Category classifications
- Trend analysis
- SEO-optimized keywords
- Content themes
"""

import json
import logging
import os
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass

import boto3
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.metrics import MetricUnit
from pydantic import BaseModel, ValidationError

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()
metrics = Metrics()

# Initialize AWS clients
sns_client = boto3.client('sns')
sqs_client = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')


class TikTokContentData(BaseModel):
    """Input data model for TikTok content processing"""
    video_id: str
    video_url: str
    caption: str
    existing_hashtags: List[str] = []
    user_id: Optional[str] = None
    processing_job_id: str
    caption_analysis: Optional[Dict[str, Any]] = None
    thumbnail_analysis: Optional[Dict[str, Any]] = None


class TaggingResult(BaseModel):
    """Output data model for auto-tagging"""
    video_id: str
    processing_job_id: str
    generated_tags: List[Dict[str, Any]]  # {tag, confidence, category}
    categories: List[Dict[str, Any]]  # {category, confidence}
    trending_tags: List[str]
    seo_keywords: List[str]
    content_themes: List[str]
    processing_timestamp: str
    confidence_score: float


@dataclass
class ProcessingConfig:
    """Configuration for auto-tagging processing"""
    openai_api_key: str = os.getenv('OPENAI_API_KEY', '')
    sns_topic_arn: str = os.getenv('SNS_TOPIC_ARN', '')
    tags_table: str = os.getenv('TAGS_TABLE', 'tiktok-tags')
    trends_table: str = os.getenv('TRENDS_TABLE', 'tiktok-trends')
    min_confidence: float = float(os.getenv('MIN_CONFIDENCE', '0.6'))
    max_tags: int = int(os.getenv('MAX_TAGS', '20'))


class AutoTagger:
    """Main auto-tagging service"""
    
    def __init__(self, config: ProcessingConfig):
        self.config = config
        self.logger = logger
        self.tags_table = dynamodb.Table(config.tags_table)
        self.trends_table = dynamodb.Table(config.trends_table)
    
    @tracer.capture_method
    def generate_tags(self, content_data: TikTokContentData) -> TaggingResult:
        """
        Generate tags and categories for TikTok content
        
        Args:
            content_data: TikTok content data
            
        Returns:
            TaggingResult: Generated tags and analysis
        """
        self.logger.info(f"Generating tags for video: {content_data.video_id}")
        
        try:
            # Extract tags from different sources
            caption_tags = self._extract_caption_tags(content_data.caption)
            ai_tags = self._generate_ai_tags(content_data)
            trending_tags = self._get_trending_tags()
            
            # Combine and rank tags
            all_tags = self._combine_and_rank_tags(caption_tags, ai_tags, trending_tags)
            
            # Generate categories
            categories = self._classify_content(content_data, all_tags)
            
            # Generate SEO keywords
            seo_keywords = self._generate_seo_keywords(content_data, all_tags)
            
            # Identify content themes
            content_themes = self._identify_themes(content_data, all_tags)
            
            result = TaggingResult(
                video_id=content_data.video_id,
                processing_job_id=content_data.processing_job_id,
                generated_tags=all_tags[:self.config.max_tags],
                categories=categories,
                trending_tags=trending_tags,
                seo_keywords=seo_keywords,
                content_themes=content_themes,
                processing_timestamp=self._get_timestamp(),
                confidence_score=self._calculate_overall_confidence(all_tags)
            )
            
            # Store tags for future trend analysis
            self._store_tags(result)
            
            metrics.add_metric(name="TagsGenerated", unit=MetricUnit.Count, value=len(all_tags))
            self.logger.info(f"Generated {len(all_tags)} tags for video: {content_data.video_id}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error generating tags: {str(e)}")
            metrics.add_metric(name="TagGenerationError", unit=MetricUnit.Count, value=1)
            raise
    
    @tracer.capture_method
    def _extract_caption_tags(self, caption: str) -> List[Dict[str, Any]]:
        """Extract tags from caption text"""
        try:
            # TODO: Implement sophisticated NLP processing
            # 1. Use spaCy for named entity recognition
            # 2. Extract product mentions
            # 3. Identify action words
            # 4. Find descriptive adjectives
            
            # Simple placeholder implementation
            words = caption.lower().split()
            common_product_words = [
                'dress', 'shirt', 'shoes', 'bag', 'jewelry', 'makeup',
                'skincare', 'fashion', 'style', 'outfit', 'accessories'
            ]
            
            tags = []
            for word in words:
                clean_word = word.strip('.,!?#@')
                if clean_word in common_product_words:
                    tags.append({
                        'tag': clean_word,
                        'confidence': 0.8,
                        'category': 'product',
                        'source': 'caption'
                    })
            
            return tags
            
        except Exception as e:
            self.logger.error(f"Error extracting caption tags: {str(e)}")
            return []
    
    @tracer.capture_method
    def _generate_ai_tags(self, content_data: TikTokContentData) -> List[Dict[str, Any]]:
        """Generate tags using AI models"""
        try:
            # TODO: Implement AI-based tag generation
            # 1. Use OpenAI for content analysis
            # 2. Apply pre-trained classification models
            # 3. Use image analysis if thumbnail available
            # 4. Leverage caption analysis results
            
            # Placeholder implementation
            ai_tags = [
                {'tag': 'trending', 'confidence': 0.7, 'category': 'trend', 'source': 'ai'},
                {'tag': 'viral', 'confidence': 0.6, 'category': 'engagement', 'source': 'ai'},
            ]
            
            return ai_tags
            
        except Exception as e:
            self.logger.error(f"Error generating AI tags: {str(e)}")
            return []
    
    @tracer.capture_method
    def _get_trending_tags(self) -> List[str]:
        """Get currently trending tags from database"""
        try:
            # TODO: Query trends table for current trending tags
            # 1. Get tags with high recent usage
            # 2. Consider time decay
            # 3. Filter by relevance
            
            # Placeholder trending tags
            return ['viral', 'trending', 'fyp', 'fashion', 'style']
            
        except Exception as e:
            self.logger.error(f"Error getting trending tags: {str(e)}")
            return []
    
    def _combine_and_rank_tags(self, *tag_lists) -> List[Dict[str, Any]]:
        """Combine tags from different sources and rank by confidence"""
        try:
            all_tags = []
            seen_tags = set()
            
            for tag_list in tag_lists:
                for tag_data in tag_list:
                    if isinstance(tag_data, str):
                        tag_data = {
                            'tag': tag_data,
                            'confidence': 0.5,
                            'category': 'general',
                            'source': 'trending'
                        }
                    
                    tag = tag_data['tag'].lower()
                    if tag not in seen_tags and tag_data['confidence'] >= self.config.min_confidence:
                        all_tags.append(tag_data)
                        seen_tags.add(tag)
            
            # Sort by confidence
            return sorted(all_tags, key=lambda x: x['confidence'], reverse=True)
            
        except Exception as e:
            self.logger.error(f"Error combining tags: {str(e)}")
            return []
    
    def _classify_content(self, content_data: TikTokContentData, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Classify content into categories"""
        try:
            # TODO: Implement content classification
            # 1. Analyze tags and caption
            # 2. Use ML models for classification
            # 3. Consider user behavior patterns
            
            categories = [
                {'category': 'fashion', 'confidence': 0.8},
                {'category': 'lifestyle', 'confidence': 0.6},
            ]
            
            return categories
            
        except Exception as e:
            self.logger.error(f"Error classifying content: {str(e)}")
            return []
    
    def _generate_seo_keywords(self, content_data: TikTokContentData, tags: List[Dict[str, Any]]) -> List[str]:
        """Generate SEO-optimized keywords"""
        try:
            # TODO: Implement SEO keyword generation
            # 1. Combine high-confidence tags
            # 2. Add long-tail keywords
            # 3. Consider search volume and competition
            
            keywords = [tag['tag'] for tag in tags[:10]]
            return keywords
            
        except Exception as e:
            self.logger.error(f"Error generating SEO keywords: {str(e)}")
            return []
    
    def _identify_themes(self, content_data: TikTokContentData, tags: List[Dict[str, Any]]) -> List[str]:
        """Identify content themes"""
        try:
            # TODO: Implement theme identification
            # 1. Group related tags
            # 2. Identify overarching themes
            # 3. Consider seasonal trends
            
            themes = ['fashion', 'lifestyle']
            return themes
            
        except Exception as e:
            self.logger.error(f"Error identifying themes: {str(e)}")
            return []
    
    def _calculate_overall_confidence(self, tags: List[Dict[str, Any]]) -> float:
        """Calculate overall confidence score"""
        if not tags:
            return 0.0
        
        total_confidence = sum(tag['confidence'] for tag in tags)
        return min(total_confidence / len(tags), 1.0)
    
    @tracer.capture_method
    def _store_tags(self, result: TaggingResult) -> None:
        """Store tags for trend analysis"""
        try:
            # Store in tags table for analytics
            for tag_data in result.generated_tags:
                self.tags_table.put_item(
                    Item={
                        'tag': tag_data['tag'],
                        'video_id': result.video_id,
                        'timestamp': result.processing_timestamp,
                        'confidence': tag_data['confidence'],
                        'category': tag_data['category']
                    }
                )
            
        except Exception as e:
            self.logger.error(f"Error storing tags: {str(e)}")
    
    @tracer.capture_method
    def publish_results(self, result: TaggingResult) -> None:
        """Publish processing results to SNS topic"""
        try:
            message = {
                'type': 'auto_tagging_complete',
                'data': result.model_dump()
            }
            
            sns_client.publish(
                TopicArn=self.config.sns_topic_arn,
                Message=json.dumps(message),
                Subject=f'Auto-Tagging Complete - {result.video_id}'
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
    AWS Lambda handler for auto-tagging
    
    Args:
        event: SQS event containing TikTok content data
        context: Lambda context
        
    Returns:
        Processing result
    """
    config = ProcessingConfig()
    tagger = AutoTagger(config)
    
    try:
        # Process SQS messages
        for record in event.get('Records', []):
            try:
                # Parse SQS message
                message_body = json.loads(record['body'])
                content_data = TikTokContentData(**message_body)
                
                # Generate tags
                result = tagger.generate_tags(content_data)
                
                # Publish results
                tagger.publish_results(result)
                
                logger.info(f"Successfully processed video: {content_data.video_id}")
                
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
                'caption': 'Check out this amazing summer dress! Perfect for any occasion 🌞 #fashion #style',
                'existing_hashtags': ['fashion', 'style'],
                'processing_job_id': 'job_123'
            })
        }]
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
