// Service worker de la versión web de Venollis Photo Booth Studio.
// 1. Sirve las capturas y plantillas guardadas en el dispositivo (rutas .../venollis/...).
// 2. Guarda la propia app para que abra sin internet.

const FILES = 'venollis-files'
const SHELL = 'venollis-app-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/** Los videos piden trozos del archivo (Range); sin esto no se reproducen en iPhone. */
async function ranged(response, header) {
  const blob = await response.blob()
  const match = /bytes=(\d*)-(\d*)/.exec(header)
  if (!match) return new Response(blob, { headers: response.headers })
  const start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/octet-stream',
      'content-range': `bytes ${start}-${end}/${blob.size}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes'
    }
  })
}

async function savedFile(request) {
  const cache = await caches.open(FILES)
  const response = await cache.match(request.url.split('?')[0])
  if (!response) return new Response('No encontrado', { status: 404 })
  const range = request.headers.get('range')
  return range ? ranged(response, range) : response
}

/** La app: primero la red (para recibir actualizaciones) y, sin conexión, la copia guardada. */
async function appFile(request) {
  const cache = await caches.open(SHELL)
  try {
    const response = await fetch(request)
    if (response.ok) void cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  event.respondWith(url.pathname.includes('/venollis/') ? savedFile(request) : appFile(request))
})
