---
summary: Supported LLM adapters and the environment variables required for Gemini and Groq.
read_when:
  - switching between Gemini and Groq
  - adding or debugging an LLM adapter
  - checking provider-specific env vars
---

# Providers

## Supported Adapters

- `gemini`
- `groq`

Set `LLM_PROVIDER` in `.env` to choose the adapter.

## Gemini

Required:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

Optional:

```env
GEMINI_MODEL=gemini-2.5-flash
```

## Groq

Required:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your-key
```

Optional:

```env
GROQ_MODEL=llama-3.3-70b-versatile
```

## Current Provider Contract

Each adapter implements:

- decision generation for the recursive tool loop
- conversation summarization for compaction/memory
- shared user-facing error handling via the runner

## Switching Providers

- Stop the CLI
- Update `.env`
- Start the CLI again with `npm run dev`

No code changes are needed to switch between Gemini and Groq.
