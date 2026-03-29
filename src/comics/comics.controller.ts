import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiQuery, ApiOperation, ApiResponse, ApiSecurity } from "@nestjs/swagger";
import { ComicsService } from "./comics.service";

@ApiTags("Comics")
@ApiSecurity("api-key")
@Controller("comics")
export class ComicsController {
  constructor(private readonly service: ComicsService) {}

  @Get()
  @ApiOperation({ summary: "List comics with pagination and filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiQuery({ name: "year", required: false, type: String, description: "Filter by cover year (exact match)" })
  @ApiQuery({ name: "writer", required: false, type: String, description: "Filter by writer (partial match)" })
  @ApiQuery({ name: "series_wiki_page_title", required: false, type: String, description: "Filter by series (exact wiki_page_title)" })
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("year") year?: string,
    @Query("writer") writer?: string,
    @Query("series_wiki_page_title") series_wiki_page_title?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      year,
      writer,
      series_wiki_page_title,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single comic by ID" })
  @ApiResponse({ status: 404, description: "Comic not found" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    const comic = this.service.findOne(id);
    if (!comic) throw new NotFoundException("Comic not found");
    return comic;
  }

  @Get(":id/characters")
  @ApiOperation({ summary: "Get characters appearing in this comic" })
  findCharacters(@Param("id", ParseIntPipe) id: number) {
    return this.service.findCharacters(id);
  }
}
