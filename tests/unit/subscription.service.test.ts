import { prisma } from '../../src/db/prisma';
import { EmailService } from '../../src/services/email';
import {
  GitHubApiClient,
  InvalidRepositoryFormatError,
  RepositoryNotFoundError,
} from '../../src/services/github';
import { SubscriptionService } from '../../src/services/subscription';

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    repository: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('../../src/services/github', () => {
  const actual = jest.requireActual('../../src/services/github');

  return {
    ...actual,
    GitHubApiClient: jest.fn().mockImplementation(() => ({
      getRepository: jest.fn(),
      getLatestReleases: jest.fn(),
      getRateLimitInfo: jest.fn(),
    })),
  };
});
jest.mock('../../src/services/email');

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockGithubClient: jest.Mocked<GitHubApiClient>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGithubClient = new GitHubApiClient() as jest.Mocked<GitHubApiClient>;
    mockEmailService = new EmailService() as jest.Mocked<EmailService>;
    subscriptionService = new SubscriptionService(mockGithubClient, mockEmailService);
  });

  describe('validateRepositoryFormat', () => {
    it('should accept valid repository format', () => {
      const result = subscriptionService.validateRepositoryFormat('golang/go');
      expect(result).toEqual({ owner: 'golang', repo: 'go' });
    });

    it('should reject format without slash', () => {
      expect(() => subscriptionService.validateRepositoryFormat('golanggo')).toThrow(
        InvalidRepositoryFormatError
      );
    });

    it('should reject format with empty owner', () => {
      expect(() => subscriptionService.validateRepositoryFormat('/go')).toThrow(
        InvalidRepositoryFormatError
      );
    });

    it('should reject format with empty repo', () => {
      expect(() => subscriptionService.validateRepositoryFormat('golang/')).toThrow(
        InvalidRepositoryFormatError
      );
    });

    it('should reject format with multiple slashes', () => {
      expect(() => subscriptionService.validateRepositoryFormat('go/lang/go')).toThrow(
        InvalidRepositoryFormatError
      );
    });

    it('should trim whitespace', () => {
      const result = subscriptionService.validateRepositoryFormat('  golang/go  ');
      expect(result).toEqual({ owner: 'golang', repo: 'go' });
    });
  });

  describe('subscribeToRepository', () => {
    beforeEach(() => {
      (mockGithubClient.getRepository as jest.Mock).mockResolvedValue({
        owner: { login: 'golang' },
        name: 'go',
        full_name: 'golang/go',
        html_url: 'https://github.com/golang/go',
      });
      (mockEmailService.sendConfirmationEmail as jest.Mock).mockResolvedValue(true);
    });

    it('should create new user and subscription with confirmation email', async () => {
      const email = 'test@example.com';
      const repo = 'golang/go';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user1', email });
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.repository.create as jest.Mock).mockResolvedValue({
        id: 'repo1',
        owner: 'golang',
        name: 'go',
        fullName: 'golang/go',
      });
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        repositoryId: 'repo1',
        isActive: false,
        confirmToken: 'token123',
      });

      const result = await subscriptionService.subscribeToRepository(email, repo);

      expect(result).toEqual({ success: true, message: 'Confirmation email sent' });
      expect(prisma.user.create).toHaveBeenCalledWith({ data: { email } });
      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalled();
    });

    it('should reuse existing user', async () => {
      const email = 'test@example.com';
      const repo = 'golang/go';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user1', email });
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.repository.create as jest.Mock).mockResolvedValue({
        id: 'repo1',
        owner: 'golang',
        name: 'go',
        fullName: 'golang/go',
      });
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        repositoryId: 'repo1',
        isActive: false,
      });

      await subscriptionService.subscribeToRepository(email, repo);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
    });

    it('should throw error if repository not found on GitHub', async () => {
      (mockGithubClient.getRepository as jest.Mock).mockResolvedValue(null);

      await expect(
        subscriptionService.subscribeToRepository('test@example.com', 'nonexistent/repo')
      ).rejects.toThrow(RepositoryNotFoundError);
    });

    it('should throw error if already subscribed', async () => {
      const email = 'test@example.com';
      const repo = 'golang/go';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user1', email });
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue({
        id: 'repo1',
        fullName: repo,
      });
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        id: 'sub1',
        isActive: true,
      });

      await expect(subscriptionService.subscribeToRepository(email, repo)).rejects.toThrow(
        'already subscribed'
      );
    });

    it('should regenerate tokens for inactive subscription', async () => {
      const email = 'test@example.com';
      const repo = 'golang/go';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user1', email });
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue({
        id: 'repo1',
        fullName: repo,
      });
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        id: 'sub1',
        isActive: false,
      });
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        id: 'sub1',
        isActive: false,
        confirmToken: 'newtoken',
      });

      const result = await subscriptionService.subscribeToRepository(email, repo);

      expect(result).toEqual({ success: true, message: 'Confirmation email sent' });
      expect(prisma.subscription.update).toHaveBeenCalled();
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalled();
    });
  });

  describe('confirmSubscription', () => {
    it('should confirm subscription and activate it', async () => {
      const token = 'token123';
      const subscription = {
        id: 'sub1',
        isActive: false,
        user: { email: 'test@example.com' },
        repository: { fullName: 'golang/go' },
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(subscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...subscription,
        isActive: true,
        confirmedAt: new Date(),
      });

      const result = await subscriptionService.confirmSubscription(token);

      expect(result.success).toBe(true);
      expect(result.repository).toBe('golang/go');
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { confirmToken: token },
        include: {
          user: true,
          repository: true,
        },
      });
    });

    it('should throw error if token not found', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(subscriptionService.confirmSubscription('invalid-token')).rejects.toThrow(
        'Invalid or expired confirmation token'
      );
    });

    it('should throw error if already confirmed', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        id: 'sub1',
        isActive: true,
      });

      await expect(subscriptionService.confirmSubscription('token123')).rejects.toThrow(
        'already confirmed'
      );
    });
  });

  describe('unsubscribeByToken', () => {
    it('should unsubscribe using token', async () => {
      const token = 'unsub-token123';
      const subscription = {
        id: 'sub1',
        isActive: true,
        user: { email: 'test@example.com' },
        repository: { fullName: 'golang/go' },
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(subscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...subscription,
        isActive: false,
      });

      const result = await subscriptionService.unsubscribeByToken(token);

      expect(result.success).toBe(true);
      expect(result.repository).toBe('golang/go');
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { isActive: false },
      });
    });

    it('should throw error if token not found', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(subscriptionService.unsubscribeByToken('invalid-token')).rejects.toThrow(
        'Invalid or expired unsubscribe token'
      );
    });
  });


  describe('getUserSubscriptions', () => {
    it('should return user subscriptions in v2 format', async () => {
      const email = 'test@example.com';
      const subscriptions = [
        {
          id: 'sub1',
          repository: { fullName: 'golang/go', lastSeenTag: 'go1.20' },
          confirmedAt: new Date(),
        },
      ];

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        email,
        subscriptions,
      });

      const result = await subscriptionService.getUserSubscriptions(email);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: 'test@example.com',
        repo: 'golang/go',
        confirmed: true,
        last_seen_tag: 'go1.20',
      });
    });

    it('should return empty array if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await subscriptionService.getUserSubscriptions('test@example.com');

      expect(result).toEqual([]);
    });

    it('should only return active confirmed subscriptions', async () => {
      const email = 'test@example.com';
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        email,
        subscriptions: [
          {
            id: 'sub1',
            repository: { fullName: 'golang/go', lastSeenTag: null },
            confirmedAt: new Date(),
          },
        ],
      });

      const result = await subscriptionService.getUserSubscriptions(email);

      expect(result).toHaveLength(1);
      expect(result[0].confirmed).toBe(true);
    });
  });
});
