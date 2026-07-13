import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import fs from 'fs'

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(pkg.version)
  },
  resolve: { 
    alias: [
      { find: /^@\//, replacement: path.resolve(__dirname, 'src') + '/' }
    ] 
  },
  build: { 
    target: 'esnext', 
    outDir: 'build' 
  },
  server: { 
    port: 5173, 
    open: false 
  },
})