import { apps, PublicRoutePattern } from "./apps.config";

/**
 * Platform-level public routes that are not tied to a specific app
 */
const platformPublicRoutes: PublicRoutePattern[] = [
  { prefix: "/public/content/" },
];

/**
 * Check if a route matches a public route pattern
 */
function matchesPattern(
  pathname: string,
  pattern: PublicRoutePattern,
  searchParams: URLSearchParams
): boolean {
  // Check if pathname starts with the prefix
  if (!pathname.startsWith(pattern.prefix)) {
    return false;
  }

  // If requiresSegment is true, ensure there's content after the prefix
  if (pattern.requiresSegment) {
    const remainder = pathname.slice(pattern.prefix.length);
    if (!remainder || remainder === "") {
      return false;
    }
  }

  // If no query params required, route is public
  if (!pattern.queryParams || pattern.queryParams.length === 0) {
    return true;
  }

  // Check query param conditions - any matching param grants access
  return pattern.queryParams.some(({ name, values }) => {
    const paramValue = searchParams.get(name);
    return paramValue !== null && values.includes(paramValue);
  });
}

/**
 * Check if the current route is public based on app configurations
 * and platform-level public routes
 */
export function isPublicRoute(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  // Check platform-level public routes
  for (const pattern of platformPublicRoutes) {
    if (matchesPattern(pathname, pattern, searchParams)) {
      return true;
    }
  }

  // Check app-specific public routes
  for (const app of apps) {
    if (!app.publicRoutes) continue;

    for (const pattern of app.publicRoutes) {
      if (matchesPattern(pathname, pattern, searchParams)) {
        return true;
      }
    }
  }

  return false;
}
