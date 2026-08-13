import { useEffect, useRef, useState } from "react";

import { isTransposeGesture } from "./GestureMapper";

import type { FingerState } from "./FingerDetector";

export function useTransposeController(fingers: FingerState | null) {
  const previousGesture = useRef(false);

  const [transposeEnabled, setTransposeEnabled] = useState(false);

  useEffect(() => {
    const currentGesture = isTransposeGesture(fingers);

    /*
     * Detect only the transition:
     *
     * false → true
     */

    if (currentGesture && !previousGesture.current) {
      setTransposeEnabled((previous) => !previous);
    }

    previousGesture.current = currentGesture;
  }, [fingers]);

  return transposeEnabled;
}
