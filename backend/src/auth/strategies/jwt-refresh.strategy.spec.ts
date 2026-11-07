import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

const requestWithHeader = (value?: string) =>
  ({ get: (name: string) => (name === 'Authorization' ? value : undefined) }) as unknown as Request;

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  const payload = {
    sub: '2d8a4f11-7e9b-4b2c-8c1d-9e0f1a2b3c4d',
    email: 'buyer@ai-ecommerce.com',
    role: 'BUYER',
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        { provide: ConfigService, useValue: { get: () => 'test-refresh-secret' } },
      ],
    }).compile();

    strategy = moduleRef.get(JwtRefreshStrategy);
  });

  it('keeps the raw token from the Authorization header', () => {
    const req = requestWithHeader('Bearer  header.body.signature ');

    expect(strategy.validate(req, payload)).toEqual({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken: 'header.body.signature',
    });
  });

  it('hands back an undefined token when the header is missing', () => {
    const user = strategy.validate(requestWithHeader(undefined), payload);

    expect(user.refreshToken).toBeUndefined();
    expect(user.id).toEqual(payload.sub);
  });
});
