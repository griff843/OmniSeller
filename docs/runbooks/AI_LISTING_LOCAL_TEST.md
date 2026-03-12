# AI Listing Local Test

## Prerequisites

- local API, web app, database, and Redis are available
- `OPENAI_API_KEY` is set for the API
- optional `OPENAI_MODEL` is set if you do not want the default model

## 1. Prepare A Test Inventory Item

1. Start from an inventory item that already exists in the local database.
2. Make sure the item has useful source fields filled in:
   - title
   - description
   - brand
   - model
   - condition
   - category if known
3. Upload at least two photos through Photo Studio V1 so the item has ready photos and a primary image.
4. Confirm the item detail page renders the photo gallery before testing AI generation.

## 2. Generate Prisma Client And Apply Migration If Needed

1. Run `pnpm db:generate`.
2. If your local database is behind, run `pnpm db:migrate`.
3. Start services:
   - `pnpm --filter api dev`
   - `pnpm --filter web dev`

## 3. Trigger AI Generation

1. Open the inventory item detail page in the web app.
2. In the AI Listing panel, click `Generate AI listing`.
3. Wait for the workspace to refresh.
4. Confirm the UI shows:
   - generated title
   - generated description
   - suggested category
   - suggested price
   - item specifics if returned

## 4. Verify Persisted Suggestion Rows

1. Inspect the latest suggestion row:

```sql
select id, status, provider, model, title, suggested_category, suggested_price_cents, error_message, created_at
from "AiListingSuggestion"
where inventory_item_id = '<inventory-item-id>'
order by created_at desc;
```

2. Confirm:
   - successful generations are stored with `status = 'GENERATED'`
   - `source_snapshot` is populated
   - `raw_response` is populated on successful generations

## 5. Validate Draft Application

1. In the AI Listing panel, select only a subset of fields such as title and price.
2. Click `Apply selected fields`.
3. Confirm the Operator Draft form updates with only those fields.
4. Verify the database row:

```sql
select inventory_item_id, title, description, category, price_cents, item_specifics, source_suggestion_id, updated_at
from "ListingDraft"
where inventory_item_id = '<inventory-item-id>';
```

5. Confirm:
   - only selected fields changed
   - `source_suggestion_id` points to the applied suggestion

## 6. Validate Manual Editing

1. Edit the draft title, description, category, price, or item specifics manually.
2. Click `Save draft`.
3. Refresh the page.
4. Confirm the saved draft values render exactly as entered.

## 7. Test Regeneration Behavior

1. Click `Regenerate AI listing`.
2. Confirm a new suggestion appears at the top of suggestion history.
3. Verify older suggestions remain visible in history.
4. Confirm the existing draft is unchanged until fields are explicitly applied again.

## 8. Test Malformed Provider Response Handling

1. Temporarily configure the provider to return invalid JSON or schema-invalid output in local development.
2. Trigger AI generation again.
3. Confirm:
   - the API returns an error
   - the UI shows the failure message
   - a new `AiListingSuggestion` row is stored with `status = 'FAILED'`
   - the draft remains unchanged

Suggested verification query:

```sql
select id, status, error_message, created_at
from "AiListingSuggestion"
where inventory_item_id = '<inventory-item-id>'
order by created_at desc;
```

## 9. Validate Publish Compatibility

1. Save a valid draft.
2. Trigger the existing publish flow for the inventory item.
3. Confirm the publish job consumes draft values instead of empty listing defaults.
4. Verify the resulting `Listing` row contains the expected draft fields.
