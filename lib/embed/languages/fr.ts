import type { EmbedLanguage } from "./types";

export const FR: EmbedLanguage = {
  id: "fr",
  label: "Français",
  strings: {
    searchLabel: "Rechercher des lieux",
    searchPlaceholder: "Rechercher un lieu ou un code postal",
    nearest: "Autour de moi",
    nearestStop: "Ne plus mesurer depuis ici",
    nearestFound: "{place} — à {distance}",
    locating: "Recherche de votre position…",
    locationOff:
      "La localisation est désactivée pour ce site. Activez-la dans votre navigateur, puis réessayez.",
    locationTimeout: "Impossible de vous localiser à temps. Réessayez.",
    locationUnsupported: "Ce navigateur ne peut pas partager de position.",
    locationFailed: "Impossible d’obtenir votre position.",
    locations: "Lieux",
    noMatch: "Aucun lieu ne correspond.",
    directions: "Itinéraire",
    email: "E-mail",
    website: "Site web",
    moreDetails: "Plus de détails",
    openNow: "Ouvert actuellement",
    closedNow: "Fermé actuellement",
    closed: "Fermé",
    previousPhoto: "Photo précédente",
    nextPhoto: "Photo suivante",
    dismiss: "Fermer",
  },
  badge: "Créé avec {brand}",
};
