import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Serve ../assets at /assets so 3D models load from local disk
    // instead of going through the backend over the network
    {
      name: 'serve-local-assets',
      configureServer(server) {
        const assetsDir = path.resolve(__dirname, '../assets')
        server.middlewares.use('/assets', (req, res, next) => {
          const filePath = path.join(assetsDir, req.url || '')
          import('fs').then(fs => {
            if (fs.existsSync(filePath)) {
              res.setHeader('Access-Control-Allow-Origin', '*')
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
            } else {
              next()
            }
          })
        })
      },
    },
  ],
  server: {
    fs: {
      allow: ['.', path.resolve(__dirname, '../assets')],
    },
  },
})
