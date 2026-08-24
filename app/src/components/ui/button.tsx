import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[-0.01em] transition-[transform,box-shadow,background-color,color,border-color] duration-500 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.55] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_28px_-18px_hsl(var(--primary)/0.9),inset_0_1px_0_rgba(255,255,255,0.24)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_16px_32px_-18px_hsl(var(--primary)/0.8),inset_0_1px_0_rgba(255,255,255,0.28)]",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_10px_24px_-18px_hsl(var(--destructive)/0.9),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 hover:bg-destructive/92",
        outline: "border border-border/55 bg-card/92 shadow-[0_8px_24px_-20px_rgba(12,28,22,0.55),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/55",
        secondary: "bg-secondary/85 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:-translate-y-0.5 hover:bg-secondary",
        ghost: "hover:-translate-y-0.5 hover:bg-secondary/70 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
