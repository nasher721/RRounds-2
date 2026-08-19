import { useIsMobile } from "@/hooks/use-mobile";
import { ReactNode } from "react";

interface ResponsiveLayoutProps {
  mobileContent: ReactNode;
  desktopContent: ReactNode;
}

export const ResponsiveLayout = ({ mobileContent, desktopContent }: ResponsiveLayoutProps) => {
  const isMobile = useIsMobile();

  // Show nothing during SSR/hydration to prevent flash
  if (isMobile === undefined) {
    return null;
  }

  return <>{isMobile ? mobileContent : desktopContent}</>;
};
