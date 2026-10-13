import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Ichki havolalar uchun next/link o'rniga shulardan foydalaning — til prefiksi avtomatik qo'yiladi.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
