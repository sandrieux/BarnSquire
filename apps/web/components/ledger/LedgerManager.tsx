"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Plus, Trash2, Loader2, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";

const CATEGORY_BADGE: Record<string, "default" | "secondary" | "warning" | "success" | "outline"> = {
  FEEDING: "success",
  MEDICATION: "warning",
  ACTIVITY: "secondary",
  APPOINTMENT: "default",
  OTHER: "outline",
};

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function LedgerManager({ animalId }: { animalId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<"FEEDING" | "MEDICATION" | "ACTIVITY" | "OTHER">("ACTIVITY");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.ledger.getEntries.useQuery({ animalId });
  const getUploadUrl = trpc.ledger.getUploadUrl.useMutation();
  const createEntry = trpc.ledger.createEntry.useMutation();
  const deleteEntry = trpc.ledger.deleteEntry.useMutation({
    onSuccess: () => utils.ledger.getEntries.invalidate({ animalId }),
  });

  function resetForm() {
    setTitle("");
    setNotes("");
    setCategory("ACTIVITY");
    setOccurredAt(new Date().toISOString().slice(0, 10));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const files = fileInputRef.current?.files;
      const attachments: Array<{
        storageKey: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }> = [];
      if (files) {
        for (const file of Array.from(files)) {
          const { uploadUrl, storageKey } = await getUploadUrl.mutateAsync({
            animalId,
            fileName: file.name,
            mimeType: file.type,
          });
          const res = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
          attachments.push({
            storageKey,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          });
        }
      }
      await createEntry.mutateAsync({
        animalId,
        category,
        title: title.trim(),
        notes: notes.trim() || undefined,
        occurredAt: new Date(occurredAt),
        attachments,
      });
      resetForm();
      setShowForm(false);
      utils.ledger.getEntries.invalidate({ animalId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ledger</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add entry
          </Button>
        )}
      </div>

      {/* Add entry form */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="occurredAt">Date</Label>
                  <Input
                    id="occurredAt"
                    type="date"
                    required
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as typeof category)}
                  >
                    <option value="FEEDING">Feeding</option>
                    <option value="MEDICATION">Medication</option>
                    <option value="ACTIVITY">Activity</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Vet visit, dewormer, farrier…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="files">Attachments (PDF, JPG, PNG)</Label>
                <Input
                  ref={fileInputRef}
                  id="files"
                  type="file"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save entry"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    resetForm();
                    setError("");
                    setShowForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ledger list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No ledger entries yet. Add one or complete tasks on the Today screen.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.source}-${item.id}`}
              className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div className="w-20 shrink-0 text-muted-foreground tabular-nums pt-0.5">
                {formatDate(item.date)}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={CATEGORY_BADGE[item.category] ?? "outline"} className="text-xs">
                    {titleCase(item.category)}
                  </Badge>
                  <span className="font-medium">{item.title}</span>
                  {item.status === "done" && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-green-700">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  )}
                  {item.status === "skipped" && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <X className="h-3 w-3" /> Skipped
                    </span>
                  )}
                </div>
                {item.detail && <p className="text-muted-foreground">{item.detail}</p>}
                {item.notes && <p className="text-muted-foreground whitespace-pre-wrap">{item.notes}</p>}
                {item.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {a.mimeType === "application/pdf" ? (
                          <FileText className="h-3 w-3" />
                        ) : (
                          <Paperclip className="h-3 w-3" />
                        )}
                        <span className="max-w-[12rem] truncate">{a.fileName}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {item.source === "custom" && (
                <button
                  className={cn(
                    "shrink-0 text-muted-foreground hover:text-destructive transition-colors",
                    deleteEntry.isPending && "opacity-50"
                  )}
                  title="Delete entry"
                  onClick={() => {
                    if (confirm("Delete this ledger entry?")) deleteEntry.mutate({ id: item.id });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
