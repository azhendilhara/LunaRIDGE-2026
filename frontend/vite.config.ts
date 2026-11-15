import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {apiBase} from './src/utils/apiBase.ts'
export default defineConfig(({command,mode}) => {
  const env={...loadEnv(mode,process.cwd(),''),...process.env};
  const origin=apiBase(env.VITE_API_BASE_URL,command==='build',env.ALLOW_LOCAL_API_BUILD==='1');
  return {
    plugins:[react(),tailwindcss(),{
      name:'release-security-headers',
      generateBundle(){this.emitFile({type:'asset',fileName:'_headers',source:`/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ${origin}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`})}
    }],
    server:{port:5173,proxy:{'/api':{target:origin,changeOrigin:true},'/health':{target:origin,changeOrigin:true}}},
    build:{rollupOptions:{output:{manualChunks(id:string){if(id.includes('node_modules/recharts')||id.includes('node_modules/d3-')||id.includes('node_modules/victory-vendor'))return 'charts';}}}}
  }
})
