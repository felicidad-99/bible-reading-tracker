"use client";

import { useEffect } from "react";
import { resyncSubscription } from "@/lib/push/subscribe-client";

export function PushResync() {
  useEffect(() => {
    resyncSubscription();
  }, []);
  return null;
}
