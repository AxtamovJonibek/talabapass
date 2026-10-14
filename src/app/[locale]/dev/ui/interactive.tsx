"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chip, ToggleSquare } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";

const CATEGORIES = ["all", "taom", "kofe", "kitob", "xizmat", "sport", "gozal", "kino"] as const;
const COURSES = ["C1", "C2", "C3", "C4", "MASTER"] as const;
const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
type Period = "1" | "7" | "30";

export function InteractiveDemos() {
  const t = useTranslations();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [course, setCourse] = useState<(typeof COURSES)[number]>("C2");
  const [days, setDays] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5"]));
  const [period, setPeriod] = useState<Period>("30");
  const [role, setRole] = useState<"student" | "business">("student");
  const [notify, setNotify] = useState(true);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((slug, i) => (
          <Chip key={slug} selected={category === slug} count={slug === "all" ? 8 : (i % 3) + 1} onClick={() => setCategory(slug)}>
            {t(`category.${slug}`)}
          </Chip>
        ))}
      </div>

      <div className="grid w-[342px] grid-cols-5 gap-1.5">
        {COURSES.map((c) => (
          <ToggleSquare key={c} selected={course === c} onClick={() => setCourse(c)} textSize={c === "MASTER" ? 13 : 15}>
            {t(`course.${c}`)}
          </ToggleSquare>
        ))}
      </div>

      <div className="grid w-[342px] grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <ToggleSquare
            key={d}
            selected={days.has(d)}
            onClick={() => {
              const next = new Set(days);
              if (next.has(d)) next.delete(d);
              else next.add(d);
              setDays(next);
            }}
            textSize={14}
          >
            {t(`weekday.short.${d}`)}
          </ToggleSquare>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Segmented
          label="Davr"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "1", label: "Bugun" },
            { value: "7", label: "7 kun" },
            { value: "30", label: "30 kun" },
          ]}
        />
        <Segmented
          size="lg"
          className="w-[342px]"
          label="Kim sifatida"
          value={role}
          onChange={setRole}
          options={[
            { value: "student", label: "Talaba" },
            { value: "business", label: "Biznes" },
          ]}
        />
        <Switch checked={notify} onChange={setNotify} label="Yangi chegirmalar haqida xabar" />
      </div>
    </div>
  );
}
