import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class TeamsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(query: {
    page?: number;
    limit?: number;
    name?: string;
    status?: string;
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
    if (query.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }
    if (query.reality) {
      conditions.push("reality LIKE ?");
      params.push(`%${query.reality}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM teams ${where}`,
      params
    )!.count;

    const data = this.db.query(
      `SELECT id, wiki_page_title, image_url, name, status, identity, reality
       FROM teams ${where} ORDER BY name LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, page, limit };
  }

  findOne(id: number) {
    return this.db.queryOne("SELECT * FROM teams WHERE id = ?", [id]);
  }

  findMembers(id: number) {
    return this.db.query(
      `SELECT ch.id, ch.wiki_page_title, ch.image_url, ch.name, ch.current_alias, ct.role
       FROM character_teams ct
       JOIN characters ch ON ch.wiki_page_title = ct.character_wiki_page_title
       WHERE ct.team_wiki_page_title = (
         SELECT wiki_page_title FROM teams WHERE id = ?
       )
       ORDER BY
         CASE ct.role
           WHEN 'leader' THEN 1
           WHEN 'member' THEN 2
           WHEN 'former_member' THEN 3
           ELSE 4
         END,
         ch.current_alias`,
      [id]
    );
  }
}
