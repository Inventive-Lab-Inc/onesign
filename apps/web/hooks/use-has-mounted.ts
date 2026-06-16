"use client";

import { useEffect, useState } from "react";

/** False on server and the first client render; true after mount. Use for locale/time UI. */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
