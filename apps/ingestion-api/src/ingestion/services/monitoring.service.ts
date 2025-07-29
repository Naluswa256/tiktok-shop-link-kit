import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';

export interface IngestionMetrics {
  shopsProcessed: number;
  videosFound: number;
  newVideosProcessed: number;
  eventsEmitted: number;
  errors: number;
  apifyUsage: number;
  duration: number;
}

export interface ErrorMetrics {
  errorType: string;
  shopHandle?: string;
  errorMessage: string;
  timestamp: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly namespace = 'TikTokCommerce/Ingestion';

  constructor(private readonly configService: ConfigService) {
    this.cloudWatchClient = new CloudWatchClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });
  }

  /**
   * Send ingestion metrics to CloudWatch
   */
  async sendIngestionMetrics(metrics: IngestionMetrics): Promise<void> {
    try {
      const metricData = [
        {
          MetricName: 'ShopsProcessed',
          Value: metrics.shopsProcessed,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
        },
        {
          MetricName: 'VideosFound',
          Value: metrics.videosFound,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
        },
        {
          MetricName: 'NewVideosProcessed',
          Value: metrics.newVideosProcessed,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
        },
        {
          MetricName: 'EventsEmitted',
          Value: metrics.eventsEmitted,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
        },
        {
          MetricName: 'Errors',
          Value: metrics.errors,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
        },
        {
          MetricName: 'ApifyUsage',
          Value: metrics.apifyUsage,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
        },
        {
          MetricName: 'Duration',
          Value: metrics.duration,
          Unit: StandardUnit.Milliseconds,
          Timestamp: new Date(),
        },
      ];

      await this.cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: metricData,
        })
      );

      this.logger.log('Ingestion metrics sent to CloudWatch');
    } catch (error) {
      this.logger.error('Failed to send metrics to CloudWatch', error);
      // Don't throw - metrics shouldn't break the main flow
    }
  }

  /**
   * Send error metrics to CloudWatch
   */
  async sendErrorMetrics(errorMetrics: ErrorMetrics): Promise<void> {
    try {
      const metricData = [
        {
          MetricName: 'IngestionErrors',
          Value: 1,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'ErrorType',
              Value: errorMetrics.errorType,
            },
            ...(errorMetrics.shopHandle ? [{
              Name: 'ShopHandle',
              Value: errorMetrics.shopHandle,
            }] : []),
          ],
        },
      ];

      await this.cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: metricData,
        })
      );

      this.logger.log(`Error metric sent: ${errorMetrics.errorType}`);
    } catch (error) {
      this.logger.error('Failed to send error metrics to CloudWatch', error);
    }
  }

  /**
   * Send custom metric to CloudWatch
   */
  async sendCustomMetric(
    metricName: string,
    value: number,
    unit: StandardUnit = StandardUnit.Count,
    dimensions: Array<{ Name: string; Value: string }> = []
  ): Promise<void> {
    try {
      await this.cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: [
            {
              MetricName: metricName,
              Value: value,
              Unit: unit,
              Timestamp: new Date(),
              Dimensions: dimensions,
            },
          ],
        })
      );

      this.logger.log(`Custom metric sent: ${metricName} = ${value}`);
    } catch (error) {
      this.logger.error(`Failed to send custom metric: ${metricName}`, error);
    }
  }

  /**
   * Log structured ingestion event for debugging
   */
  logIngestionEvent(
    event: string,
    data: any,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    const logData = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    switch (level) {
      case 'info':
        this.logger.log(JSON.stringify(logData));
        break;
      case 'warn':
        this.logger.warn(JSON.stringify(logData));
        break;
      case 'error':
        this.logger.error(JSON.stringify(logData));
        break;
    }
  }

  /**
   * Create CloudWatch dashboard URL for monitoring
   */
  getCloudWatchDashboardUrl(): string {
    const region = this.configService.get('AWS_REGION', 'us-east-1');
    return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=${this.namespace.replace('/', '-')}`;
  }
}
