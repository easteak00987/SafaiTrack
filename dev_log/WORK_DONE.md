# SafaiTrack — Work Done Log

---

## 2026-09-01 | Milestone 1 (Frontend) — Project Scaffold & Styling Foundation

**What I did:**
- Cloned the empty `SafaiTrack` repository from GitHub
- Created the `frontend/`, `backend/`, `database/` folder structure per the architecture plan
- Scaffolded the frontend with Vite: `safai-track-client` (React + TypeScript template)
- Verified the default Vite + React starter page rendered correctly
- Installed and configured **Tailwind CSS v4** via the `@tailwindcss/vite` plugin (not the older `tailwind.config.js` / `init -p` workflow, which is deprecated in v4)
- Replaced the default `index.css` with a single `@import "tailwindcss";` directive
- Verified Tailwind was working with a styled test component
- Initialized **shadcn/ui** with **Radix UI** as the component library (chosen over the "Base UI (Recommended)" default, to stay compatible with Watermelon UI's Radix-based components) and the **Vega** preset (the classic shadcn look, chosen for broad compatibility with third-party component registries)
- Fixed a shadcn import-alias validation failure by adding `baseUrl`/`paths` to `tsconfig.app.json` and a matching `resolve.alias` entry in `vite.config.ts`
- Worked around a bug in `shadcn@4.19.1`'s workspace-config loading step by falling back to `shadcn@4.18.0`, which completed the init successfully
- Installed `motion` and `lucide-react`
- Added base shadcn components: `button`, `card`, `badge`, `separator`, `navigation-menu`

**Commands run:**
```bash
git clone https://github.com/easteak00987/SafaiTrack.git
cd SafaiTrack
mkdir frontend backend database
cd frontend
npm create vite@latest safai-track-client -- --template react-ts
cd safai-track-client
npm install
npm run dev

npm install tailwindcss @tailwindcss/vite
npx shadcn@4.18.0 init
npm install motion lucide-react
npx shadcn@4.18.0 add button card badge separator navigation-menu

git add .
git commit -m "chore: scaffold vite react-ts frontend"
git commit -m "feat: configure tailwind css v4 with vite plugin"
git commit -m "feat: initialize shadcn/ui with radix and vega preset"
git commit -m "feat: add motion, lucide-react, and core shadcn components"
git push origin main
```

**Verification:**
- [PASS] Vite dev server runs, default page renders
- [PASS] Tailwind utility classes apply correctly (confirmed with styled test text)
- [PASS] shadcn/ui init completes with Radix UI + Vega, import alias resolves
- [PASS] `motion`, `lucide-react`, and 5 shadcn components installed with no errors
- [PASS] All work committed and pushed to `main`

**Issues encountered:**
- `npx tailwindcss init -p` failed (`could not determine executable to run`) — root cause was Tailwind v4 removing the CLI `init` command entirely; resolved by switching to the `@tailwindcss/vite` plugin workflow instead
- `npx shadcn@latest init` failed at "Validating import alias" — resolved by adding `baseUrl`/`paths` to `tsconfig.app.json` and an alias resolver to `vite.config.ts`
- `npx shadcn@latest init` (v4.19.1) failed after writing `components.json` with "Could not load the workspace config" — resolved by using `shadcn@4.18.0` instead

**Next steps:**
- Select and adapt a Watermelon UI Hero block for the landing page, styled with the project's Sky Blue / Emerald color palette
- Build out Features, How It Works, SDG Alignment, Stats, and Footer sections
- Sync with Fairuz before she begins the backend solution structure (Milestone 1 backend) to avoid folder/structure conflicts in `backend/`
