import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Epic: Broker onboarding - self-registration now creates both the
  // login (PortalUser) and the profile (Broker) in one step, and returns
  // a token immediately so the rest of the onboarding wizard is
  // authenticated end to end.
  @Post("register/broker")
  registerBroker(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      dateOfBirth: string;
      password: string;
    },
  ) {
    return this.authService.registerBroker({
      ...body,
      dateOfBirth: new Date(body.dateOfBirth),
    });
  }

  @UseGuards(LocalAuthGuard)
  @Post("login")
  login(@Request() req: { user: import("./auth.service").AuthenticatedUser }) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me")
  me(@CurrentUser() user: import("./auth.service").AuthenticatedUser) {
    return user;
  }
}
