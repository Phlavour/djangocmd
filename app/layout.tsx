export const metadata = { title: "DjangoCMD", description: "Django Command Center" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
