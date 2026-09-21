# Arbor

Arbor is a local-first, tree-structured AI learning tool. It keeps a familiar chat interface while letting any top-level answer section become the anchor for a new learning branch.

The v0.1 app is entirely client-side: conversations, branches, providers, and preferences are stored in IndexedDB, and model requests go directly from the browser to the provider you configure.

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Useful checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

The first E2E run may require `npx playwright install chromium`.

## Provider configuration

Open **Settings → Providers**, add a provider, and choose one of these protocols:

- Anthropic (`/v1/messages`)
- OpenAI Responses (`/v1/responses`)
- OpenAI-compatible Chat Completions (`/v1/chat/completions`)

Enter a name, API root URL, API key, and model. Arbor accepts a service root, a URL ending in `/v1`, or the complete protocol endpoint. Use **Test connection** before saving, then mark the provider active.

By default, API keys are session-only. Enabling **Remember API key on this device** stores the key in IndexedDB. Full backups omit keys unless you explicitly opt in.

## Browser security and CORS

Arbor has no backend. Your API key and prompts are sent directly from the current browser to the configured model service. Browser storage is convenient but is not a secure vault.

The provider must allow browser requests from the deployed origin. If its CORS policy blocks the request, Arbor reports that separately from authentication and model errors. Some official or self-hosted endpoints may require a CORS-enabled gateway; configure such a gateway as the Base URL and assess its trust and key-handling policy yourself.

## GitHub Pages

The app uses `HashRouter` and relative Vite assets, so repository subpaths work without a custom 404 fallback. The included workflow builds and deploys on pushes to `main` or `master`.

1. Push the repository to GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Run the `Deploy Arbor to GitHub Pages` workflow or push to the default branch.

The production route is `/#/`; settings are at `/#/settings`.

## Data model

Conversations and nodes are stored separately. Each node carries a `parentNodeId`; Arbor reconstructs only the root-to-current path for display and model context. If a child was created from an answer section, only that selected parent section is included in the next context instead of its sibling sections.

Single conversations and full local backups can be exported as schema-versioned JSON from Settings.
