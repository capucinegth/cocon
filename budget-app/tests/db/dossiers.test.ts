/**
 * Dossiers personnels sur un vrai PostgreSQL local (vraies migrations, vraies règles RLS) :
 * la migration n'altère aucun document existant ; dossiers d'Alice invisibles et intouchables
 * pour Bob ; un document ne peut être rangé que dans un dossier de son propriétaire ;
 * supprimer un dossier ne supprime jamais ses documents.
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUrl, as, commitAs, createTestDatabase, createUser, migrationFiles } from "./helpers";

const suite = adminUrl ? describe : describe.skip;
const FOLDERS_MIGRATION = "20261017090000_cocon_dossiers.sql";

const insertDocument = (userId: string, name: string) => ({
  text: `insert into public.documents (category, document_type, title, file_path, file_name, mime_type, file_size_bytes)
         values ('assurances', 'assurance_habitation', $1, $2, 'f.pdf', 'application/pdf', 100) returning id`,
  values: [name, `${userId}/${name.replace(/\W/g, "")}/f.pdf`],
});

suite("Base Cocon — dossiers : migration additive", () => {
  it("appliquée sur une base qui a déjà des documents : rien n'est modifié, folder_id vide", async () => {
    const root = fileURLToPath(new URL("../..", import.meta.url));
    const name = `cocon_dossiers_upgrade_${Date.now().toString(36)}`;
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${name}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      await db.query(readFileSync(join(root, "supabase", "tests", "support", "local-auth-shim.sql"), "utf8"));
      const files = migrationFiles();
      // État de la production avant cette évolution : toutes les migrations précédentes.
      for (const file of files.filter((f) => basename(f) < FOLDERS_MIGRATION)) await db.query(readFileSync(file, "utf8"));
      const alice = await createUser(db, "alice@example.com");
      await commitAs(db, alice, async (q) => {
        const { text, values } = insertDocument(alice, "Bail");
        await q(text, values);
      });
      const before = (await db.query("select * from public.documents")).rows;

      await db.query(readFileSync(files.find((f) => basename(f) === FOLDERS_MIGRATION)!, "utf8"));

      const after = (await db.query("select * from public.documents")).rows;
      expect(after).toHaveLength(1);
      const { folder_id, ...rest } = after[0];
      expect(folder_id).toBeNull();
      expect(rest).toEqual(before[0]);
    } finally {
      await db.end();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    }
  });
});

suite("Base Cocon — dossiers personnels", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string;
  let bob: string;
  let folderId: string;
  let docIds: string[];

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_dossiers"));
    alice = await createUser(db, "alice@example.com");
    bob = await createUser(db, "bob@example.com");
    ({ folderId, docIds } = await commitAs(db, alice, async (q) => {
      const folder = (await q("insert into public.document_folders (name, emoji) values ('Appartement', '🏠') returning id")).rows[0].id as string;
      const ids: string[] = [];
      for (const title of ["Bail", "Quittance"]) {
        const { text, values } = insertDocument(alice, title);
        ids.push((await q(text, values)).rows[0].id as string);
      }
      await q("update public.documents set folder_id = $1 where id = any($2)", [folder, ids]);
      return { folderId: folder, docIds: ids };
    }));
  });

  afterAll(async () => {
    await drop?.();
  });

  it("Alice voit son dossier (user_id donné par la base) et les documents rangés dedans", async () => {
    const rows = await as(db, alice, async (q) => ({
      folders: (await q("select user_id, name, emoji from public.document_folders")).rows,
      inFolder: (await q("select count(*)::int as n from public.documents where folder_id = $1", [folderId])).rows[0].n,
    }));
    expect(rows.folders).toEqual([{ user_id: alice, name: "Appartement", emoji: "🏠" }]);
    expect(rows.inFolder).toBe(2);
  });

  it("Bob ne voit pas le dossier d'Alice, ne peut ni le renommer ni le supprimer", async () => {
    const result = await as(db, bob, async (q) => ({
      seen: (await q("select count(*)::int as n from public.document_folders")).rows[0].n,
      renamed: (await q("update public.document_folders set name = 'Piraté' where id = $1", [folderId])).rowCount,
      deleted: (await q("delete from public.document_folders where id = $1", [folderId])).rowCount,
    }));
    expect(result).toEqual({ seen: 0, renamed: 0, deleted: 0 });
    expect((await db.query("select name from public.document_folders where id = $1", [folderId])).rows[0].name).toBe("Appartement");
  });

  it("Bob ne peut ni créer un dossier au nom d'Alice, ni ranger son document dans le dossier d'Alice", async () => {
    await expect(as(db, bob, (q) => q("insert into public.document_folders (user_id, name) values ($1, 'Pirate')", [alice]))).rejects.toThrow(/row-level security/);
    await expect(
      as(db, bob, async (q) => {
        const { text, values } = insertDocument(bob, "Facture");
        const id = (await q(text, values)).rows[0].id as string;
        await q("update public.documents set folder_id = $1 where id = $2", [folderId, id]);
      }),
    ).rejects.toThrow(/documents_folder_fkey/);
  });

  it("visiteur non connecté : aucun accès", async () => {
    await expect(as(db, null, (q) => q("select * from public.document_folders"))).rejects.toThrow(/permission denied/);
  });

  it("nom obligatoire, 60 caractères au plus, unique par utilisateur (majuscules et espaces ignorés)", async () => {
    for (const name of ["", "   ", "x".repeat(61)]) {
      await expect(as(db, alice, (q) => q("insert into public.document_folders (name) values ($1)", [name]))).rejects.toThrow(/check constraint/);
    }
    await expect(as(db, alice, (q) => q("insert into public.document_folders (name) values ('  appartement ')"))).rejects.toThrow(/document_folders_user_name_idx/);
    // Bob peut avoir son propre dossier « Appartement ».
    const bobs = await as(db, bob, async (q) => (await q("insert into public.document_folders (name) values ('Appartement') returning user_id")).rows[0].user_id);
    expect(bobs).toBe(bob);
  });

  it("supprimer le dossier garde ses documents : ils sortent simplement du dossier", async () => {
    const after = await as(db, alice, async (q) => {
      await q("delete from public.document_folders where id = $1", [folderId]);
      return (await q("select id, user_id, folder_id, title from public.documents order by title")).rows;
    });
    expect(after).toEqual([
      { id: docIds[0], user_id: alice, folder_id: null, title: "Bail" },
      { id: docIds[1], user_id: alice, folder_id: null, title: "Quittance" },
    ]);
  });

  it("supprimer un document ne touche pas au dossier", async () => {
    const left = await as(db, alice, async (q) => {
      await q("delete from public.documents where id = $1", [docIds[0]]);
      return (await q("select count(*)::int as n from public.document_folders")).rows[0].n;
    });
    expect(left).toBe(1);
  });
});
