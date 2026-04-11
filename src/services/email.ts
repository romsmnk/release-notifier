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
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
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
