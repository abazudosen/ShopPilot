import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const payload = {
    sub: '2d8a4f11-7e9b-4b2c-8c1d-9e0f1a2b3c4d',
    email: 'buyer@ai-ecommerce.com',
    role: 'BUYER',
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'test-access-secret' } },
      ],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
  });

  it('turns the subject claim into the id every controller reads', () => {
    expect(strategy.validate(payload)).toEqual({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });
  });

  it('leaves the raw claim names off request.user', () => {
    const user = strategy.validate(payload);

    expect(user).not.toHaveProperty('sub');
    expect(user).not.toHaveProperty('iat');
    expect(user).not.toHaveProperty('exp');
  });
});
