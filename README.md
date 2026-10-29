# LQC — League Querétaro Championship

Tournament platform for the League Querétaro Championship, a competitive *League of Legends* league based in Querétaro, México. Covers team and player pages, standings, match schedule and live broadcast information for each split.

**Live:** https://lqc.revolution505.com/

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Router |
| Language | TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Data / backend | Supabase |
| Icons & media | lucide-react, react-lazy-load-image-component |
| Tooling | ESLint, Playwright |
| Deployment | Docker, nginx, Nixpacks |

## Running locally

```bash
npm install
cp .env.example .env    # add your Supabase credentials
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint the project |
| `npm run capturas` | Capture screenshots via Playwright |

## Deployment

Containerised with Docker and served through nginx. Nixpacks configuration is included for platform deploys.

---

Built by [Christian Jair Loeza Zermeño](https://github.com/ChristianJair27) · [Revolution505](https://revolution505.com)
