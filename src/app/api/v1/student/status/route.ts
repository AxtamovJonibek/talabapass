import { ok, route } from "@/server/api/http";
import { requireApiStudent } from "@/server/api/session";
import { latestVerification } from "@/server/student/verification";

/** Tekshiruv holati: `DRAFT` (guvohnoma kerak) · `PENDING` (navbatda) · `APPROVED` · `REJECTED` (sabab bilan) · `EXPIRED`. */
export const GET = route(async (request) => {
  const { user } = await requireApiStudent(request, { approved: false });
  const latest = await latestVerification(user.id);
  return ok({
    status: user.student.status,
    cardExpiresAt: user.student.cardExpiresAt?.toISOString().slice(0, 10) ?? null,
    verification: latest
      ? {
          id: latest.id,
          status: latest.status,
          fileName: latest.fileName,
          rejectReason: latest.rejectReason,
          createdAt: latest.createdAt.toISOString(),
          queuePosition: latest.status === "PENDING" ? latest.queuePosition : null,
        }
      : null,
  });
});
