import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const SECRETS: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  refreshToken: string | null;
};

describe('AuthService', () => {
  let service: AuthService;
  let row: UserRow;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const credentials = { email: 'buyer@ai-ecommerce.com', password: 'admin123' };

  beforeEach(async () => {
    jest.clearAllMocks();

    row = {
      id: '2d8a4f11-7e9b-4b2c-8c1d-9e0f1a2b3c4d',
      email: credentials.email,
      name: 'Demo Buyer',
      password: await bcrypt.hash(credentials.password, 10),
      role: 'BUYER',
      refreshToken: null,
    };

    prisma.user.findUnique.mockImplementation(async () => row);
    prisma.user.update.mockImplementation(async ({ data }: { data: Partial<UserRow> }) => {
      Object.assign(row, data);
      return row;
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: new JwtService({}) },
        { provide: ConfigService, useValue: { get: (key: string) => SECRETS[key] } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hands out a pair and stores only a hash of the refresh token', async () => {
    const result = await service.login(credentials);

    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.refreshToken.split('.')).toHaveLength(3);
    expect(row.refreshToken).not.toBeNull();
    expect(row.refreshToken).not.toContain(result.refreshToken);
    expect(row.refreshToken!.startsWith('$2')).toBe(true);
  });

  it('refuses a refresh token that was already spent', async () => {
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(Date.parse('2026-03-01T10:00:00Z'));
    const first = await service.login(credentials);

    clock.mockReturnValue(Date.parse('2026-03-01T10:00:01Z'));
    const second = await service.refreshTokens(row.id, first.refreshToken);

    expect(second.refreshToken).not.toEqual(first.refreshToken);
    expect(second.refreshToken.slice(0, 72)).toEqual(first.refreshToken.slice(0, 72));

    await expect(
      service.refreshTokens(row.id, first.refreshToken),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts the newest refresh token and rotates again', async () => {
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(Date.parse('2026-03-01T10:00:00Z'));
    const first = await service.login(credentials);

    clock.mockReturnValue(Date.parse('2026-03-01T10:00:01Z'));
    const second = await service.refreshTokens(row.id, first.refreshToken);

    clock.mockReturnValue(Date.parse('2026-03-01T10:00:02Z'));
    const third = await service.refreshTokens(row.id, second.refreshToken);

    expect(third.refreshToken).not.toEqual(second.refreshToken);
    expect(row.refreshToken).not.toBeNull();
  });

  it('kills every refresh token when the user logs out', async () => {
    const { refreshToken } = await service.login(credentials);

    await service.logout(row.id);

    expect(row.refreshToken).toBeNull();
    await expect(
      service.refreshTokens(row.id, refreshToken),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a refresh for a user that is not there', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.refreshTokens(row.id, 'anything.at.all'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
