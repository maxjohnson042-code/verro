import { Controller, Get } from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("review-queue")
  getReviewQueue() {
    return this.adminService.getReviewQueue();
  }

  @Get("flagged")
  getFlaggedAndSuspended() {
    return this.adminService.getFlaggedAndSuspended();
  }
}
