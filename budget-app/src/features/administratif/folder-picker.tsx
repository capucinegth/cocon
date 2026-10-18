"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SelectPill } from "@/components/ui/select-pill";
import { folderNameProblem, MAX_FOLDER_NAME, sortFolders } from "@/lib/admin/documents";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useDocuments } from "@/store/documents-store";

/** Choix du dossier d'un document (facultatif), avec création d'un nouveau dossier sur place. */
export function FolderPicker({ value, onChange, disabled }: { value: string; onChange: (folderId: string) => void; disabled?: boolean }) {
  const { folders, saveFolder } = useDocuments();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const create = useAsyncAction();
  const problem = name.trim() ? folderNameProblem(name, folders) : null;

  async function submit() {
    let id = "";
    const ok = await create.run(async () => {
      id = (await saveFolder({ name, emoji: "📁" })).id;
    });
    if (!ok) return;
    onChange(id);
    setName("");
    setCreating(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <SelectPill
          label="Dossier"
          value={value}
          onChange={onChange}
          options={[{ value: "", label: "Aucun dossier" }, ...sortFolders(folders).map((f) => ({ value: f.id, label: `${f.emoji} ${f.name}` }))]}
          className="min-w-0 flex-1 basis-48"
        />
        {!creating && (
          <Button variant="soft" onClick={() => setCreating(true)} disabled={disabled}>
            <FolderPlus size={17} aria-hidden />
            Nouveau dossier
          </Button>
        )}
      </div>
      {creating && (
        <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Nom du nouveau dossier</span>
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_FOLDER_NAME}
              placeholder="Ex. Appartement, Voiture…"
              className="bg-surface"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim() && !problem) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          </label>
          <FormError message={problem ?? create.error} />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setName("");
                create.clearError();
              }}
              disabled={create.pending}
            >
              Annuler
            </Button>
            <Button onClick={() => void submit()} disabled={!name.trim() || problem !== null || create.pending} className="flex-1" aria-busy={create.pending || undefined}>
              {create.pending ? "Création…" : "Créer le dossier"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
