import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class EventsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(query: {
    page?: number;
    limit?: number;
    name?: string;
    reality?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (query.name) {
      conditions.push("name LIKE ?");
      params.push(`%${query.name}%`);
    }
    if (query.reality) {
      conditions.push("reality LIKE ?");
      params.push(`%${query.reality}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM events ${where}`,
      params
    )!.count;

    const data = this.db.query(
      `SELECT id, wiki_page_title, image_url, name, aliases, reality, first_issue, last_issue
       FROM events ${where} ORDER BY name LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, page, limit };
  }

  findOne(id: number) {
    return this.db.queryOne("SELECT * FROM events WHERE id = ?", [id]);
  }

  findCharacters(id: number) {
    return this.db.query(
      `SELECT ch.id, ch.wiki_page_title, ch.image_url, ch.name, ch.current_alias, ce.role
       FROM character_events ce
       JOIN characters ch ON ch.wiki_page_title = ce.character_wiki_page_title
       WHERE ce.event_wiki_page_title = (
         SELECT wiki_page_title FROM events WHERE id = ?
       )
       ORDER BY
         CASE ce.role
           WHEN 'protagonist' THEN 1
           WHEN 'antagonist' THEN 2
           ELSE 3
         END,
         ch.current_alias`,
      [id]
    );
  }

  findComics(id: number) {
    return this.db.query(
      `SELECT c.id, c.wiki_page_title, c.image_url, c.story_title, c.year, ec.reading_order, ec.type
       FROM event_comics ec
       JOIN comics c ON c.wiki_page_title = ec.comic_wiki_page_title
       WHERE ec.event_wiki_page_title = (
         SELECT wiki_page_title FROM events WHERE id = ?
       )
       ORDER BY ec.reading_order NULLS LAST, c.id`,
      [id]
    );
  }
}
