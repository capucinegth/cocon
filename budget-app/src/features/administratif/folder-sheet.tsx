"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmojiPicker, TextInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { documentsInFolder, folderEmojis, folderNameProblem, MAX_FOLDER_NAME } from "@/lib/admin/documents";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useDocuments } from "@/store/documents-store";
import { useUI } from "@/store/ui-store";

function FolderForm({ folderId }: { folderId?: string }) {
  const state = useDocuments();
  const { folders, saveFolder, deleteFolder, closeSheet } = state;
  const { showToast } = useUI();
  const router = useRouter();
  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;
  const [name, setName] = useState(folder?.name ?? "");
  const [emoji, setEmoji] = useState(folder?.emoji ?? "📁");
  const save = useAsyncAction();
  const remove = useAsyncAction();

  if (folderId && !folder) return <p className="px-6 pb-8 pt-2 text-[15px] text-muted">Ce dossier n&apos;existe plus.</p>;
  const problem = name.trim() ? folderNameProblem(name, folders, folderId) : null;
  const count = folder ? documentsInFolder(state, folder.id).length : 0;

  async function submit() {
    let savedId = "";
    const ok = await save.run(async () => {
      savedId = (await saveFolder({ id: folderId, name, emoji })).id;
    });
    if (!ok) return;
    closeSheet();
    showToast(folder ? "Dossier renommé" : `Dossier « ${name.trim()} » créé`);
    if (!folder) router.push(`/administratif/dossiers/${savedId}`);
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom du dossier</span>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_FOLDER_NAME} placeholder="Ex. Appartement, Voiture, École…" data-autofocus />
        </label>
        <div>
          <p className="mb-2.5 text-sm font-semibold text-muted">Icône</p>
          <EmojiPicker value={emoji} options={folderEmojis} onChange={setEmoji} />
        </div>
        <FormError message={problem} />
        {folder && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <ConfirmButton
              question={
                count > 0
                  ? `Supprimer le dossier « ${folder.name} » ? ${count === 1 ? "Le document qu'il contient reste" : `Les ${count} documents qu'il contient restent`} dans Mes papiers, dans ${count === 1 ? "sa catégorie" : "leurs catégories"}.`
                  : `Supprimer le dossier « ${folder.name} » ? Il est vide.`
              }
              confirmLabel="Supprimer le dossier"
              pending={remove.pending}
              onConfirm={async () => {
                const ok = await remove.run(() => deleteFolder(folder));
                if (!ok) return;
                closeSheet();
                showToast("Dossier supprimé, documents conservés");
                router.push("/administratif");
              }}
            >
              <Trash2 size={16} aria-hidden />
              Supprimer le dossier
            </ConfirmButton>
            <FormError message={remove.error} />
          </div>
        )}
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={save.error} className="mb-3" />
        <div className="flex gap-3">
          <Button variant="ghost" onClick={closeSheet} disabled={save.pending}>
            Annuler
          </Button>
          <Button size="lg" className="flex-1" onClick={() => void submit()} disabled={!name.trim() || problem !== null || save.pending} aria-busy={save.pending || undefined}>
            {save.pending ? "Enregistrement…" : folder ? "Enregistrer" : "Créer le dossier"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Créer un dossier, ou renommer / supprimer un dossier existant (ses documents sont toujours gardés). */
export function FolderSheet() {
  const { sheet, sheetOpen, sheetSession, closeSheet } = useDocuments();
  const active = sheet?.type === "folder" ? sheet : null;
  return (
    <Sheet open={sheetOpen && active !== null} onClose={closeSheet} title={active?.folderId ? "Modifier le dossier" : "Nouveau dossier"}>
      {active && <FolderForm key={sheetSession} folderId={active.folderId} />}
    </Sheet>
  );
}
