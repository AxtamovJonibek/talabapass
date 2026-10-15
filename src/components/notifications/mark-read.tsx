"use client";

import { useEffect } from "react";
import { markInboxReadAction } from "@/server/actions/notifications";

/** Sahifa ko'rsatilgach xabarlarni o'qilgan deb belgilaydi (ko'rsatilgan ro'yxatdagi "yangi" belgisi shu ochilishda qoladi). */
export function MarkRead() {
  useEffect(() => {
    void markInboxReadAction();
  }, []);
  return null;
}
