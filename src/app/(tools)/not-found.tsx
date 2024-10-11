'use client';

import Error from 'next/error';

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <Error statusCode={404} displayName="Garland Qian" title="Garland Qian: your page is not found" />
      </body>
    </html>
  );
}