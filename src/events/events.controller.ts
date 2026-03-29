import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiQuery, ApiOperation, ApiResponse, ApiSecurity } from "@nestjs/swagger";
import { EventsService } from "./events.service";

@ApiTags("Events")
@ApiSecurity("api-key")
@Controller("events")
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  @ApiOperation({ summary: "List events with pagination and filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiQuery({ name: "name", required: false, type: String, description: "Filter by event name (partial match)" })
  @ApiQuery({ name: "reality", required: false, type: String, description: "Filter by reality (partial match)" })
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("name") name?: string,
    @Query("reality") reality?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      name,
      reality,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single event by ID" })
  @ApiResponse({ status: 404, description: "Event not found" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    const event = this.service.findOne(id);
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  @Get(":id/characters")
  @ApiOperation({ summary: "Get characters who participated in this event" })
  findCharacters(@Param("id", ParseIntPipe) id: number) {
    return this.service.findCharacters(id);
  }

  @Get(":id/comics")
  @ApiOperation({ summary: "Get comics in this event's reading order" })
  findComics(@Param("id", ParseIntPipe) id: number) {
    return this.service.findComics(id);
  }
}
