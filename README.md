# Lapak Kita — Clean Source

This project is a React + TypeScript + Vite marketplace that uses Supabase for authentication, database access, and checkout.

## AI-related cleanup

- Removed the `.bolt` project configuration and prompt files.
- Removed Bolt-hosted Open Graph and Twitter preview image references from `index.html`.
- No AI model/API integration (such as OpenAI, Gemini, or Anthropic) was found in the application source code.

## Setup

1. Install Node.js (LTS recommended).
2. Run `npm install`.
3. Create a `.env` file in the project root with your Supabase project settings:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run `npm run dev` to start the development server.
5. Run `npm run build` to create a production build.

The `.env` file from the uploaded archive is intentionally not included in this cleaned package. Add your own Supabase settings locally.
