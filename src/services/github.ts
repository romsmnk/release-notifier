import axios, { AxiosError, AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../config/logger';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
}

export interface GitHubRepository {
  owner: {
    login: string;
  };
  name: string;
  full_name: string;
  html_url: string;
}

export class GitHubApiClient {
  private readonly client: AxiosInstance;
  private retryCount = 0;
  private maxRetries = config.githubApiMaxRetries;
  private retryDelay = config.githubApiRetryDelay;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(config.githubApiToken && {
          Authorization: `token ${config.githubApiToken}`,
        }),
      },
    });

    // Add response interceptor for rate limit handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => this.handleRateLimitError(error)
    );
  }

  async getLatestReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    try {
      const response = await this.client.get<GitHubRelease[]>(`/repos/${owner}/${repo}/releases`, {
        params: {
          per_page: 10,
          state: 'open',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new RepositoryNotFoundError(`Repository ${owner}/${repo} not found`);
        }
        throw new GitHubApiError(
          `Failed to fetch releases: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
    try {
      const response = await this.client.get<GitHubRepository>(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async handleRateLimitError(error: AxiosError): Promise<never> {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || '60';
      const waitTime = Number.parseInt(retryAfter, 10) * 1000;

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.warn(
          {
            retryAfter,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
          },
          'Rate limited, retrying'
        );
        await this.delay(waitTime);
        return Promise.reject(error);
      }

      throw new RateLimitExceededError(`GitHub API rate limit exceeded. Please try again later.`);
    }

    return Promise.reject(error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRateLimitInfo(): number {
    return config.githubApiToken
      ? config.rateLimits.authenticated
      : config.rateLimits.unauthenticated;
  }
}

export class GitHubApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubApiError';
    Object.setPrototypeOf(this, GitHubApiError.prototype);
  }
}

export class RepositoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryNotFoundError';
    Object.setPrototypeOf(this, RepositoryNotFoundError.prototype);
  }
}

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}

export class InvalidRepositoryFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRepositoryFormatError';
    Object.setPrototypeOf(this, InvalidRepositoryFormatError.prototype);
  }
}
