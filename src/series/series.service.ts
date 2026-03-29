import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class SeriesService {
  constructor(private readonly db: DatabaseService) {}

  findAll(query: {
    page?: number;
    limit?: number;
    format?: string;
    status?: string;
    type?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (query.format) {
      conditions.push("format LIKE ?");
      params.push(`%${query.format}%`);
    }
    if (query.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }
    if (query.type) {
      conditions.push("type = ?");
      params.push(query.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM series ${where}`,
      params
    )!.count;

    const data = this.db.query(
      `SELECT id, wiki_page_title, image_url, format, type, status, genres, featured
       FROM series ${where} ORDER BY id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, page, limit };
  }

  findOne(id: number) {
    return this.db.queryOne("SELECT * FROM series WHERE id = ?", [id]);
  }

  findComics(id: number, query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const series = this.db.queryOne<{ wiki_page_title: string }>(
      "SELECT wiki_page_title FROM series WHERE id = ?",
      [id]
    );
    if (!series) return null;

    const total = this.db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM comics WHERE series_wiki_page_title = ?",
      [series.wiki_page_title]
    )!.count;

    const data = this.db.query(
      `SELECT id, wiki_page_title, image_url, story_title, year, month, writer
       FROM comics WHERE series_wiki_page_title = ?
       ORDER BY year, id LIMIT ? OFFSET ?`,
      [series.wiki_page_title, limit, offset]
    );

    return { data, total, page, limit };
  }
}
