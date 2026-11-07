import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';

const SECRET = 'test-access-secret';

const payload = {
  sub: '2d8a4f11-7e9b-4b2c-8c1d-9e0f1a2b3c4d',
  email: 'buyer@ai-ecommerce.com',
  role: 'BUYER',
};

const contextFor = (headers: Record<string, string>) => {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  return { request, context };
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const jwt = new JwtService({});

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        { provide: ConfigService, useValue: { get: () => SECRET } },
      ],
    }).compile();

    await moduleRef.init();
    guard = moduleRef.get(JwtAuthGuard);
  });

  it('turns away a request with no Authorization header', async () => {
    const { context } = contextFor({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('turns away a token signed with somebody else secret', async () => {
    const forged = await jwt.signAsync(payload, {
      secret: 'not-our-secret',
      expiresIn: '15m',
    });
    const { context } = contextFor({ authorization: `Bearer ${forged}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('turns away an access token that has expired', async () => {
    const stale = await jwt.signAsync(payload, {
      secret: SECRET,
      expiresIn: '-1s',
    });
    const { context } = contextFor({ authorization: `Bearer ${stale}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets a good token through and puts the user on the request', async () => {
    const token = await jwt.signAsync(payload, {
      secret: SECRET,
      expiresIn: '15m',
    });
    const { context, request } = contextFor({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });
  });
});
