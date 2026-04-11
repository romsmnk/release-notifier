import { config } from '../config';
import { logger } from '../config/logger';
import { SubscriptionService } from './subscription';

export class ReleaseScanner {
  private readonly subscriptionService: SubscriptionService;
  private scanInterval: NodeJS.Timeout | null = null;
  private isScanning = false;

  constructor(subscriptionService: SubscriptionService) {
    this.subscriptionService = subscriptionService;
  }

  start(): void {
    if (this.scanInterval) {
      logger.warn('Scanner is already running');
      return;
    }

    logger.info({ interval: config.scannerInterval }, 'Starting release scanner');

    this.runScan();

    this.scanInterval = setInterval(() => {
      this.runScan();
    }, config.scannerInterval);
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      logger.info('Release scanner stopped');
    }
  }

  private async runScan(): Promise<void> {
    if (this.isScanning) {
      logger.warn('Scan already in progress, skipping');
      return;
    }

    this.isScanning = true;
    const startTime = Date.now();

    try {
      await this.subscriptionService.scanAndNotifyNewReleases();
      const duration = Date.now() - startTime;
      logger.info({ duration: `${duration}ms` }, 'Scan cycle completed');
    } catch (error) {
      logger.error({ error }, 'Scan cycle failed');
    } finally {
      this.isScanning = false;
    }
  }

  isRunning(): boolean {
    return this.scanInterval !== null;
  }
}
