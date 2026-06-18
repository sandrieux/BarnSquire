"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Star, Trash2, Upload, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PhotoLibrary({
  animalId,
  profilePhotoId,
}: {
  animalId: string;
  profilePhotoId: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const utils = trpc.useUtils();
  const { data: photos = [], isLoading } = trpc.media.list.useQuery({ animalId });

  const getUploadUrl = trpc.media.getUploadUrl.useMutation();
  const confirmUpload = trpc.media.confirmUpload.useMutation({
    onSuccess: () => utils.media.list.invalidate({ animalId }),
  });
  const deletePhoto = trpc.media.delete.useMutation({
    onSuccess: () => utils.media.list.invalidate({ animalId }),
  });
  const setProfile = trpc.animal.setProfilePhoto.useMutation({
    onSuccess: () => utils.animal.get.invalidate({ id: animalId }),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
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
        if (!res.ok) throw new Error("Upload failed");
        await confirmUpload.mutateAsync({
          animalId,
          storageKey,
          mimeType: file.type,
          sizeBytes: file.size,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm">
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Uploading…" : "Upload photos"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No photos yet. Upload the first one.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden border">
              <Image
                src={photo.url}
                alt={photo.caption ?? "Animal photo"}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover"
                unoptimized
              />
              {photo.id === profilePhotoId && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-1">
                  <Star className="h-3 w-3 fill-current" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  title="Set as profile photo"
                  onClick={() => setProfile.mutate({ animalId, mediaFileId: photo.id })}
                  disabled={photo.id === profilePhotoId}
                >
                  <Star className={cn("h-4 w-4", photo.id === profilePhotoId && "fill-current")} />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  title="Delete photo"
                  onClick={() => deletePhoto.mutate({ id: photo.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
