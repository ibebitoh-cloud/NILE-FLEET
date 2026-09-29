import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
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

              if (moduleId.includes('/node_modules/')) return 'vendor';
            }
          }
        }
      }
    };
});
