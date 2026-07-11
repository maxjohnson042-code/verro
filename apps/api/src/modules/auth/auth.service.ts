import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";

// Milestone 2: local email+password auth. PortalUser is the shared login
// identity across all three portals (see the comment on the PortalUser
// model in schema.prisma) - this service only handles the BROKER
// self-registration path plus generic login/validate, since org-staff and
// internal admin accounts are provisioned by seed/invite rather than
// public signup.
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
  brokerId: string | null;
}

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerBroker(input: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: Date;
    password: string;
  }) {
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Broker (compliance/profile data) and PortalUser (login credential)
    // are created together in one transaction - see the PortalUser model
    // comment for why they're separate tables.
    const { broker, portalUser } = await this.prisma.$transaction(async (tx) => {
      const broker = await tx.broker.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          dateOfBirth: input.dateOfBirth,
          overallStatus: "DRAFT",
        },
      });
      const portalUser = await tx.portalUser.create({
        data: {
          email: input.email,
          role: "BROKER",
          firstName: input.firstName,
          lastName: input.lastName,
          brokerId: broker.id,
          passwordHash,
        },
      });
      return { broker, portalUser };
    });

    return { broker, accessToken: this.signToken(portalUser) };
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.portalUser.findUnique({ where: { email } });
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      brokerId: user.brokerId,
    };
  }

  async login(user: AuthenticatedUser) {
    await this.prisma.portalUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { accessToken: this.signToken(user), user };
  }

  private signToken(user: { id: string; email: string; role: string; organizationId?: string | null; brokerId?: string | null }) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? null,
      brokerId: user.brokerId ?? null,
    });
  }
}
