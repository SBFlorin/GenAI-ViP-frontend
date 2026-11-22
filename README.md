# GenAI-ViP / PaVIAGen — frontend

Vue 3 + TypeScript + Vite client for brief smoking-cessation counselling simulation. The frontend connects to a separate Express/Socket.IO backend.

## Local setup

**Requirements:** Node.js 22.x, npm, and a running GenAI-ViP backend (normally `http://localhost:3000`).

```bash
npm ci
```

Create `.env.development` from `.env.example`, which defines:

```ini
VITE_API_HOST=http://localhost:3000
```

Start Vite on a normal unprivileged port:

```bash
npx vite --host 127.0.0.1 --port 5173
```

Open **http://localhost:5173**. `npm run dev` also uses port 5173 in this release candidate. For a production bundle:

```bash
npm run build
```

The build uses the selected Vite mode and its corresponding environment; check the API host in the build configuration before deployment. Never put API keys, JWT secrets or participant data in `VITE_*` variables.

## How to use the application

The login dialog uses accounts created on the backend (self-registration is not shown by default in the archived UI).

### Student (`user` role)

1. Sign in and open **Informare** (`/student/informare`) for educational information about smoking cessation.
2. Open **Instruire** (`/student/instruire`). The current student page exposes three broad patient-status cards.
3. Select a card to open a new text conversation, enter a counselling message, and read the virtual patient's reply.
4. Repeat the exchange as needed. A VR/voice interface is also exposed, but is not necessary for this basic text demonstration.
5. **Examinare** (`/student/examinare`) is present in the UI, but should not be represented as a formally validated assessment instrument.

### Expert evaluator (`evaluator` role)

1. Sign in and open `/evaluator`.
2. Provide a demonstration alias and clinician form of address, read and accept the consent text in an appropriately authorized setting.
3. Complete the expert profile questionnaire.
4. Examine the first synthetic patient profile, start the chat, and perform a counselling interaction.
5. Finish the conversation and submit the session evaluation.
6. Advance through **10 predefined cases** and complete the final overall evaluation.

The evaluator's 10-persona research catalogue is distinct from the three broad cards shown on the general student training page.

### Administrator (`admin` role)

The code includes `/admin/catalog`, `/admin/statistici`, and evaluator form configuration. These views require an authorized account.

## Study 5 and browser media functions

This October 2026 source snapshot includes a voice interface, but not the later Study 5 station/administration screens or study-specific data. Voice setup requires separate configuration.

## Security and availability

Do not deploy against a shared production backend without reviewing authentication, Socket.IO conversation authorization, data protection, and secure transport. Never commit personal data or credentials. The selected software license is **MIT** (see `LICENSE`); the copyright notice requires confirmation by the authorized rights holder before public release.

A clean frontend build was not executed while preparing this documentation.

## Source provenance

This release candidate is a clean export of frontend source commit `d270a4e` (10 October 2026), with release-only configuration patches. Original Git history is not included. Its partner backend is the clean export of `ce163c6`. The research collection used the earlier frontend commit `a6401d3`.
