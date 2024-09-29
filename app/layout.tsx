import './globals.css';

export const metadata = {
  title: "GarlandQian's Daily Tools",
  description:
    'A website for normal person.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen w-full flex-col">{children}</body>
    </html>
  );
}
