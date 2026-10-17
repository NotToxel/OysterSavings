export const navigation = [
  { href: '/', label: 'Overview', iconPath: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
  { href: '/analysis/', label: 'Analysis', iconPath: 'M4 3v17h17 M9 15v-4 M14 15V6 M19 15V9' },
  { href: '/compare/', label: 'Compare', iconPath: 'M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4' },
  { href: '/planner/', label: 'Planner', iconPath: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M8 14h2 M14 14h2 M8 18h2' },
  { href: '/help/', label: 'Help', iconPath: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2-3 4 M12 17h.01' },
] as const;

export const legacyRoutes: Partial<Record<string, typeof navigation[number]['href']>> = {
  home: '/', analysis: '/analysis/', compare: '/compare/', planner: '/planner/', faq: '/help/',
};
