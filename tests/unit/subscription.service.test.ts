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
    });

    it('should create new user and subscription', async () => {
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
        isActive: true,
      });

      const result = await subscriptionService.subscribeToRepository(email, repo);

      expect(result).toEqual({ success: true });
      expect(prisma.user.create).toHaveBeenCalledWith({ data: { email } });
      expect(prisma.subscription.create).toHaveBeenCalled();
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
        isActive: true,
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

    it('should reactivate existing inactive subscription', async () => {
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
        isActive: true,
      });

      const result = await subscriptionService.subscribeToRepository(email, repo);

      expect(result).toEqual({ success: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { isActive: true },
      });
    });
  });

  describe('unsubscribeFromRepository', () => {
    it('should deactivate subscription', async () => {
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
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        id: 'sub1',
        isActive: false,
      });

      const result = await subscriptionService.unsubscribeFromRepository(email, repo);

      expect(result).toEqual({ success: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { isActive: false },
      });
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        subscriptionService.unsubscribeFromRepository('test@example.com', 'golang/go')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if repository not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user1' });
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        subscriptionService.unsubscribeFromRepository('test@example.com', 'golang/go')
      ).rejects.toThrow('Repository not found');
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return user subscriptions', async () => {
      const email = 'test@example.com';
      const subscriptions = [
        {
          id: 'sub1',
          repository: { fullName: 'golang/go' },
          createdAt: new Date(),
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
        id: 'sub1',
        repository: 'golang/go',
      });
    });

    it('should return empty array if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await subscriptionService.getUserSubscriptions('test@example.com');

      expect(result).toEqual([]);
    });
  });
});
