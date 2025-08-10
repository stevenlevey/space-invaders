import './globals.css'

export const metadata = {
  title: 'Space Invaders',
  description: 'A tiny canvas game',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b1020" />
        <link rel="apple-touch-icon" href="/hulk.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Invaders" />
      </head>
      <body>{children}</body>
    </html>
  )
}


