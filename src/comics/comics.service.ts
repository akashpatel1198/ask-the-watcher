import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ComicsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(query: {
    page?: number;
    limit?: number;
    year?: string;
    writer?: string;
    series_wiki_page_title?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (query.year) {
      conditions.push("year = ?");
      params.push(query.year);
    }
    if (query.writer) {
      conditions.push("writer LIKE ?");
      params.push(`%${query.writer}%`);
    }
    if (query.series_wiki_page_title) {
      conditions.push("series_wiki_page_title = ?");
      params.push(query.series_wiki_page_title);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM comics ${where}`,
      params
    )!.count;

    const data = this.db.query(
      `SELECT id, wiki_page_title, image_url, story_title, year, month, writer, series_wiki_page_title
       FROM comics ${where} ORDER BY year DESC, id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, page, limit };
  }

  findOne(id: number) {
    return this.db.queryOne("SELECT * FROM comics WHERE id = ?", [id]);
  }

  findCharacters(id: number) {
    return this.db.query(
      `SELECT ch.id, ch.wiki_page_title, ch.image_url, ch.name, ch.current_alias, cc.appearance_type
       FROM comic_characters cc
       JOIN characters ch ON ch.wiki_page_title = cc.character_wiki_page_title
       WHERE cc.comic_wiki_page_title = (
         SELECT wiki_page_title FROM comics WHERE id = ?
       )
       ORDER BY
         CASE cc.appearance_type
           WHEN 'featured' THEN 1
           WHEN 'supporting' THEN 2
           WHEN 'antagonist' THEN 3
           ELSE 4
         END,
         ch.current_alias`,
      [id]
    );
  }
}
