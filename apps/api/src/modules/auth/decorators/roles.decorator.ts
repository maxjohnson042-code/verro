import { SetMetadata } from "@nestjs/common";
import type { PortalRole } from "@verro/db";

export const ROLES_KEY = "roles";
export const Roles = (...roles: PortalRole[]) => SetMetadata(ROLES_KEY, roles);
