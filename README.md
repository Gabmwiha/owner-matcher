# Owner Matcher

Assign ownerless account records to the right owner, then export the result for your workflow.

Paste your ownerless accounts and your available owner profiles (CSV, first column is the id), tap **Suggest matches**, and the app asks a model for the most likely owner of each account with a confidence score and a short reason. **Export CSV** gives you every account with its suggested owner.

## Records

`records/ownerless-accounts.csv` holds the ownerless account records in plain CSV so they live in version control instead of only in the browser. Add rows there, or paste your own list into the app and export it back.

Columns: `id,name,email,team`

## Running locally

```sh
git clone <this-repository-url>
cd owner-matcher
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Lovable AI Gateway for the matching step
