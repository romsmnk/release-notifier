import { config } from '../config';
import { logger } from '../config/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private readonly apiToken: string;
  private readonly from: string;
  private readonly apiUrl = 'https://send.api.mailtrap.io/api/send';

  constructor() {
    this.apiToken = config.email.password || '';
    this.from = config.email.from;

    logger.info({
      apiUrl: this.apiUrl,
      from: this.from,
      tokenLength: this.apiToken?.length || 0,
    }, 'Initializing Mailtrap HTTP API email service');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: {
            email: this.from,
            name: 'Release Notifier',
          },
          to: [
            {
              email: options.to,
            },
          ],
          subject: options.subject,
          html: options.html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          to: options.to,
          subject: options.subject,
          statusCode: response.status,
          statusText: response.statusText,
          errorBody: errorText,
        }, 'Failed to send email via Mailtrap API');
        return false;
      }

      logger.info({
        to: options.to,
        subject: options.subject,
      }, 'Email sent successfully via Mailtrap API');
      return true;
    } catch (error: any) {
      logger.error({
        to: options.to,
        subject: options.subject,
        errorMessage: error?.message,
        errorCode: error?.code,
        fullError: error,
      }, 'Failed to send email - network error');
      return false;
    }
  }

  async sendReleaseNotification(
    email: string,
    repositoryName: string,
    releaseName: string,
    releaseUrl: string
  ): Promise<boolean> {
    const html = `
      <h2>New Release: ${repositoryName}</h2>
      <p>A new release is available:</p>
      <h3>${releaseName}</h3>
      <p>
        <a href="${releaseUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0366d6; color: white; text-decoration: none; border-radius: 4px;">
          View Release
        </a>
      </p>
      <p>
        <small>You received this email because you subscribed to updates from <strong>${repositoryName}</strong></small>
      </p>
    `;

    return this.sendEmail({
      to: email,
      subject: `New Release: ${repositoryName} - ${releaseName}`,
      html,
    });
  }

  async sendConfirmationEmail(email: string, repositoryName: string, confirmUrl: string): Promise<boolean> {
    const html = `
      <h2>Confirm Your Subscription</h2>
      <p>You have requested to subscribe to release notifications for <strong>${repositoryName}</strong>.</p>
      <p>
        <a href="${confirmUrl}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px;">
          Confirm Subscription
        </a>
      </p>
      <p>Or copy this link: <code>${confirmUrl}</code></p>
      <p>
        <small>If you did not request this subscription, you can safely ignore this email.</small>
      </p>
    `;

    return this.sendEmail({
      to: email,
      subject: `Confirm Subscription: ${repositoryName}`,
      html,
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const testEmail = 'delivery@mailtrap.io';
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: {
            email: this.from,
            name: 'Release Notifier',
          },
          to: [
            {
              email: testEmail,
            },
          ],
          subject: 'Email Service Verification',
          html: '<p>This is a test email to verify the email service is working.</p>',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          statusCode: response.status,
          statusText: response.statusText,
          errorBody: errorText,
        }, 'Email service verification failed');
        return false;
      }

      logger.info('Email service verified successfully via Mailtrap API');
      return true;
    } catch (error: any) {
      logger.error({
        errorMessage: error?.message,
        errorCode: error?.code,
      }, 'Email service verification error');
      return false;
    }
  }
}
