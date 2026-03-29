import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiQuery, ApiOperation, ApiResponse, ApiSecurity } from "@nestjs/swagger";
import { SeriesService } from "./series.service";

@ApiTags("Series")
@ApiSecurity("api-key")
@Controller("series")
export class SeriesController {
  constructor(private readonly service: SeriesService) {}

  @Get()
  @ApiOperation({ summary: "List comic series with pagination and filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiQuery({ name: "format", required: false, type: String, description: "Filter by format (partial match, e.g. 'Ongoing')" })
  @ApiQuery({ name: "status", required: false, type: String, description: "Filter by status (exact match, e.g. 'Finished')" })
  @ApiQuery({ name: "type", required: false, type: String, description: "Filter by type (exact match, e.g. 'Solo')" })
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("format") format?: string,
    @Query("status") status?: string,
    @Query("type") type?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      format,
      status,
      type,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single series by ID" })
  @ApiResponse({ status: 404, description: "Series not found" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    const series = this.service.findOne(id);
    if (!series) throw new NotFoundException("Series not found");
    return series;
  }

  @Get(":id/comics")
  @ApiOperation({ summary: "Get comic issues in this series" })
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
    if (!result) throw new NotFoundException("Series not found");
    return result;
  }
}
