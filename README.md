# CV Processor

A personal, single-user web tool to enhance a hardcoded master CV against a pasted job description using OpenAI.

## Core behavior

- Fixed 6 CV sections are prefilled from hardcoded source content.
- User pastes a job description and clicks **Enhance CV**.
- Each section is processed independently with server actions.
- Section updates are applied as soon as each enhancement succeeds.
- Prompt template sent to AI is visible, editable, and persisted in localStorage.
- Each section can be edited and reset independently.
- Enhanced/edited content is persisted temporarily in `localStorage`.
- Export uses browser-native print (`Ctrl+P`) to save as PDF.

## Environment variables

Create `.env` and add:

```bash
OPENAI_API_KEY=your_openai_api_key
```

Optional:

```bash
OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER=openai
```

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- No authentication
- No database
- No file uploads
- No permanent saving (base CV always starts from hardcoded content)
- AI provider logic is isolated in `lib/ai-provider.ts` for future provider swaps
