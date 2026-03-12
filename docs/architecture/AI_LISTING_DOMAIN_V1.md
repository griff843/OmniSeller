# AI Listing Domain V1

## Responsibilities

The AI listing domain produces advisory listing suggestions from inventory truth and current photo state. It does not publish listings, mutate inventory records, or silently replace operator-entered draft data.

Core responsibilities:

- gather structured source context from `InventoryItem` and ready photos
- call an AI provider through a provider-agnostic service boundary
- validate structured output before persisting it
- persist suggestion history, failures, and operator-applied draft state
- expose a reviewable workspace to the web app

## Truth Boundaries

The database remains the source of truth with three separate layers:

- `InventoryItem`: source-of-truth product facts captured by the operator and intake workflows
- `AiListingSuggestion`: advisory AI output, versioned and historical, including failed generations
- `ListingDraft`: operator-controlled draft data used by the publish pipeline

AI suggestions never overwrite inventory truth. Draft updates only occur through explicit operator actions:

- applying selected AI fields
- manually editing and saving the draft

## Storage Model

`AiListingSuggestion` stores:

- provider and model used
- prompt version
- generation status: `GENERATED`, `APPLIED`, `FAILED`
- structured suggestion fields: title, description, category, price, item specifics
- source snapshot used for generation
- raw provider response when generation succeeds
- error message when generation fails

`ListingDraft` stores:

- marketplace
- title
- description
- category
- price
- item specifics
- optional `sourceSuggestionId` pointing at the last AI suggestion applied into the draft

## Provider Boundary

Business logic depends on the `ListingAiProvider` contract, not directly on OpenAI or any HTTP client.

The boundary is split into:

- `ListingPromptBuilder`: shapes inventory and photo context into prompt input
- `ListingAiProvider`: provider-agnostic generation interface
- `OpenAiListingProvider`: current provider implementation
- `listingSuggestionSchema`: structured output validator

This keeps route/controller code free of prompt assembly and provider-specific response parsing.

## Prompt And Input Shaping Rules

Generation uses:

- inventory title, description, brand, model, category, condition, UPC, and cost basis when present
- current ready photos ordered with the primary photo first
- deterministic prompt versioning via `LISTING_PROMPT_VERSION`

Prompt shaping rules:

- send only current, operator-visible inventory truth
- include only non-deleted ready photos with URLs
- prefer concise structured product context over raw database dumps
- keep prompt construction isolated so later marketplaces can add tailored views without rewriting controllers

## Structured Output Validation

Provider output must validate against the schema before it is treated as a successful suggestion.

Validation rules:

- title must be present and string-typed
- description must be present and string-typed
- category must be present and string-typed
- price must be numeric in cents
- item specifics must be a string key/value object

Malformed or incomplete responses are treated as failures:

- a failed `AiListingSuggestion` row is persisted
- the operator sees an honest failure state in the UI
- the draft remains unchanged

## Draft Integration

The V1 path is:

1. inventory item provides source context
2. operator requests AI generation
3. validated suggestion is persisted
4. operator selectively applies fields into `ListingDraft`
5. operator manually edits `ListingDraft`
6. publish pipeline reads `ListingDraft` when creating or updating marketplace listings

This keeps the current publish flow compatible while preserving operator control.

## Future Extension Path

The current seams support later enhancements without a domain rewrite:

- richer category mapping services per marketplace
- marketplace-specific item specifics expansion
- additional providers such as Claude through the same provider contract
- stronger photo-aware prompts and vision improvements
- price intelligence layered on top of draft suggestions rather than replacing them
