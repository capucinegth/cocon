"use client";

import Link from "next/link";
import { ArrowLeft, FilePlus2, Pencil } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { documentsInFolder, searchDocuments } from "@/lib/admin/documents";
import { useDocuments } from "@/store/documents-store";
import { DocumentRow } from "./document-row";
import { SearchBox } from "./search-box";

const backLink = (
  <Link href="/administratif" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-blush-700 hover:bg-blush-50">
    <ArrowLeft size={16} aria-hidden />
    Mes papiers
  </Link>
);

/** Documents d'un dossier personnel : recherche, liste, renommer / supprimer le dossier. */
export function FolderScreen({ folderId }: { folderId: string }) {
  const state = useDocuments();
  const { folders, fields, openSheet } = state;
  const [query, setQuery] = useState("");
  const folder = folders.find((f) => f.id === folderId);

  if (!folder) {
    return (
      <>
        <PageHeader title="Dossier introuvable">{backLink}</PageHeader>
        <Card>
          <EmptyState emoji="📁" title="Ce dossier n'existe plus">
            Il a peut-être été supprimé. Ses documents sont toujours dans Mes papiers.
          </EmptyState>
        </Card>
      </>
    );
  }

  const all = documentsInFolder(state, folder.id);
  const proposed = new Set(fields.filter((f) => f.status === "propose").map((f) => f.documentId));
  const visible = searchDocuments({ documents: all, fields }, query);
  const addHere = () => openSheet({ type: "import", folderId: folder.id });

  return (
    <>
      <PageHeader
        title={`${folder.emoji} ${folder.name}`}
        subtitle={`Dossier · ${all.length} document${all.length > 1 ? "s" : ""}`}
        actions={
          <div className="hidden lg:block">
            <Button onClick={addHere}>
              <FilePlus2 size={18} aria-hidden />
              Ajouter un document
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {backLink}
          <Button variant="soft" onClick={() => openSheet({ type: "folder", folderId: folder.id })}>
            <Pencil size={16} aria-hidden />
            Modifier le dossier
          </Button>
        </div>
      </PageHeader>

      {all.length > 0 && (
        <div className="mb-3">
          <SearchBox value={query} onChange={setQuery} placeholder={`Rechercher dans ${folder.name}…`} />
        </div>
      )}

      <Card padded={false} className="p-2">
        {all.length === 0 ? (
          <EmptyState emoji={folder.emoji} title="Ce dossier est vide">
            <span className="block">Ajoute un document ici, ou range un document existant depuis sa fiche (choix « Dossier »).</span>
            <Button variant="soft" size="sm" onClick={addHere} className="mt-4">
              <FilePlus2 size={16} aria-hidden />
              Ajouter un document
            </Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState emoji="🔍" title="Rien trouvé">
            Essaie un autre mot.
          </EmptyState>
        ) : (
          <ul aria-live="polite">
            {visible.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                toReview={proposed.has(doc.id) || doc.classificationStatus === "a_verifier"}
                onOpen={() => openSheet({ type: "document", documentId: doc.id })}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
