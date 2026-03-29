import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiQuery, ApiOperation, ApiResponse, ApiSecurity } from "@nestjs/swagger";
import { CharactersService } from "./characters.service";

@ApiTags("Characters")
@ApiSecurity("api-key")
@Controller("characters")
export class CharactersController {
  constructor(private readonly service: CharactersService) {}

  @Get()
  @ApiOperation({ summary: "List characters with pagination and filters" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiQuery({ name: "name", required: false, type: String, description: "Filter by real name (partial match)" })
  @ApiQuery({ name: "current_alias", required: false, type: String, description: "Filter by alias (partial match)" })
  @ApiQuery({ name: "origin", required: false, type: String, description: "Filter by origin (partial match, e.g. 'Human Mutant')" })
  @ApiQuery({ name: "gender", required: false, type: String, description: "Filter by gender (exact match)" })
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("name") name?: string,
    @Query("current_alias") current_alias?: string,
    @Query("origin") origin?: string,
    @Query("gender") gender?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      name,
      current_alias,
      origin,
      gender,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single character by ID" })
  @ApiResponse({ status: 404, description: "Character not found" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    const character = this.service.findOne(id);
    if (!character) throw new NotFoundException("Character not found");
    return character;
  }

  @Get(":id/teams")
  @ApiOperation({ summary: "Get teams a character belongs to" })
  findTeams(@Param("id", ParseIntPipe) id: number) {
    return this.service.findTeams(id);
  }

  @Get(":id/events")
  @ApiOperation({ summary: "Get events a character appeared in" })
  findEvents(@Param("id", ParseIntPipe) id: number) {
    return this.service.findEvents(id);
  }

  @Get(":id/comics")
  @ApiOperation({ summary: "Get comics a character appeared in" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findComics(
    @Param("id", ParseIntPipe) id: number,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const result = this.service.findComics(id, {
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
    if (!result) throw new NotFoundException("Character not found");
    return result;
  }
}
