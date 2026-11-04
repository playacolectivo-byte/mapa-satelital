import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f7f4ed' };

export const metadata: Metadata = {
  metadataBase: new URL('https://celda-chelem.playacolectivo.chatgpt.site'),
  title: 'Celda Chelem — Una nueva forma de leer la costa',
  description: 'Explora erosión publicada, casos de geotubos e imágenes históricas del litoral de Yucatán, junto con datos de INEGI y CONABIO. Área preliminar de estudio.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
