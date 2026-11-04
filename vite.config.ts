import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              const moduleId = id.replace(/\\/g, '/');

              // Keep the code-page table separate from the Excel engine so
              // the lazy-loaded spreadsheet feature does not ship as one
              // oversized vendor file.
              if (moduleId.includes('/node_modules/xlsx-js-style/dist/cpexcel.js')) return 'xlsx-codepages';
              if (moduleId.includes('/node_modules/xlsx-js-style/')) return 'xlsx-engine';

              if (moduleId.includes('/node_modules/react/') ||
                  moduleId.includes('/node_modules/react-dom/') ||
                  moduleId.includes('/node_modules/scheduler/')) return 'react-vendor';
              if (moduleId.includes('/node_modules/@supabase/')) return 'supabase-vendor';
              if (moduleId.includes('/node_modules/recharts/') ||
                  moduleId.includes('/node_modules/d3-') ||
                  moduleId.includes('/node_modules/victory-vendor/')) return 'charts-vendor';

              // Keep Vite's lazy-load helper in the always-loaded vendor chunk,
              // otherwise Rollup can hoist it into a lazy chunk and preload that chunk.
              if (moduleId.includes('vite/preload-helper')) return 'vendor';
              // Invoice Maker libraries load only with that screen.
              if (/\/node_modules\/(jspdf|html2canvas|lucide-react|fflate|fast-png|iobuffer|pako|canvg|dompurify|core-js|raf|performance-now|@babel\/runtime|rgbcolor|stackblur-canvas|svg-pathdata|css-line-break|text-segmentation|utrie|base64-arraybuffer)\//.test(moduleId)) return 'invoice-vendor';

              if (moduleId.includes('/node_modules/')) return 'vendor';
            }
          }
        }
      }
    };
});
