import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 把前端发到 /api 的请求代理到后端 3000 端口
    // 这样前端开发时不会遇到跨域问题
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true, // 代理 WebSocket
      },
    },
  },
})
