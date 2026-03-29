import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiQuery, ApiOperation, ApiResponse, ApiSecurity } from "@nestjs/swagger";
import { TeamsService } from "./teams.service";

@ApiTags("Teams")
@ApiSecurity("api-key")
@Controller("teams")
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  @ApiOperation({ summary: "List teams with pagination and filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiQuery({ name: "name", required: false, type: String, description: "Filter by team name (partial match)" })
  @ApiQuery({ name: "status", required: false, type: String, description: "Filter by status (exact match, e.g. 'Active')" })
  @ApiQuery({ name: "reality", required: false, type: String, description: "Filter by reality (partial match, e.g. 'Earth-616')" })
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("name") name?: string,
    @Query("status") status?: string,
    @Query("reality") reality?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      name,
      status,
      reality,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single team by ID" })
  @ApiResponse({ status: 404, description: "Team not found" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    const team = this.service.findOne(id);
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  @Get(":id/members")
  @ApiOperation({ summary: "Get characters who are members of this team" })
  findMembers(@Param("id", ParseIntPipe) id: number) {
    return this.service.findMembers(id);
  }
}
