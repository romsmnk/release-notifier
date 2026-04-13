import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      requireTls: true,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    } as any);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      logger.info({ to: options.to }, 'Email sent successfully');
      return true;
    } catch (error) {
      logger.error({ error, to: options.to }, 'Failed to send email');
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
      await this.transporter.verify();
      logger.info('Email service verified successfully');
      return true;
    } catch (error) {
      logger.error({ error }, 'Email service verification failed');
      return false;
    }
  }
}
