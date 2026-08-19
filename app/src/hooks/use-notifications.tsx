import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

interface NotificationOptions {
    title: string;
    description?: string;
    duration?: number;
}

export const useNotifications = () => {
    const success = React.useCallback(({ title, description, duration = 4000 }: NotificationOptions) => {
        toast.success(title, {
            description,
            duration,
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
            className: "border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800",
        });
    }, []);

    const error = React.useCallback(({ title, description, duration = 6000 }: NotificationOptions) => {
        toast.error(title, {
            description,
            duration,
            icon: <AlertCircle className="h-5 w-5 text-red-500" />,
            className: "border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800",
        });
    }, []);

    const warning = React.useCallback(({ title, description, duration = 5000 }: NotificationOptions) => {
        toast.warning(title, {
            description,
            duration,
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            className: "border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800",
        });
    }, []);

    const info = React.useCallback(({ title, description, duration = 4000 }: NotificationOptions) => {
        toast.info(title, {
            description,
            duration,
            icon: <Info className="h-5 w-5 text-blue-500" />,
            className: "border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800",
        });
    }, []);

    return React.useMemo(() => ({
        success,
        error,
        warning,
        info,
    }), [success, error, warning, info]);
};
