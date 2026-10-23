import { routes } from '../config/routes';

export type RouteName = keyof typeof routes;
export type RouteQueryValue = string | number | boolean | null | undefined;
export type RouteQuery = Readonly<Record<string, RouteQueryValue>>;
export type TabRouteName = {
  [Name in RouteName]: (typeof routes)[Name]['tabBar'] extends true ? Name : never;
}[RouteName];
export type PageRouteName = Exclude<RouteName, TabRouteName>;
export type RouteArguments<Name extends RouteName> = (typeof routes)[Name]['tabBar'] extends true
  ? []
  : [query?: RouteQuery];

export class NavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NavigationError';
  }
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : '/' + path;
}

function buildUrl(name: RouteName, query?: RouteQuery): string {
  const route = routes[name];
  if (!route) throw new NavigationError('Unknown route: ' + String(name));
  const path = normalizePath(route.path);
  if (route.tabBar) {
    if (query !== undefined) {
      const keys = Object.keys(query);
      for (const key of keys) {
        if (query[key] === undefined) continue;
        throw new NavigationError('Tab routes cannot contain query parameters');
      }
    }
    return path;
  }
  const parts: string[] = [];
  if (query !== undefined) {
    const keys = Object.keys(query);
    for (const key of keys) {
      const value = query[key];
      if (value === undefined || value === null) continue;
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new NavigationError('Route query numbers must be finite');
      }
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    }
  }
  return parts.length === 0 ? path : path + '?' + parts.join('&');
}

function assertRouteKind(name: RouteName, tabBar: boolean): void {
  const route = routes[name];
  if (!route || route.tabBar !== tabBar) {
    throw new NavigationError(
      tabBar ? 'switchTab requires a tab route' : 'Use switchTab for tab routes',
    );
  }
}

export function navigate(name: PageRouteName, query?: RouteQuery): Promise<void> {
  assertRouteKind(name, false);
  const url = buildUrl(name, query);
  return new Promise<void>((resolve, reject) => {
    wx.navigateTo({ url, success: () => resolve(), fail: reject });
  });
}

export function redirect(name: PageRouteName, query?: RouteQuery): Promise<void> {
  assertRouteKind(name, false);
  const url = buildUrl(name, query);
  return new Promise<void>((resolve, reject) => {
    wx.redirectTo({ url, success: () => resolve(), fail: reject });
  });
}

export function relaunch<Name extends RouteName>(
  name: Name,
  ...args: RouteArguments<Name>
): Promise<void> {
  const url = buildUrl(name, args[0]);
  return new Promise<void>((resolve, reject) => {
    wx.reLaunch({ url, success: () => resolve(), fail: reject });
  });
}

export function switchTab(name: TabRouteName): Promise<void> {
  assertRouteKind(name, true);
  const url = buildUrl(name, undefined);
  return new Promise<void>((resolve, reject) => {
    wx.switchTab({ url, success: () => resolve(), fail: reject });
  });
}

/** 栈不足时拒绝，不做静默 relaunch。 */
export function back(delta = 1): Promise<void> {
  if (!Number.isSafeInteger(delta) || delta < 1) {
    throw new NavigationError('Back delta must be a positive safe integer');
  }
  if (getCurrentPages().length <= delta) {
    throw new NavigationError('Not enough pages in the navigation stack');
  }
  return new Promise<void>((resolve, reject) => {
    wx.navigateBack({ delta, success: () => resolve(), fail: reject });
  });
}
