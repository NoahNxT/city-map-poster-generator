import type { Locale } from "./config";

type PolicySection = {
  heading: string;
  paragraphs: string[];
};

type PolicyPage = {
  title: string;
  description: string;
  updatedLabel: string;
  updatedAt: string;
  intro: string;
  sections: PolicySection[];
};

export type Dictionary = {
  seo: {
    siteName: string;
    siteTitle: string;
    siteDescription: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    homepageTitle: string;
    homepageDescription: string;
    privacyTitle: string;
    privacyDescription: string;
    cookiesTitle: string;
    cookiesDescription: string;
  };
  languageName: string;
  languageLabel: string;
  header: {
    badge: string;
    title: string;
    subtitle: string;
  };
  controls: {
    title: string;
    description: string;
    location: string;
    locationPlaceholder: string;
    locationHelp: string;
    city: string;
    cityPlaceholder: string;
    cityRequired: string;
    country: string;
    countryPlaceholder: string;
    countryRequired: string;
    searchingLocations: string;
    noLocationResults: string;
    distance: string;
    theme: string;
    browseThemes: string;
    format: string;
    generateAllThemesTitle: string;
    generateAllThemesDescription: string;
    advancedOptions: string;
    latitude: string;
    longitude: string;
    width: string;
    height: string;
    mapLayersTitle: string;
    mapLayersDescription: string;
    includeWater: string;
    includeWaterDescription: string;
    includeParks: string;
    includeParksDescription: string;
    typographyTitle: string;
    typographyDescription: string;
    cityFontSize: string;
    countryFontSize: string;
    autoThemeDefault: string;
    labelPaddingScale: string;
    labelPaddingHelp: string;
    blurTitle: string;
    blurDescription: string;
    blurSize: string;
    blurStrength: string;
    textColor: string;
    autoThemeTextColor: string;
    textColorHelp: string;
    pickCustomTextColor: string;
    reset: string;
    googleFontFamily: string;
    googleFontHelpTitle: string;
    googleFontHelpDescription: string;
    explainGoogleFontFamily: string;
    selectGoogleFont: string;
    searchGoogleFonts: string;
    searchGoogleFontsAria: string;
    searchGoogleFontsHelp: string;
    searchingFonts: string;
    fontSearchUnavailable: string;
    noFallbackFonts: string;
    noFontsFound: string;
    selection: string;
    themeDefaultFont: string;
    fallbackFonts: string;
    googleFonts: string;
    generatedButton: string;
    queueingButton: string;
    captchaMissing: string;
    coordsUnavailable: string;
    locationSuggestionsCountLabel: string;
  };
  preview: {
    title: string;
    description: string;
    disableRateLimitTitle: string;
    disableRateLimitDescription: string;
    zoomTitle: string;
    zoomDescription: string;
    zoomLevel: string;
    zoomLevelValue: string;
    zoomValue: string;
    posterAlt: string;
    textOverlayTitle: string;
    magnifiedTitle: string;
    magnifiedOverlayTitle: string;
  };
  status: {
    title: string;
    description: string;
    idle: string;
    idleBadge: string;
    queuedBadge: string;
    jobLabel: string;
    generationComplete: string;
    generationFailed: string;
    preparingDownload: string;
    download: string;
  };
  themeExplorer: {
    title: string;
    description: string;
    loadingPreview: string;
    previewUnavailable: string;
    selected: string;
  };
  footer: {
    privacyPolicy: string;
    cookiePolicy: string;
  };
  cookieBanner: {
    title: string;
    description: string;
    essentialOnly: string;
    acceptAll: string;
  };
  policies: {
    privacy: PolicyPage;
    cookies: PolicyPage;
  };
};

const en: Dictionary = {
  seo: {
    siteName: "City Map Poster Generator",
    siteTitle: "Create Beautiful City Map Posters Online",
    siteDescription:
      "Generate high-quality city map posters instantly with built-in themes, typography controls, and export formats.",
    keywords: [
      "city map poster generator",
      "custom map poster",
      "map art maker",
      "city poster",
      "map print design",
      "maptoposter",
    ],
    ogTitle: "Create Beautiful City Map Posters Online",
    ogDescription:
      "Generate map posters in minutes with themes, typography controls, and export-ready files.",
    homepageTitle: "Generate Custom City Map Posters",
    homepageDescription:
      "Design and download custom city map posters in minutes with powerful controls and built-in themes.",
    privacyTitle: "Privacy Policy",
    privacyDescription:
      "Learn how City Map Poster Generator handles personal data and privacy choices.",
    cookiesTitle: "Cookie Policy",
    cookiesDescription:
      "Learn which cookies are used by City Map Poster Generator and why.",
  },
  languageName: "English",
  languageLabel: "Language",
  header: {
    badge: "Public Poster Generator",
    title: "Generate city map posters instantly",
    subtitle:
      "Create high-resolution posters with all built-in maptoposter themes, multilingual labels, and export options without signing in.",
  },
  controls: {
    title: "Map Controls",
    description:
      "All maptoposter options are available here, including advanced fields.",
    location: "Location",
    locationPlaceholder: "Search city, district, landmark...",
    locationHelp:
      "Select a suggestion to auto-fill city/country and precise coordinates.",
    city: "City",
    cityPlaceholder: "Paris",
    cityRequired: "City is required.",
    country: "Country",
    countryPlaceholder: "France",
    countryRequired: "Country is required.",
    searchingLocations: "Searching locations...",
    noLocationResults: "No results found for this query.",
    distance: "Distance",
    theme: "Theme",
    browseThemes: "Browse themes",
    format: "Format",
    generateAllThemesTitle: "Generate all themes",
    generateAllThemesDescription:
      "Creates all 17 themes and bundles ZIP download.",
    advancedOptions: "Advanced Options",
    latitude: "Latitude",
    longitude: "Longitude",
    width: "Width (inches, max 20)",
    height: "Height (inches, max 20)",
    mapLayersTitle: "Map Layers (Export)",
    mapLayersDescription:
      "Applies to final generation only. Preview remains on fast server defaults.",
    includeWater: "Include water",
    includeWaterDescription: "Rivers, lakes, canals.",
    includeParks: "Include parks/greens",
    includeParksDescription: "Parks and grass areas.",
    typographyTitle: "Typography Overrides",
    typographyDescription:
      "Optional custom city/country sizes and text color for preview and exports.",
    cityFontSize: "City font size (pt)",
    countryFontSize: "Country font size (pt)",
    autoThemeDefault: "Auto (theme default)",
    labelPaddingScale: "Label padding scale",
    labelPaddingHelp:
      "Increases spacing between city, divider, country, and coordinates when typography is larger.",
    blurTitle: "Text backdrop blur",
    blurDescription: "Adds a soft blurred panel behind the text block.",
    blurSize: "Blur size",
    blurStrength: "Blur strength",
    textColor: "Text color override",
    autoThemeTextColor: "Auto (theme text color)",
    textColorHelp:
      "Supports hex colors like #8C4A18 or #abc. Leave empty to use theme text color.",
    pickCustomTextColor: "Pick custom text color",
    reset: "Reset",
    googleFontFamily: "Google Font Family",
    googleFontHelpTitle: "Typography family",
    googleFontHelpDescription:
      "Downloads and applies a Google Font family to city, country, and coordinate labels in the final render.",
    explainGoogleFontFamily: "Explain Google Font Family",
    selectGoogleFont: "Select Google Font...",
    searchGoogleFonts: "Search Google Fonts...",
    searchGoogleFontsAria: "Search Google Font family",
    searchGoogleFontsHelp: "Search and select from Google Fonts results only.",
    searchingFonts: "Searching fonts...",
    fontSearchUnavailable:
      "Font search unavailable. Showing fallback suggestions.",
    noFallbackFonts: "No fallback fonts match this query.",
    noFontsFound: "No matching fonts found.",
    selection: "Selection",
    themeDefaultFont: "Theme default font",
    fallbackFonts: "Fallback Fonts",
    googleFonts: "Google Fonts",
    generatedButton: "Generate Poster",
    queueingButton: "Queueing job...",
    captchaMissing:
      "CAPTCHA site key is not configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY.",
    coordsUnavailable: "Select a location to show coordinates",
    locationSuggestionsCountLabel: "{count} location suggestions available.",
  },
  preview: {
    title: "Live Preview",
    description:
      "Preview is an approximation and may vary slightly from the final exported poster.",
    disableRateLimitTitle: "Disable all API rate limits",
    disableRateLimitDescription:
      "Development only. Disables all API throttling.",
    zoomTitle: "Zoom box",
    zoomDescription: "Inspect smaller text in the preview.",
    zoomLevel: "Zoom level",
    zoomLevelValue: "{value}x",
    zoomValue: "Zoom {value}x",
    posterAlt: "Poster preview",
    textOverlayTitle: "Poster text preview overlay",
    magnifiedTitle: "Magnified poster preview",
    magnifiedOverlayTitle: "Magnified poster typography overlay",
  },
  status: {
    title: "Generation Status",
    description: "Queued jobs update automatically every two seconds.",
    idle: "No active generation job.",
    idleBadge: "idle",
    queuedBadge: "queued",
    jobLabel: "Job",
    generationComplete: "Generation complete",
    generationFailed: "Generation failed",
    preparingDownload: "Preparing download...",
    download: "Download",
  },
  themeExplorer: {
    title: "Theme Explorer",
    description:
      "Compare all built-in styles and pick the look that fits your poster outcome.",
    loadingPreview: "Loading preview",
    previewUnavailable: "Preview unavailable",
    selected: "Selected",
  },
  footer: {
    privacyPolicy: "Privacy Policy",
    cookiePolicy: "Cookie Policy",
  },
  cookieBanner: {
    title: "Cookie notice",
    description:
      "We use essential cookies to remember language and keep this site reliable. Read our Cookie Policy and Privacy Policy for details.",
    essentialOnly: "Essential only",
    acceptAll: "Accept",
  },
  policies: {
    privacy: {
      title: "Privacy Policy",
      description: "How we process and protect your personal data.",
      updatedLabel: "Last updated",
      updatedAt: "March 2, 2026",
      intro:
        "This Privacy Policy explains how City Map Poster Generator processes information when you use this website.",
      sections: [
        {
          heading: "1. Data we process",
          paragraphs: [
            "We process technical request data such as IP address, user agent, and request timestamps to operate, secure, and rate-limit the service.",
            "When you generate posters, we process location and poster configuration fields you submit in order to create artifacts.",
          ],
        },
        {
          heading: "2. Why we process data",
          paragraphs: [
            "To provide core functionality, prevent abuse, monitor service health, and debug operational issues.",
          ],
        },
        {
          heading: "3. Storage and retention",
          paragraphs: [
            "Generated artifacts and preview files are stored temporarily and automatically expire.",
            "Operational logs may be retained for security and reliability purposes for a limited period.",
          ],
        },
        {
          heading: "4. Third-party services",
          paragraphs: [
            "The application may call external providers (for example geocoding, map data, CAPTCHA, and font services) as part of generating outputs.",
          ],
        },
        {
          heading: "5. Your rights",
          paragraphs: [
            "If GDPR applies to you, you may have rights to access, rectify, erase, restrict, object, and data portability under applicable law.",
          ],
        },
      ],
    },
    cookies: {
      title: "Cookie Policy",
      description: "What cookies are used and for what purpose.",
      updatedLabel: "Last updated",
      updatedAt: "March 2, 2026",
      intro:
        "This Cookie Policy explains which cookies are used by City Map Poster Generator.",
      sections: [
        {
          heading: "1. Essential cookies",
          paragraphs: [
            "site_locale: remembers your language preference.",
            "site_cookie_consent: remembers your cookie banner choice.",
          ],
        },
        {
          heading: "2. Why cookies are used",
          paragraphs: [
            "Cookies are used to provide language persistence and store your consent preference.",
          ],
        },
        {
          heading: "3. Managing cookies",
          paragraphs: [
            "You can clear cookies in your browser settings. If you do, language and consent preferences may reset.",
          ],
        },
      ],
    },
  },
};

const nl: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle: "Maak online prachtige stadskaartposters",
    siteDescription:
      "Genereer direct stadskaartposters in hoge kwaliteit met ingebouwde thema's, typografie-instellingen en exportformaten.",
    homepageTitle: "Genereer aangepaste stadskaartposters",
    homepageDescription:
      "Ontwerp en download in enkele minuten aangepaste stadskaartposters.",
    privacyTitle: "Privacybeleid",
    cookiesTitle: "Cookiebeleid",
  },
  languageName: "Nederlands",
  header: {
    badge: "Publieke Poster Generator",
    title: "Genereer direct stadskaartposters",
    subtitle:
      "Maak posters in hoge resolutie met alle ingebouwde maptoposter-thema's, meertalige labels en exportopties zonder in te loggen.",
  },
  controls: {
    ...en.controls,
    title: "Kaartinstellingen",
    location: "Locatie",
    city: "Stad",
    cityRequired: "Stad is verplicht.",
    country: "Land",
    countryRequired: "Land is verplicht.",
    searchingLocations: "Locaties zoeken...",
    noLocationResults: "Geen resultaten voor deze zoekopdracht.",
    theme: "Thema",
    browseThemes: "Thema's bekijken",
    advancedOptions: "Geavanceerde opties",
    generatedButton: "Poster genereren",
    queueingButton: "Job in wachtrij...",
    autoThemeDefault: "Auto (thema-standaard)",
    autoThemeTextColor: "Auto (thema-tekstkleur)",
    pickCustomTextColor: "Kies aangepaste tekstkleur",
    explainGoogleFontFamily: "Uitleg Google Font Family",
    searchGoogleFontsAria: "Zoek Google Font-familie",
    coordsUnavailable: "Selecteer een locatie om coördinaten te tonen",
    locationSuggestionsCountLabel: "{count} locatiesuggesties beschikbaar.",
  },
  preview: {
    ...en.preview,
    title: "Live voorbeeld",
    description:
      "De preview is een benadering en kan licht afwijken van de uiteindelijke export.",
    disableRateLimitTitle: "Schakel alle API-rate limits uit",
    disableRateLimitDescription:
      "Alleen voor development. Schakelt alle API-throttling uit.",
    zoomValue: "Zoom {value}x",
    posterAlt: "Poster voorbeeld",
  },
  status: {
    ...en.status,
    title: "Generatiestatus",
    description: "Taken in de wachtrij worden elke twee seconden bijgewerkt.",
    idle: "Geen actieve generatiejob.",
    idleBadge: "inactief",
    queuedBadge: "wachtrij",
    generationComplete: "Generatie voltooid",
    generationFailed: "Generatie mislukt",
    preparingDownload: "Download voorbereiden...",
    download: "Downloaden",
  },
  themeExplorer: {
    ...en.themeExplorer,
    title: "Thema-overzicht",
    description:
      "Vergelijk alle ingebouwde stijlen en kies het uiterlijk dat bij jouw poster past.",
    loadingPreview: "Voorbeeld laden",
    selected: "Geselecteerd",
  },
  footer: {
    privacyPolicy: "Privacybeleid",
    cookiePolicy: "Cookiebeleid",
  },
  cookieBanner: {
    title: "Cookiemelding",
    description:
      "We gebruiken essentiële cookies om taalvoorkeur te onthouden en de site betrouwbaar te houden. Lees ons Cookiebeleid en Privacybeleid.",
    essentialOnly: "Alleen essentieel",
    acceptAll: "Accepteren",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Privacybeleid",
      description: "Hoe we je persoonsgegevens verwerken en beschermen.",
      updatedLabel: "Laatst bijgewerkt",
      intro:
        "Dit privacybeleid legt uit hoe City Map Poster Generator gegevens verwerkt wanneer je deze website gebruikt.",
    },
    cookies: {
      ...en.policies.cookies,
      title: "Cookiebeleid",
      description: "Welke cookies worden gebruikt en waarom.",
      updatedLabel: "Laatst bijgewerkt",
      intro:
        "Dit cookiebeleid legt uit welke cookies door City Map Poster Generator worden gebruikt.",
    },
  },
};

const fr: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle: "Créez de magnifiques affiches de cartes de villes en ligne",
    siteDescription:
      "Générez instantanément des affiches de cartes de villes en haute qualité avec thèmes intégrés, options typographiques et exports.",
    homepageTitle: "Générez des affiches de carte de ville personnalisées",
    homepageDescription:
      "Concevez et téléchargez des affiches de carte de ville en quelques minutes.",
    privacyTitle: "Politique de confidentialité",
    cookiesTitle: "Politique de cookies",
  },
  languageName: "Français",
  header: {
    badge: "Générateur public d'affiches",
    title: "Générez instantanément des affiches de cartes de villes",
    subtitle:
      "Créez des affiches haute résolution avec tous les thèmes maptoposter intégrés, des libellés multilingues et des options d'export sans connexion.",
  },
  controls: {
    ...en.controls,
    title: "Contrôles de carte",
    location: "Lieu",
    city: "Ville",
    cityRequired: "La ville est requise.",
    country: "Pays",
    countryRequired: "Le pays est requis.",
    searchingLocations: "Recherche de lieux...",
    noLocationResults: "Aucun résultat pour cette recherche.",
    theme: "Thème",
    browseThemes: "Parcourir les thèmes",
    advancedOptions: "Options avancées",
    generatedButton: "Générer l'affiche",
    queueingButton: "Mise en file...",
    autoThemeDefault: "Auto (thème par défaut)",
    autoThemeTextColor: "Auto (couleur de texte du thème)",
    pickCustomTextColor: "Choisir une couleur de texte",
    explainGoogleFontFamily: "Expliquer Google Font Family",
    searchGoogleFontsAria: "Rechercher une famille Google Font",
    coordsUnavailable: "Sélectionnez un lieu pour afficher les coordonnées",
    locationSuggestionsCountLabel:
      "{count} suggestion(s) de lieu disponible(s).",
  },
  preview: {
    ...en.preview,
    title: "Aperçu en direct",
    description:
      "L'aperçu est une approximation et peut différer légèrement de l'export final.",
    zoomValue: "Zoom {value}x",
    posterAlt: "Aperçu du poster",
  },
  status: {
    ...en.status,
    title: "Statut de génération",
    description:
      "Les tâches en file d'attente sont mises à jour automatiquement toutes les deux secondes.",
    idle: "Aucune génération active.",
    idleBadge: "inactif",
    queuedBadge: "en file",
    generationComplete: "Génération terminée",
    generationFailed: "Échec de la génération",
    preparingDownload: "Préparation du téléchargement...",
    download: "Télécharger",
  },
  footer: {
    privacyPolicy: "Politique de confidentialité",
    cookiePolicy: "Politique de cookies",
  },
  cookieBanner: {
    title: "Bannière cookies",
    description:
      "Nous utilisons des cookies essentiels pour mémoriser la langue et assurer le bon fonctionnement du site.",
    essentialOnly: "Essentiels uniquement",
    acceptAll: "Accepter",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Politique de confidentialité",
      description:
        "Comment nous traitons et protégeons vos données personnelles.",
      updatedLabel: "Dernière mise à jour",
      intro:
        "Cette politique explique comment City Map Poster Generator traite les informations lorsque vous utilisez ce site.",
    },
    cookies: {
      ...en.policies.cookies,
      title: "Politique de cookies",
      description: "Quels cookies sont utilisés et pourquoi.",
      updatedLabel: "Dernière mise à jour",
      intro:
        "Cette politique explique quels cookies sont utilisés par City Map Poster Generator.",
    },
  },
};

const de: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle: "Erstelle online wunderschöne Stadtkarten-Poster",
    siteDescription:
      "Erzeuge sofort hochwertige Stadtkarten-Poster mit integrierten Themes, Typografie-Steuerung und Exportformaten.",
    homepageTitle: "Individuelle Stadtkarten-Poster erstellen",
    homepageDescription:
      "Erstelle und lade in wenigen Minuten individuelle Stadtkarten-Poster herunter.",
    privacyTitle: "Datenschutzerklärung",
    cookiesTitle: "Cookie-Richtlinie",
  },
  languageName: "Deutsch",
  header: {
    badge: "Öffentlicher Poster-Generator",
    title: "Stadtkarten-Poster sofort erstellen",
    subtitle:
      "Erstelle hochauflösende Poster mit allen integrierten maptoposter-Themes, mehrsprachigen Labels und Exportoptionen ohne Anmeldung.",
  },
  controls: {
    ...en.controls,
    title: "Kartensteuerung",
    location: "Ort",
    city: "Stadt",
    cityRequired: "Stadt ist erforderlich.",
    country: "Land",
    countryRequired: "Land ist erforderlich.",
    searchingLocations: "Suche Orte...",
    noLocationResults: "Keine Ergebnisse für diese Suche.",
    theme: "Theme",
    browseThemes: "Themes durchsuchen",
    advancedOptions: "Erweiterte Optionen",
    generatedButton: "Poster generieren",
    queueingButton: "Job wird eingereiht...",
    autoThemeDefault: "Auto (Theme-Standard)",
    autoThemeTextColor: "Auto (Theme-Textfarbe)",
    pickCustomTextColor: "Eigene Textfarbe wählen",
    explainGoogleFontFamily: "Google Font Family erklären",
    searchGoogleFontsAria: "Google Font-Familie suchen",
    coordsUnavailable: "Wähle einen Ort, um Koordinaten anzuzeigen",
    locationSuggestionsCountLabel: "{count} Ortsvorschläge verfügbar.",
  },
  preview: {
    ...en.preview,
    title: "Live-Vorschau",
    description:
      "Die Vorschau ist eine Annäherung und kann leicht vom finalen Export abweichen.",
    zoomValue: "Zoom {value}x",
    posterAlt: "Poster-Vorschau",
  },
  status: {
    ...en.status,
    title: "Generierungsstatus",
    description:
      "Warteschlangen-Jobs werden alle zwei Sekunden automatisch aktualisiert.",
    idle: "Kein aktiver Generierungsjob.",
    idleBadge: "inaktiv",
    queuedBadge: "wartend",
    generationComplete: "Generierung abgeschlossen",
    generationFailed: "Generierung fehlgeschlagen",
    preparingDownload: "Download wird vorbereitet...",
    download: "Herunterladen",
  },
  footer: {
    privacyPolicy: "Datenschutzerklärung",
    cookiePolicy: "Cookie-Richtlinie",
  },
  cookieBanner: {
    title: "Cookie-Hinweis",
    description:
      "Wir verwenden notwendige Cookies, um Spracheinstellungen zu speichern und die Seite zuverlässig zu betreiben.",
    essentialOnly: "Nur notwendige",
    acceptAll: "Akzeptieren",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Datenschutzerklärung",
      description: "Wie wir personenbezogene Daten verarbeiten und schützen.",
      updatedLabel: "Zuletzt aktualisiert",
      intro:
        "Diese Datenschutzerklärung erläutert, wie City Map Poster Generator Informationen verarbeitet.",
    },
    cookies: {
      ...en.policies.cookies,
      title: "Cookie-Richtlinie",
      description: "Welche Cookies verwendet werden und warum.",
      updatedLabel: "Zuletzt aktualisiert",
      intro:
        "Diese Cookie-Richtlinie erklärt, welche Cookies von City Map Poster Generator verwendet werden.",
    },
  },
};

const es: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle: "Crea pósters de mapas urbanos online",
    siteDescription:
      "Genera al instante pósters de mapas urbanos de alta calidad con temas integrados, controles tipográficos y formatos de exportación.",
    homepageTitle: "Genera pósters personalizados de mapas de ciudad",
    homepageDescription:
      "Diseña y descarga pósters de mapas urbanos en minutos.",
    privacyTitle: "Política de privacidad",
    cookiesTitle: "Política de cookies",
  },
  languageName: "Español",
  header: {
    badge: "Generador público de pósters",
    title: "Genera pósters de mapas urbanos al instante",
    subtitle:
      "Crea pósters en alta resolución con todos los temas integrados de maptoposter, etiquetas multilingües y opciones de exportación sin iniciar sesión.",
  },
  controls: {
    ...en.controls,
    title: "Controles del mapa",
    location: "Ubicación",
    city: "Ciudad",
    cityRequired: "La ciudad es obligatoria.",
    country: "País",
    countryRequired: "El país es obligatorio.",
    searchingLocations: "Buscando ubicaciones...",
    noLocationResults: "No se encontraron resultados.",
    theme: "Tema",
    browseThemes: "Explorar temas",
    advancedOptions: "Opciones avanzadas",
    generatedButton: "Generar póster",
    queueingButton: "Encolando tarea...",
    autoThemeDefault: "Auto (tema predeterminado)",
    autoThemeTextColor: "Auto (color de texto del tema)",
    pickCustomTextColor: "Elegir color de texto",
    explainGoogleFontFamily: "Explicar Google Font Family",
    searchGoogleFontsAria: "Buscar familia de Google Font",
    coordsUnavailable: "Selecciona una ubicación para mostrar coordenadas",
    locationSuggestionsCountLabel:
      "{count} sugerencias de ubicación disponibles.",
  },
  preview: {
    ...en.preview,
    title: "Vista previa en vivo",
    description:
      "La vista previa es una aproximación y puede variar ligeramente respecto al resultado final.",
    zoomValue: "Zoom {value}x",
    posterAlt: "Vista previa del póster",
  },
  status: {
    ...en.status,
    title: "Estado de generación",
    description:
      "Las tareas en cola se actualizan automáticamente cada dos segundos.",
    idle: "No hay ninguna generación activa.",
    idleBadge: "inactivo",
    queuedBadge: "en cola",
    generationComplete: "Generación completada",
    generationFailed: "Generación fallida",
    preparingDownload: "Preparando descarga...",
    download: "Descargar",
  },
  footer: {
    privacyPolicy: "Política de privacidad",
    cookiePolicy: "Política de cookies",
  },
  cookieBanner: {
    title: "Aviso de cookies",
    description:
      "Usamos cookies esenciales para recordar el idioma y mantener el sitio estable. Consulta nuestra Política de Cookies y Privacidad.",
    essentialOnly: "Solo esenciales",
    acceptAll: "Aceptar",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Política de privacidad",
      description: "Cómo tratamos y protegemos tus datos personales.",
      updatedLabel: "Última actualización",
      intro:
        "Esta política explica cómo City Map Poster Generator procesa información cuando usas este sitio web.",
    },
    cookies: {
      ...en.policies.cookies,
      title: "Política de cookies",
      description: "Qué cookies se usan y por qué.",
      updatedLabel: "Última actualización",
      intro: "Esta política explica qué cookies usa City Map Poster Generator.",
    },
  },
};

const dictionaries: Record<Locale, Dictionary> = {
  en,
  nl,
  fr,
  de,
  es,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
