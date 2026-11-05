export type SyncIssue = {
  kind: "schema" | "permission" | "network" | "other";
  message: string;
};
export function explainSyncError(error: unknown): SyncIssue {
  const e = error as { code?: string; message?: string };
  const message = e?.message || String(error);
  if (
    e?.code === "PGRST205" ||
    e?.code === "42P01" ||
    (/public\.library|relation.*library/i.test(message) &&
      /not find|does not exist|cache/i.test(message))
  )
    return {
      kind: "schema",
      message:
        "Supabase ne trouve pas la table public.library. Ouvrez « Corriger Supabase » et exécutez le script SQL dans votre projet. Votre collection reste enregistrée sur cet appareil.",
    };
  if (
    e?.code === "42501" ||
    /row.level security|permission denied/i.test(message)
  )
    return {
      kind: "permission",
      message:
        "Supabase refuse l’accès à votre collection. Réexécutez le script SQL pour installer les autorisations, puis reconnectez-vous.",
    };
  if (/fetch|network|offline|timeout|abort/i.test(message))
    return {
      kind: "network",
      message:
        "Connexion à Supabase indisponible. Votre collection est conservée sur cet appareil ; réessayez la synchronisation plus tard.",
    };
  return {
    kind: "other",
    message:
      "La synchronisation n’a pas abouti. Votre collection est conservée sur cet appareil. Vérifiez la configuration Supabase et réessayez.",
  };
}
