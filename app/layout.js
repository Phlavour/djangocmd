export const metadata = { title: "DjangoCMD", description: "Django Command Center" };
export default function RootLayout({ children }) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning>{children}</body></html>;
}
