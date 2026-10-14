# AFTERGLOW — interactive 3D experience

A code-first, responsive digital-art landing page built with React, Vite and Three.js/WebGL. The main sculpture and carousel are rendered in real time, not inserted as screenshots.

## Requirements

- Node.js 20 LTS or newer
- npm 10 or newer

## Local development (Windows)

1. Extract this project.
2. Open the `afterglow-react` folder in File Explorer.
3. Click the address bar, type `cmd`, and press Enter.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local URL printed in the console (normally `http://localhost:5173`).

## Production build

```bash
npm install
npm run build
npm run preview
```

Vite outputs the deployable static website into `dist/`. Upload the **contents** of `dist/` to a static web host, or connect the repository to Netlify/Vercel and let it build using the included configuration.

## Deployment settings

- Build command: `npm run build`
- Publish/output directory: `dist`
- Node.js: 20+

## Before going public

- Replace `hello@afterglow.studio` in `src/main.jsx` with the real contact address if that domain is not yours.
- Add the final domain to Open Graph metadata and create a canonical URL once the domain is known.
- Test the page on a real phone and desktop browser after deployment, especially WebGL performance on mobile.

## Notes

- Three.js scene uses generated geometry and a procedural studio environment; no external 3D asset files are required.
- Google Fonts load remotely when available. System fallbacks are included.
- The site respects the user's reduced-motion preference.
