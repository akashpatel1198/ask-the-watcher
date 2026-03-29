import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class CharactersService {
  constructor(private readonly db: DatabaseService) {}

  findAll(query: {
    page?: number;
    limit?: number;
    name?: string;
    current_alias?: string;
    origin?: string;
    gender?: string;
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
    if (query.current_alias) {
      conditions.push("current_alias LIKE ?");
      params.push(`%${query.current_alias}%`);
    }
    if (query.origin) {
      conditions.push("origin LIKE ?");
      params.push(`%${query.origin}%`);
    }
    if (query.gender) {
      conditions.push("gender = ?");
      params.push(query.gender);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM characters ${where}`,
      params
    )!.count;

    const data = this.db.query(
      `SELECT id, wiki_page_title, image_url, name, current_alias, aliases, origin, gender, identity
       FROM characters ${where} ORDER BY id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, page, limit };
  }

  findOne(id: number) {
    return this.db.queryOne("SELECT * FROM characters WHERE id = ?", [id]);
  }

  findTeams(id: number) {
    return this.db.query(
      `SELECT t.id, t.wiki_page_title, t.image_url, t.name, t.status, ct.role
       FROM character_teams ct
       JOIN teams t ON t.wiki_page_title = ct.team_wiki_page_title
       WHERE ct.character_wiki_page_title = (
         SELECT wiki_page_title FROM characters WHERE id = ?
       )
       ORDER BY t.name`,
      [id]
    );
  }

  findEvents(id: number) {
    return this.db.query(
      `SELECT e.id, e.wiki_page_title, e.image_url, e.name, e.synopsis, ce.role
       FROM character_events ce
       JOIN events e ON e.wiki_page_title = ce.event_wiki_page_title
       WHERE ce.character_wiki_page_title = (
         SELECT wiki_page_title FROM characters WHERE id = ?
       )
       ORDER BY e.name`,
      [id]
    );
  }

  findComics(id: number, query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const wikiTitle = this.db.queryOne<{ wiki_page_title: string }>(
      "SELECT wiki_page_title FROM characters WHERE id = ?",
      [id]
    );
    if (!wikiTitle) return null;

    const total = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM comic_characters
       WHERE character_wiki_page_title = ?`,
      [wikiTitle.wiki_page_title]
    )!.count;

    const data = this.db.query(
      `SELECT c.id, c.wiki_page_title, c.image_url, c.story_title, c.year, cc.appearance_type
       FROM comic_characters cc
       JOIN comics c ON c.wiki_page_title = cc.comic_wiki_page_title
       WHERE cc.character_wiki_page_title = ?
       ORDER BY c.year DESC, c.id
       LIMIT ? OFFSET ?`,
      [wikiTitle.wiki_page_title, limit, offset]
    );

    return { data, total, page, limit };
  }
}
