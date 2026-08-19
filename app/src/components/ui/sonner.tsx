import * as React from "react";
import { useTheme } from "@/components/theme-provider";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      aria-label="Notifications"
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-none group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "pointer-events-auto group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "pointer-events-auto group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "pointer-events-auto group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
