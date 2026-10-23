export const routes = {
  home: { path: '/pages/index/index', tabBar: false },
} as const;

export type RouteName = keyof typeof routes;
