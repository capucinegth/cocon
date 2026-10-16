/**
 * Module Administratif sur un vrai PostgreSQL local (vraies migrations, vraies règles RLS) :
 * documents, informations et échéances d'Alice invisibles et intouchables pour Bob ;
 * contraintes (chemin de fichier, format, taille, valeur unique) ; règles du stockage privé.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUrl, as, commitAs, createTestDatabase, createUser } from "./helpers";

const suite = adminUrl ? describe : describe.skip;

suite("Base Cocon — module Administratif", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string;
  let bob: string;
  let docId: string;

  const insertDocument = (userId: string, extra: Record<string, unknown> = {}) => {
    const row = {
      category: "professionnel",
      document_type: "fiche_paie",
      title: "Fiche de paie",
      file_path: `${userId}/doc/fiche.pdf`,
      file_name: "fiche.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 12345,
      ...extra,
    };
    const columns = Object.keys(row);
    return {
      text: `insert into public.documents (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      values: Object.values(row),
    };
  };

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_admin"));
    alice = await createUser(db, "alice@example.com");
    bob = await createUser(db, "bob@example.com");
    docId = await commitAs(db, alice, async (q) => {
      const { text, values } = insertDocument(alice, { file_path: `${alice}/d1/fiche-de-paie.pdf`, period_year: 2026, period_month: 9 });
      const id = (await q(text, values)).rows[0].id as string;
      await q("insert into public.document_fields (document_id, field_key, value_amount_cents, status, validated_at) values ($1, 'salaire_net', 185000, 'valide', now())", [id]);
      await q("insert into public.document_deadlines (document_id, label, due_date, kind) values ($1, 'Fin de période d''essai', '2027-03-12', 'fin_contrat')", [id]);
      return id;
    });
  });

  afterAll(async () => {
    await drop?.();
  });

  describe("isolation entre utilisateurs (RLS)", () => {
    it("Alice voit son document, ses informations et ses échéances ; user_id donné par la base", async () => {
      const rows = await as(db, alice, async (q) => ({
        documents: (await q("select user_id, title, period_month from public.documents")).rows,
        fields: (await q("select field_key, value_amount_cents::int as cents from public.document_fields")).rows,
        deadlines: (await q("select label from public.document_deadlines")).rows,
      }));
      expect(rows.documents).toEqual([{ user_id: alice, title: "Fiche de paie", period_month: 9 }]);
      expect(rows.fields).toEqual([{ field_key: "salaire_net", cents: 185000 }]);
      expect(rows.deadlines).toEqual([{ label: "Fin de période d'essai" }]);
    });

    it("Bob ne voit rien d'Alice et ne peut ni modifier ni supprimer (0 ligne touchée)", async () => {
      const result = await as(db, bob, async (q) => ({
        seen: (await q("select count(*)::int as n from public.documents")).rows[0].n,
        fields: (await q("select count(*)::int as n from public.document_fields")).rows[0].n,
        deadlines: (await q("select count(*)::int as n from public.document_deadlines")).rows[0].n,
        updated: (await q("update public.documents set title = 'Piraté' where id = $1", [docId])).rowCount,
        deleted: (await q("delete from public.documents where id = $1", [docId])).rowCount,
        fieldsDeleted: (await q("delete from public.document_fields where document_id = $1", [docId])).rowCount,
      }));
      expect(result).toEqual({ seen: 0, fields: 0, deadlines: 0, updated: 0, deleted: 0, fieldsDeleted: 0 });
      expect((await db.query("select title from public.documents where id = $1", [docId])).rows[0].title).toBe("Fiche de paie");
    });

    it("Bob ne peut pas créer un document au nom d'Alice, ni rattacher une information à son document", async () => {
      const forAlice = insertDocument(bob, { user_id: alice, file_path: `${alice}/x/pirate.pdf` });
      await expect(as(db, bob, (q) => q(forAlice.text, forAlice.values))).rejects.toThrow(/row-level security/);
      await expect(
        as(db, bob, (q) => q("insert into public.document_fields (document_id, field_key, value_text) values ($1, 'employeur', 'X')", [docId])),
      ).rejects.toThrow();
      await expect(
        as(db, bob, (q) => q("insert into public.document_deadlines (document_id, label, due_date) values ($1, 'X', '2027-01-01')", [docId])),
      ).rejects.toThrow();
    });

    it("un visiteur non connecté n'a aucun accès", async () => {
      await expect(as(db, null, (q) => q("select count(*) from public.documents"))).rejects.toThrow(/permission denied/);
    });
  });

  describe("contraintes", () => {
    it("le fichier est toujours sous le dossier de son propriétaire", async () => {
      const elsewhere = insertDocument(bob, { file_path: `${alice}/y/fiche.pdf` });
      await expect(as(db, bob, (q) => q(elsewhere.text, elsewhere.values))).rejects.toThrow(/check constraint/);
    });

    it("format, taille, catégorie et période refusés s'ils sont invalides", async () => {
      for (const extra of [
        { mime_type: "text/html" },
        { file_size_bytes: 20971521 },
        { file_size_bytes: 0 },
        { category: "banque" },
        { document_type: "Fiche de Paie" },
        { period_month: 9 },
        { period_year: 2026, period_month: 13 },
        { title: "   " },
      ]) {
        const { text, values } = insertDocument(bob, { file_path: `${bob}/z/f.pdf`, ...extra });
        await expect(as(db, bob, (q) => q(text, values)), JSON.stringify(extra)).rejects.toThrow(/check constraint|violates/);
      }
    });

    it("une information a exactement une valeur ; validée ⇔ date de validation", async () => {
      await as(db, alice, async (q) => {
        await expect(q("insert into public.document_fields (document_id, field_key) values ($1, 'employeur')", [docId])).rejects.toThrow(/check constraint/);
      });
      await as(db, alice, async (q) => {
        await expect(
          q("insert into public.document_fields (document_id, field_key, value_text, value_date) values ($1, 'employeur', 'A', '2026-01-01')", [docId]),
        ).rejects.toThrow(/check constraint/);
      });
      await as(db, alice, async (q) => {
        await expect(q("insert into public.document_fields (document_id, field_key, value_text, status) values ($1, 'employeur', 'A', 'valide')", [docId])).rejects.toThrow(
          /check constraint/,
        );
      });
    });

    it("supprimer un document supprime ses informations et ses échéances", async () => {
      const counts = await as(db, alice, async (q) => {
        await q("delete from public.documents where id = $1", [docId]);
        return {
          fields: (await q("select count(*)::int as n from public.document_fields")).rows[0].n,
          deadlines: (await q("select count(*)::int as n from public.document_deadlines")).rows[0].n,
        };
      });
      expect(counts).toEqual({ fields: 0, deadlines: 0 });
    });
  });

  describe("espace de stockage privé « documents »", () => {
    it("espace privé : 20 Mo, PDF et images seulement", async () => {
      const { rows } = await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents'");
      expect(rows).toEqual([{ public: false, file_size_limit: "20971520", allowed_mime_types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] }]);
    });

    it("chacun ne dépose, ne lit et ne supprime que dans son propre dossier", async () => {
      await commitAs(db, alice, (q) => q("insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${alice}/d2/a.pdf`]));
      const bobView = await as(db, bob, async (q) => ({
        seen: (await q("select count(*)::int as n from storage.objects where bucket_id = 'documents'")).rows[0].n,
        deleted: (await q("delete from storage.objects where name = $1", [`${alice}/d2/a.pdf`])).rowCount,
      }));
      expect(bobView).toEqual({ seen: 0, deleted: 0 });
      await expect(as(db, bob, (q) => q("insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${alice}/d3/b.pdf`]))).rejects.toThrow(
        /row-level security/,
      );
      const aliceView = await as(db, alice, async (q) => (await q("select name from storage.objects where bucket_id = 'documents'")).rows);
      expect(aliceView).toEqual([{ name: `${alice}/d2/a.pdf` }]);
      // Aucune modification de fichier (pas de règle « update ») : un nouveau fichier = un nouveau document.
      const updated = await as(db, alice, async (q) => (await q("update storage.objects set name = $1 where name = $2", [`${alice}/d2/c.pdf`, `${alice}/d2/a.pdf`])).rowCount);
      expect(updated).toBe(0);
      expect(await as(db, alice, async (q) => (await q("delete from storage.objects where name = $1", [`${alice}/d2/a.pdf`])).rowCount)).toBe(1);
    });
  });
});
