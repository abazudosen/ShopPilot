import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard, but never rejects: a valid token populates request.user,
 * a missing/invalid one simply leaves it undefined.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(_err: any, user: any): TUser {
    // Swallow auth errors; return the user if present, otherwise undefined.
    return user ?? undefined;
  }
}
