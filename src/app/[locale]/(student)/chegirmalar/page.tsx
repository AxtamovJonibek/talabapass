import { Suspense } from "react";
import { FeedScreen } from "@/components/student/feed/feed-screen";
import { initials } from "@/lib/format";
import { isFeedSort, type FeedSort } from "@/lib/feed";
import { requireActiveStudent } from "@/server/auth/student";
import { db } from "@/server/db";
import { feedDeals, hasUnreadNotifications, savedThisMonth } from "@/server/student/feed";
import { currentOrigin, districtOptions } from "@/server/student/location";
import { getTranslations } from "next-intl/server";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// T4 / WT2 — chegirmalar lentasi
async function FeedPageContent({ searchParams }: { searchParams: PageProps<"/[locale]/chegirmalar">["searchParams"] }) {
  const user = await requireActiveStudent();
  const now = new Date();
  const [params, origin, t] = await Promise.all([searchParams, currentOrigin(), getTranslations("feed.location")]);
  const [deals, categories, districts, savedMonth, unread] = await Promise.all([
    feedDeals(now, origin?.point ?? null),
    db.category.findMany({ orderBy: { sort: "asc" }, select: { slug: true } }),
    districtOptions(),
    savedThisMonth(user.id, now),
    hasUnreadNotifications(user.id),
  ]);

  const slugs = categories.map((c) => c.slug);
  const defaultSort: FeedSort = origin ? "near" : "ending";
  const sort = first(params.saralash);
  const category = first(params.kategoriya);

  return (
    <FeedScreen
      deals={deals}
      categories={slugs}
      now={now.toISOString()}
      defaultSort={defaultSort}
      initial={{
        q: first(params.q).slice(0, 80),
        category: slugs.includes(category) ? category : "all",
        liveOnly: first(params.ochiq) === "1",
        sort: isFeedSort(sort) && (sort !== "near" || origin) ? sort : defaultSort,
      }}
      origin={origin?.point ?? null}
      location={{
        value: origin ? (origin.kind === "gps" ? "gps" : origin.districtId) : "",
        label: origin ? (origin.kind === "gps" ? t("here") : origin.name) : t("city"),
        districts,
      }}
      user={{ firstName: user.firstName ?? "", initials: initials(user.firstName, user.lastName), savedMonth, unread }}
    />
  );
}

export default function StudentFeedPage({ searchParams }: PageProps<"/[locale]/chegirmalar">) {
  return (
    <Suspense fallback={null}>
      <FeedPageContent searchParams={searchParams} />
    </Suspense>
  );
}
