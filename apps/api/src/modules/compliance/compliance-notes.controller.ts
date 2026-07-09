import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ComplianceNotesService } from "./compliance-notes.service";
import { NoteVisibility } from "@verro/db";

@Controller("compliance-notes")
export class ComplianceNotesController {
  constructor(private readonly notesService: ComplianceNotesService) {}

  @Post()
  addNote(
    @Body()
    body: {
      brokerId?: string;
      brokerBusinessId?: string;
      organizationId: string;
      authorUserId: string;
      body: string;
      visibility?: NoteVisibility;
    },
  ) {
    return this.notesService.addNote(body);
  }

  @Get("broker/:brokerId")
  listForBroker(@Param("brokerId") brokerId: string, @Query("organizationId") organizationId: string) {
    return this.notesService.listForBroker(brokerId, organizationId);
  }
}
