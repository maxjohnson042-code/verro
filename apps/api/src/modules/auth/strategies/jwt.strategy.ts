import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    const configuredSecret = config.get<string>("JWT_SECRET");
    const isProduction = config.get<string>("NODE_ENV") === "production";
    if (isProduction && !configuredSecret) {
      throw new Error("JWT_SECRET must be configured in production");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configuredSecret ?? "verro-dev-secret-change-me",
    });
  }

  // Whatever this returns becomes req.user in every guarded route.
  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    organizationId: string | null;
    brokerId: string | null;
  }): Promise<AuthenticatedUser> {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
      brokerId: payload.brokerId,
    };
  }
}
