import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("[NotFound] Unknown route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4" aria-labelledby="not-found-heading">
      <div className="text-center max-w-md">
        <h1 id="not-found-heading" className="mb-4 text-4xl font-bold text-foreground">
          404
        </h1>
        <p className="mb-6 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link
          to="/"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-primary underline underline-offset-4 hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Return to Home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
