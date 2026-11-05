// Public client identifiers shared by the website and the bundled Android app.
// Legacy tests exercise manual configuration in Vite's isolated test mode.
const isolated =
  typeof window === "undefined" || import.meta.env?.MODE === "test";
export const defaultServices = {
  supabaseUrl: isolated ? "" : "https://ilrigdnewnsneuwbggqg.supabase.co",
  supabaseKey: isolated ? "" : "sb_publishable_cERkPn3k_ikjhtiMVg7O5g_DHXE8QNP",
  tmdbKey: isolated ? "" : "982936a8c725ff021ed20d2641f6732c",
};
export const serviceDefaults = {
  url:
    import.meta.env?.VITE_SUPABASE_URL?.trim() || defaultServices.supabaseUrl,
  key:
    import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() ||
    defaultServices.supabaseKey,
  tmdb:
    import.meta.env?.VITE_TMDB_READ_TOKEN?.trim() ||
    import.meta.env?.VITE_TMDB_API_KEY?.trim() ||
    defaultServices.tmdbKey,
};
