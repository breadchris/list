import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const SM_BREAKPOINT = 640;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${SM_BREAKPOINT}px)`);
    const onChange = () => {
      setIsDesktop(window.innerWidth >= SM_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsDesktop(window.innerWidth >= SM_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
