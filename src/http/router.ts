import { clientError } from "./errors.js";

export type RouteSegment =
  | { readonly kind: "static"; readonly value: string }
  | { readonly kind: "param"; readonly name: string };

export type HttpRoute = {
  readonly method: string;
  readonly template: string;
  readonly pattern: readonly RouteSegment[];
  readonly authenticate: boolean;
  readonly sensitive: boolean;
};

export type RouteMatch =
  | {
      readonly kind: "handled";
      readonly route: HttpRoute;
      readonly params: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: "method_not_allowed";
      readonly allow: readonly string[];
      readonly template: string;
      readonly sensitive: boolean;
    }
  | { readonly kind: "not_found" };

export function compileRoute(
  method: string,
  template: string,
  options: { readonly authenticate: boolean; readonly sensitive: boolean },
): HttpRoute {
  return {
    method,
    template,
    pattern: template.split("/").filter(Boolean).map(compileSegment),
    authenticate: options.authenticate,
    sensitive: options.sensitive,
  };
}

export function matchRoute(
  routes: readonly HttpRoute[],
  method: string,
  pathname: string,
): RouteMatch {
  const segments = pathname.split("/").filter(Boolean);
  const matches: Array<{ route: HttpRoute; params: Record<string, string> }> =
    [];

  for (const route of routes) {
    const params = matchPattern(route.pattern, segments);

    if (params !== null) {
      matches.push({ route, params });
    }
  }

  if (matches.length === 0) {
    return { kind: "not_found" };
  }

  const selected = matches
    .filter((match) => match.route.method === method)
    .sort(
      (left, right) => staticCount(right.route) - staticCount(left.route),
    )[0];

  if (selected === undefined) {
    return {
      kind: "method_not_allowed",
      allow: [...new Set(matches.map((match) => match.route.method))].sort(),
      template: matches[0]?.route.template ?? "unmatched",
      sensitive: matches.some((match) => match.route.sensitive),
    };
  }

  return {
    kind: "handled",
    route: selected.route,
    params: selected.params,
  };
}

function compileSegment(part: string): RouteSegment {
  if (part.startsWith(":")) {
    return { kind: "param", name: part.slice(1) };
  }

  return { kind: "static", value: part };
}

function matchPattern(
  pattern: readonly RouteSegment[],
  segments: readonly string[],
): Record<string, string> | null {
  if (pattern.length !== segments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < pattern.length; index += 1) {
    const expected = pattern[index];
    const actual = segments[index];

    if (expected === undefined || actual === undefined) {
      return null;
    }

    if (expected.kind === "static") {
      if (expected.value !== actual) {
        return null;
      }
      continue;
    }

    params[expected.name] = decodePathSegment(actual);
  }

  return params;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw clientError("INVALID_PATH");
  }
}

function staticCount(route: HttpRoute): number {
  return route.pattern.filter((segment) => segment.kind === "static").length;
}
