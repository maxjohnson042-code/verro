import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Prisma } from "@verro/db";

// Translates raw Prisma errors into clean HTTP responses instead of
// leaking stack traces / internal query details to API clients (and, by
// extension, straight into the wizard's error banner in the frontend).
// P2002 = unique constraint violation, P2025 = record not found - the two
// that are actually meaningful to show a user; everything else stays a
// generic 500 rather than guessing at a friendlier message.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    if (exception.code === "P2002") {
      const fields = (exception.meta?.target as string[] | undefined)?.join(", ") ?? "a unique field";
      return res.status(409).json({ statusCode: 409, message: `A record with this ${fields} already exists.` });
    }

    if (exception.code === "P2025") {
      return res.status(404).json({ statusCode: 404, message: "The requested record was not found." });
    }

    return res.status(500).json({ statusCode: 500, message: "Unexpected database error." });
  }
}
