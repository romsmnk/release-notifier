import { randomBytes } from 'node:crypto';
import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import { EmailService } from './email';
import { GitHubApiClient, InvalidRepositoryFormatError, RepositoryNotFoundError } from './github';

export interface ReleaseInfo {
  tag: string;
  name: string;
  url: string;
}

export class SubscriptionService {
  private readonly githubClient: GitHubApiClient;
  private readonly emailService: EmailService;

  constructor(githubClient: GitHubApiClient, emailService: EmailService) {
    this.githubClient = githubClient;
    this.emailService = emailService;
  }

  validateRepositoryFormat(fullName: string): { owner: string; repo: string } {
    const parts = fullName.trim().split('/');

    if (parts.length !== 2) {
      throw new InvalidRepositoryFormatError(
        'Repository format must be owner/repo (e.g., golang/go)'
      );
    }

    const [owner, repo] = parts;

    if (!owner || !repo) {
      throw new InvalidRepositoryFormatError('Repository owner and name cannot be empty');
    }

    return { owner, repo };
  }

  async subscribeToRepository(email: string, fullName: string) {
    const { owner, repo } = this.validateRepositoryFormat(fullName);

    const githubRepo = await this.githubClient.getRepository(owner, repo);

    if (!githubRepo) {
      throw new RepositoryNotFoundError(`Repository ${fullName} not found on GitHub`);
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email },
      });
      logger.info({ email }, 'New user created');
    }

    let dbRepository = await prisma.repository.findUnique({
      where: { fullName },
    });

    if (!dbRepository) {
      dbRepository = await prisma.repository.create({
        data: {
          owner,
          name: repo,
          fullName,
        },
      });
      logger.info({ fullName }, 'New repository added to database');
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        userId_repositoryId: {
          userId: user.id,
          repositoryId: dbRepository.id,
        },
      },
    });

    const confirmToken = randomBytes(32).toString('hex');
    const unsubscribeToken = randomBytes(32).toString('hex');

    if (existingSubscription) {
      if (existingSubscription.isActive) {
        throw new Error('Email already subscribed to this repository');
      }

      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          confirmToken,
          unsubscribeToken,
          isActive: false,
          confirmedAt: null,
        },
      });
      logger.info({ email, fullName }, 'Subscription tokens regenerated');
    } else {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          repositoryId: dbRepository.id,
          isActive: false,
          confirmToken,
          unsubscribeToken,
        },
      });
      logger.info({ email, fullName }, 'New subscription created with confirmation pending');
    }

    const confirmUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/confirm/${confirmToken}`;
    const emailSent = await this.emailService.sendConfirmationEmail(
      email,
      fullName,
      confirmUrl
    );

    if (!emailSent) {
      logger.warn({ email }, 'Failed to send confirmation email');
    }

    return { success: true, message: 'Confirmation email sent' };
  }

  async unsubscribeFromRepository(email: string, fullName: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const repository = await prisma.repository.findUnique({
      where: { fullName },
    });

    if (!repository) {
      throw new Error('Repository not found');
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        userId_repositoryId: {
          userId: user.id,
          repositoryId: repository.id,
        },
      },
    });

    if (!subscription?.isActive) {
      throw new Error('Subscription not found or already inactive');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { isActive: false },
    });

    logger.info({ email, fullName }, 'Subscription deactivated');
    return { success: true };
  }

  async confirmSubscription(token: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { confirmToken: token },
      include: {
        user: true,
        repository: true,
      },
    });

    if (!subscription) {
      throw new Error('Invalid or expired confirmation token');
    }

    if (subscription.isActive) {
      throw new Error('Subscription already confirmed');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        isActive: true,
        confirmedAt: new Date(),
        confirmToken: null,
      },
    });

    logger.info(
      { email: subscription.user.email, repository: subscription.repository.fullName },
      'Subscription confirmed'
    );

    return {
      success: true,
      message: `Successfully confirmed subscription to ${subscription.repository.fullName}`,
      repository: subscription.repository.fullName,
    };
  }

  async unsubscribeByToken(token: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { unsubscribeToken: token },
      include: {
        user: true,
        repository: true,
      },
    });

    if (!subscription) {
      throw new Error('Invalid or expired unsubscribe token');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { isActive: false },
    });

    logger.info(
      { email: subscription.user.email, repository: subscription.repository.fullName },
      'Unsubscribed via token'
    );

    return {
      success: true,
      message: `Successfully unsubscribed from ${subscription.repository.fullName}`,
      repository: subscription.repository.fullName,
    };
  }

  async getUserSubscriptions(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        subscriptions: {
          where: { isActive: true },
          include: {
            repository: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return user.subscriptions.map((sub: any) => ({
      email: user.email,
      repo: sub.repository.fullName,
      confirmed: sub.confirmedAt !== null,
      last_seen_tag: sub.repository.lastSeenTag,
    }));
  }

  async scanAndNotifyNewReleases() {
    logger.info('Starting release scan');

    const subscriptions = await prisma.subscription.findMany({
      where: { isActive: true },
      include: {
        user: true,
        repository: true,
      },
    });

    logger.info({ count: subscriptions.length }, 'Processing subscriptions');

    for (const subscription of subscriptions) {
      try {
        await this.checkAndNotifyNewReleases(subscription);
      } catch (error) {
        logger.error({ subscriptionId: subscription.id, error }, 'Error processing subscription');
      }
    }

    logger.info('Release scan completed');
  }

  private async checkAndNotifyNewReleases(subscription: any) {
    const { user, repository } = subscription;

    try {
      const releases = await this.githubClient.getLatestReleases(repository.owner, repository.name);

      if (releases.length === 0) {
        return;
      }

      const latestRelease = releases.find((r) => !r.draft && !r.prerelease) || releases[0];

      if (!latestRelease) {
        return;
      }

      if (repository.lastSeenTag === latestRelease.tag_name) {
        return;
      }

      const emailSent = await this.emailService.sendReleaseNotification(
        user.email,
        repository.fullName,
        latestRelease.name || latestRelease.tag_name,
        latestRelease.html_url
      );

      if (emailSent) {
        await prisma.repository.update({
          where: { id: repository.id },
          data: { lastSeenTag: latestRelease.tag_name },
        });

        await prisma.notificationLog.create({
          data: {
            subscriptionId: subscription.id,
            repositoryId: repository.id,
            releaseTag: latestRelease.tag_name,
            releaseUrl: latestRelease.html_url,
          },
        });

        logger.info(
          {
            email: user.email,
            repository: repository.fullName,
            releaseTag: latestRelease.tag_name,
          },
          'Release notification sent'
        );
      }
    } catch (error) {
      logger.error(
        {
          repository: repository.fullName,
          error,
        },
        'Failed to fetch releases for repository'
      );
    }
  }
}
