import { router, protectedProcedure } from "../trpc";
import { getPresignedViewUrl } from "../storage";

export const ownerRouter = router({
  // The animals the current user owns (read-only), across all barns.
  listAnimals: protectedProcedure.query(async ({ ctx }) => {
    const links = await ctx.db.animalOwner.findMany({
      where: { userId: ctx.session.user.id },
      include: { animal: { include: { barn: { select: { name: true } } } } },
      orderBy: { animal: { name: "asc" } },
    });

    const photoIds = links
      .map((l) => l.animal.profilePhotoId)
      .filter((id): id is string => !!id);
    const photos = photoIds.length
      ? await ctx.db.mediaFile.findMany({ where: { id: { in: photoIds } } })
      : [];
    const keyById = new Map(photos.map((p) => [p.id, p.storageKey]));

    return Promise.all(
      links.map(async (l) => ({
        id: l.animal.id,
        name: l.animal.name,
        species: l.animal.species,
        breed: l.animal.breed,
        size: l.animal.size,
        barnName: l.animal.barn.name,
        profilePhotoUrl:
          l.animal.profilePhotoId && keyById.has(l.animal.profilePhotoId)
            ? await getPresignedViewUrl(keyById.get(l.animal.profilePhotoId)!)
            : null,
      }))
    );
  }),
});
