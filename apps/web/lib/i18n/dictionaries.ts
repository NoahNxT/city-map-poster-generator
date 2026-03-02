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
    sizeUnit: string;
    centimeters: string;
    inches: string;
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
  accessibility: {
    skipToMainContent: string;
    closeDialog: string;
    previewKeyboardHint: string;
  };
  policies: {
    privacy: PolicyPage;
    cookies: PolicyPage;
  };
};

const en: Dictionary = {
  seo: {
    siteName: "City Map Poster Generator",
    siteTitle: "Free City Map Poster Generator | Create Custom Map Art Online",
    siteDescription:
      "Create free high-resolution city map posters online. Choose from 17 built-in themes, customize typography, and export as PNG, SVG, or PDF.",
    keywords: [
      "city map poster generator",
      "custom map poster",
      "map art maker",
      "city poster",
      "map print design",
      "maptoposter",
      "street map wall art",
      "personalized city map",
      "printable city map poster",
    ],
    ogTitle: "Create a Custom City Map Poster in Minutes",
    ogDescription:
      "Design map posters with premium themes, typography controls, and instant PNG/SVG/PDF export.",
    homepageTitle: "Create Your Personalized City Map Poster",
    homepageDescription:
      "Generate and download polished city map posters in minutes with powerful controls and built-in styles.",
    privacyTitle: "Privacy Policy",
    privacyDescription:
      "Learn how City Map Poster Generator processes and protects personal data.",
    cookiesTitle: "Cookie Policy",
    cookiesDescription:
      "Learn which cookies City Map Poster Generator uses and why.",
  },
  languageName: "English",
  languageLabel: "Language",
  header: {
    badge: "Public Poster Generator",
    title: "Create city map posters instantly",
    subtitle:
      "Design and download high-resolution city map posters with all built-in maptoposter themes, multilingual labels, and flexible exports, without signing in.",
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
    sizeUnit: "Units",
    centimeters: "Centimeters (cm)",
    inches: "Inches (in)",
    width: "Width",
    height: "Height",
    mapLayersTitle: "Map Layers (Export)",
    mapLayersDescription: "Applies to both live preview and final generation.",
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
    googleFonts: "Google-lettertypen",
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
      "Preview uses the same renderer pipeline as the final exported poster.",
    disableRateLimitTitle: "Disable all API rate limits",
    disableRateLimitDescription:
      "Development only. Disables all API throttling.",
    zoomTitle: "Zoom box",
    zoomDescription: "Inspect smaller text in the preview.",
    zoomLevel: "Zoom level",
    zoomLevelValue: "{value}x",
    zoomValue: "Vergroting {value}x",
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
  accessibility: {
    skipToMainContent: "Skip to main content",
    closeDialog: "Close dialog",
    previewKeyboardHint:
      "Use arrow keys to move the zoom lens. Hold Shift for larger movement.",
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
    siteTitle: "Gratis stadskaart poster generator | Maak online kaartkunst",
    siteDescription:
      "Maak gratis gepersonaliseerde stadskaartposters in hoge resolutie. Kies uit 17 thema's, pas typografie aan en download in PNG, SVG of PDF.",
    keywords: [
      "stadskaart poster",
      "kaart poster maken",
      "gepersonaliseerde stadskaart",
      "map art generator",
      "stadskaart print",
      "kaartkunst",
      "maptoposter",
    ],
    ogTitle: "Maak direct je eigen stadskaartposter",
    ogDescription:
      "Ontwerp een unieke stadskaart met professionele thema's en exporteer direct in PNG, SVG of PDF.",
    homepageTitle: "Maak een gepersonaliseerde stadskaartposter",
    homepageDescription:
      "Genereer en download binnen minuten een stijlvolle stadskaartposter met geavanceerde instellingen.",
    privacyTitle: "Privacybeleid",
    privacyDescription:
      "Lees hoe City Map Poster Generator persoonsgegevens verwerkt en beschermt.",
    cookiesTitle: "Cookiebeleid",
    cookiesDescription:
      "Lees welke cookies City Map Poster Generator gebruikt en waarom.",
  },
  languageName: "Nederlands",
  languageLabel: "Taal",
  header: {
    badge: "Openbare Poster Generator",
    title: "Maak direct stadskaartposters",
    subtitle:
      "Ontwerp en download kaartposters in hoge resolutie met alle ingebouwde maptoposter-thema's, meertalige labels en flexibele exportopties zonder account.",
  },
  controls: {
    ...en.controls,
    title: "Kaartinstellingen",
    description:
      "Hier vind je alle maptoposter-opties, inclusief geavanceerde instellingen.",
    location: "Locatie",
    locationPlaceholder: "Zoek op stad, wijk, bezienswaardigheid...",
    locationHelp:
      "Kies een suggestie om stad/land en exacte coördinaten automatisch in te vullen.",
    city: "Stad",
    cityPlaceholder: "Antwerpen",
    cityRequired: "Stad is verplicht.",
    country: "Land",
    countryPlaceholder: "België",
    countryRequired: "Land is verplicht.",
    searchingLocations: "Locaties zoeken...",
    noLocationResults: "Geen resultaten voor deze zoekopdracht.",
    distance: "Afstand",
    theme: "Thema",
    browseThemes: "Thema's bekijken",
    format: "Bestandsformaat",
    generateAllThemesTitle: "Alle thema's genereren",
    generateAllThemesDescription:
      "Genereert alle 17 thema's en bundelt ze als ZIP-download.",
    advancedOptions: "Geavanceerde opties",
    latitude: "Breedtegraad",
    longitude: "Lengtegraad",
    width: "Breedte",
    height: "Hoogte",
    mapLayersTitle: "Kaartlagen (export)",
    mapLayersDescription:
      "Van toepassing op zowel de live preview als de uiteindelijke generatie.",
    includeWater: "Water tonen",
    includeWaterDescription: "Rivieren, meren, kanalen.",
    includeParks: "Parken/groen tonen",
    includeParksDescription: "Parken en groenzones.",
    typographyTitle: "Typografie-aanpassingen",
    typographyDescription:
      "Optionele aangepaste grootte voor stad/land en tekstkleur voor preview en export.",
    cityFontSize: "Lettergrootte stad (pt)",
    countryFontSize: "Lettergrootte land (pt)",
    generatedButton: "Poster genereren",
    queueingButton: "Job in wachtrij...",
    autoThemeDefault: "Auto (thema-standaard)",
    labelPaddingScale: "Schaal labelafstand",
    labelPaddingHelp:
      "Vergroot de afstand tussen stad, scheidingslijn, land en coördinaten bij grotere typografie.",
    blurTitle: "Vervaagde tekstachtergrond",
    blurDescription:
      "Voegt een zacht vervaagd paneel achter het tekstblok toe.",
    blurSize: "Vervaag-grootte",
    blurStrength: "Vervaag-sterkte",
    textColor: "Tekstkleur overschrijven",
    autoThemeTextColor: "Auto (thema-tekstkleur)",
    textColorHelp:
      "Ondersteunt hex-kleuren zoals #8C4A18 of #abc. Laat leeg om de themakleur te gebruiken.",
    pickCustomTextColor: "Kies aangepaste tekstkleur",
    reset: "Resetten",
    googleFontFamily: "Google Font-familie",
    googleFontHelpTitle: "Typografiefamilie",
    googleFontHelpDescription:
      "Downloadt en past een Google Font-familie toe op stads-, land- en coördinatenlabels in de uiteindelijke render.",
    explainGoogleFontFamily: "Uitleg Google Font Family",
    selectGoogleFont: "Selecteer Google Font...",
    searchGoogleFonts: "Zoek in Google Fonts...",
    searchGoogleFontsAria: "Zoek Google Font-familie",
    searchGoogleFontsHelp:
      "Zoek en selecteer alleen uit Google Fonts-resultaten.",
    searchingFonts: "Lettertypen zoeken...",
    fontSearchUnavailable:
      "Zoeken naar lettertypen is niet beschikbaar. Fallback-suggesties worden getoond.",
    noFallbackFonts: "Geen fallback-lettertypen voor deze zoekopdracht.",
    noFontsFound: "Geen overeenkomstige lettertypen gevonden.",
    selection: "Selectie",
    themeDefaultFont: "Standaard lettertype van thema",
    fallbackFonts: "Fallback-lettertypen",
    googleFonts: "Polices Google",
    captchaMissing:
      "CAPTCHA site key is niet geconfigureerd. Stel NEXT_PUBLIC_TURNSTILE_SITE_KEY in.",
    coordsUnavailable: "Selecteer een locatie om coördinaten te tonen",
    locationSuggestionsCountLabel: "{count} locatiesuggesties beschikbaar.",
  },
  preview: {
    ...en.preview,
    title: "Live voorbeeld",
    description:
      "De preview gebruikt dezelfde renderer als de uiteindelijke export.",
    disableRateLimitTitle: "Alle API-rate limits uitschakelen",
    disableRateLimitDescription:
      "Alleen voor development. Schakelt alle API-throttling uit.",
    zoomTitle: "Zoombox",
    zoomDescription: "Bekijk kleine tekst in de preview.",
    zoomLevel: "Zoomniveau",
    zoomLevelValue: "{value}x",
    zoomValue: "Agrandissement {value}x",
    posterAlt: "Poster voorbeeld",
    textOverlayTitle: "Voorbeeldoverlay van postertekst",
    magnifiedTitle: "Vergroot postervoorbeeld",
    magnifiedOverlayTitle: "Vergrote typografie-overlay",
  },
  status: {
    ...en.status,
    title: "Generatiestatus",
    description: "Taken in de wachtrij worden elke twee seconden bijgewerkt.",
    idle: "Geen actieve generatiejob.",
    idleBadge: "inactief",
    queuedBadge: "wachtrij",
    jobLabel: "Taak",
    generationComplete: "Generatie voltooid",
    generationFailed: "Generatie mislukt",
    preparingDownload: "Download voorbereiden...",
    download: "Downloaden",
  },
  themeExplorer: {
    ...en.themeExplorer,
    title: "Themagalerij",
    description:
      "Vergelijk alle ingebouwde stijlen en kies het uiterlijk dat bij jouw poster past.",
    loadingPreview: "Voorbeeld laden...",
    previewUnavailable: "Voorbeeld niet beschikbaar",
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
    acceptAll: "Alles accepteren",
  },
  accessibility: {
    skipToMainContent: "Ga naar hoofdinhoud",
    closeDialog: "Dialoog sluiten",
    previewKeyboardHint:
      "Gebruik de pijltjestoetsen om de zoomlens te verplaatsen. Houd Shift ingedrukt voor grotere stappen.",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Privacybeleid",
      description: "Hoe we je persoonsgegevens verwerken en beschermen.",
      updatedLabel: "Laatst bijgewerkt",
      updatedAt: "2 maart 2026",
      intro:
        "Dit privacybeleid legt uit hoe City Map Poster Generator informatie verwerkt wanneer je deze website gebruikt.",
      sections: [
        {
          heading: "1. Welke gegevens we verwerken",
          paragraphs: [
            "We verwerken technische verzoekgegevens zoals IP-adres, user agent en tijdstempels om de dienst te laten werken, te beveiligen en misbruik te beperken.",
            "Wanneer je posters genereert, verwerken we de locatie- en posterinstellingen die je invult om de bestanden te maken.",
          ],
        },
        {
          heading: "2. Waarom we gegevens verwerken",
          paragraphs: [
            "Om de kernfunctionaliteit te leveren, misbruik te voorkomen, de beschikbaarheid te bewaken en operationele problemen te onderzoeken.",
          ],
        },
        {
          heading: "3. Opslag en bewaartermijn",
          paragraphs: [
            "Gegenereerde bestanden en previews worden tijdelijk opgeslagen en verlopen automatisch.",
            "Operationele logs kunnen gedurende een beperkte periode worden bewaard voor beveiliging en betrouwbaarheid.",
          ],
        },
        {
          heading: "4. Diensten van derden",
          paragraphs: [
            "De applicatie kan externe diensten gebruiken (bijvoorbeeld geocoding, kaartdata, CAPTCHA en lettertypediensten) om output te genereren.",
          ],
        },
        {
          heading: "5. Jouw rechten",
          paragraphs: [
            "Als de AVG op jou van toepassing is, kun je onder de toepasselijke wetgeving rechten hebben op inzage, correctie, verwijdering, beperking, bezwaar en overdraagbaarheid.",
          ],
        },
      ],
    },
    cookies: {
      ...en.policies.cookies,
      title: "Cookiebeleid",
      description: "Welke cookies worden gebruikt en waarom.",
      updatedLabel: "Laatst bijgewerkt",
      updatedAt: "2 maart 2026",
      intro:
        "Dit cookiebeleid legt uit welke cookies City Map Poster Generator gebruikt.",
      sections: [
        {
          heading: "1. Essentiële cookies",
          paragraphs: [
            "site_locale: onthoudt je taalvoorkeur.",
            "site_cookie_consent: onthoudt je cookiekeuze.",
          ],
        },
        {
          heading: "2. Waarom cookies worden gebruikt",
          paragraphs: [
            "Cookies worden gebruikt om taalvoorkeuren te bewaren en je toestemmingskeuze op te slaan.",
          ],
        },
        {
          heading: "3. Cookies beheren",
          paragraphs: [
            "Je kunt cookies verwijderen via je browserinstellingen. Dan worden taal- en toestemmingsvoorkeuren mogelijk gereset.",
          ],
        },
      ],
    },
  },
};

const fr: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle:
      "Générateur gratuit d'affiches de cartes de ville | Créez votre map art",
    siteDescription:
      "Créez gratuitement des affiches de cartes de ville en haute résolution. Choisissez parmi 17 thèmes, ajustez la typographie et exportez en PNG, SVG ou PDF.",
    keywords: [
      "affiche carte ville",
      "poster carte personnalisé",
      "carte de ville à imprimer",
      "générateur map art",
      "créateur affiche carte",
      "carte murale design",
      "maptoposter",
    ],
    ogTitle: "Créez votre affiche de carte de ville en quelques minutes",
    ogDescription:
      "Concevez une carte de ville unique avec des thèmes premium et exportez instantanément en PNG, SVG ou PDF.",
    homepageTitle: "Créez une affiche de carte de ville personnalisée",
    homepageDescription:
      "Générez et téléchargez rapidement une affiche de carte de ville élégante avec des réglages avancés.",
    privacyTitle: "Politique de confidentialité",
    privacyDescription:
      "Découvrez comment City Map Poster Generator traite et protège vos données personnelles.",
    cookiesTitle: "Politique de cookies",
    cookiesDescription:
      "Découvrez quels cookies City Map Poster Generator utilise et dans quel but.",
  },
  languageName: "Français",
  languageLabel: "Langue",
  header: {
    badge: "Générateur public",
    title: "Générez instantanément des affiches de cartes de villes",
    subtitle:
      "Concevez et téléchargez des affiches cartographiques haute résolution avec tous les thèmes maptoposter, des libellés multilingues et des exports flexibles, sans compte.",
  },
  controls: {
    ...en.controls,
    title: "Contrôles de carte",
    description:
      "Toutes les options maptoposter sont disponibles ici, y compris les réglages avancés.",
    location: "Lieu",
    locationPlaceholder: "Rechercher une ville, un quartier, un lieu...",
    locationHelp:
      "Sélectionnez une suggestion pour renseigner automatiquement ville/pays et coordonnées exactes.",
    city: "Ville",
    cityPlaceholder: "Anvers",
    cityRequired: "La ville est requise.",
    country: "Pays",
    countryPlaceholder: "Belgique",
    countryRequired: "Le pays est requis.",
    searchingLocations: "Recherche de lieux...",
    noLocationResults: "Aucun résultat pour cette recherche.",
    distance: "Distance",
    theme: "Thème",
    browseThemes: "Parcourir les thèmes",
    format: "Format de fichier",
    generateAllThemesTitle: "Générer tous les thèmes",
    generateAllThemesDescription:
      "Génère les 17 thèmes et crée un téléchargement ZIP.",
    advancedOptions: "Options avancées",
    latitude: "Latitude",
    longitude: "Longitude",
    width: "Largeur",
    height: "Hauteur",
    mapLayersTitle: "Couches de carte (export)",
    mapLayersDescription:
      "S'applique à la fois à l'aperçu en direct et à la génération finale.",
    includeWater: "Inclure l'eau",
    includeWaterDescription: "Rivières, lacs, canaux.",
    includeParks: "Inclure parcs/espaces verts",
    includeParksDescription: "Parcs et zones herbeuses.",
    typographyTitle: "Ajustements typographiques",
    typographyDescription:
      "Tailles ville/pays et couleur de texte personnalisées pour l'aperçu et l'export.",
    cityFontSize: "Taille police ville (pt)",
    countryFontSize: "Taille police pays (pt)",
    generatedButton: "Générer l'affiche",
    queueingButton: "Mise en file...",
    autoThemeDefault: "Auto (thème par défaut)",
    labelPaddingScale: "Échelle des espacements de libellés",
    labelPaddingHelp:
      "Augmente l'espacement entre la ville, le séparateur, le pays et les coordonnées lorsque la typographie est plus grande.",
    blurTitle: "Flou d'arrière-plan du texte",
    blurDescription: "Ajoute un panneau flou doux derrière le bloc de texte.",
    blurSize: "Taille du flou",
    blurStrength: "Intensité du flou",
    textColor: "Remplacement de la couleur du texte",
    autoThemeTextColor: "Auto (couleur de texte du thème)",
    textColorHelp:
      "Prend en charge les couleurs hexadécimales comme #8C4A18 ou #abc. Laissez vide pour utiliser la couleur du thème.",
    pickCustomTextColor: "Choisir une couleur de texte",
    reset: "Réinitialiser",
    googleFontFamily: "Famille Google Font",
    googleFontHelpTitle: "Famille typographique",
    googleFontHelpDescription:
      "Télécharge et applique une famille Google Font aux libellés ville, pays et coordonnées dans le rendu final.",
    explainGoogleFontFamily: "Expliquer Google Font Family",
    selectGoogleFont: "Sélectionner une Google Font...",
    searchGoogleFonts: "Rechercher dans Google Fonts...",
    searchGoogleFontsAria: "Rechercher une famille Google Font",
    searchGoogleFontsHelp:
      "Recherchez et sélectionnez uniquement parmi les résultats Google Fonts.",
    searchingFonts: "Recherche des polices...",
    fontSearchUnavailable:
      "Recherche de polices indisponible. Suggestions de secours affichées.",
    noFallbackFonts:
      "Aucune police de secours ne correspond à cette recherche.",
    noFontsFound: "Aucune police correspondante trouvée.",
    selection: "Sélection",
    themeDefaultFont: "Police par défaut du thème",
    fallbackFonts: "Polices de secours",
    googleFonts: "Google Fonts",
    captchaMissing:
      "La clé de site CAPTCHA n'est pas configurée. Définissez NEXT_PUBLIC_TURNSTILE_SITE_KEY.",
    coordsUnavailable: "Sélectionnez un lieu pour afficher les coordonnées",
    locationSuggestionsCountLabel:
      "{count} suggestion(s) de lieu disponible(s).",
  },
  preview: {
    ...en.preview,
    title: "Aperçu en direct",
    description: "L'aperçu utilise le même moteur de rendu que l'export final.",
    disableRateLimitTitle: "Désactiver toutes les limites API",
    disableRateLimitDescription:
      "Développement uniquement. Désactive toute limitation API.",
    zoomTitle: "Zone de zoom",
    zoomDescription: "Inspectez les petits textes dans l'aperçu.",
    zoomLevel: "Niveau de zoom",
    zoomLevelValue: "{value}x",
    zoomValue: "Vergrößerung {value}x",
    posterAlt: "Aperçu du poster",
    textOverlayTitle: "Superposition texte de l'aperçu du poster",
    magnifiedTitle: "Aperçu du poster agrandi",
    magnifiedOverlayTitle: "Superposition typographique agrandie",
  },
  status: {
    ...en.status,
    title: "Statut de génération",
    description:
      "Les tâches en file d'attente sont mises à jour automatiquement toutes les deux secondes.",
    idle: "Aucune génération active.",
    idleBadge: "inactif",
    queuedBadge: "en file",
    jobLabel: "Tâche",
    generationComplete: "Génération terminée",
    generationFailed: "Échec de la génération",
    preparingDownload: "Préparation du téléchargement...",
    download: "Télécharger",
  },
  themeExplorer: {
    ...en.themeExplorer,
    title: "Galerie des thèmes",
    description:
      "Comparez tous les styles intégrés et choisissez le rendu adapté à votre affiche.",
    loadingPreview: "Chargement de l'aperçu...",
    previewUnavailable: "Aperçu indisponible",
    selected: "Sélectionné",
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
  accessibility: {
    skipToMainContent: "Aller au contenu principal",
    closeDialog: "Fermer la fenêtre",
    previewKeyboardHint:
      "Utilisez les flèches pour déplacer la zone de zoom. Maintenez Shift pour des déplacements plus grands.",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Politique de confidentialité",
      description:
        "Comment nous traitons et protégeons vos données personnelles.",
      updatedLabel: "Dernière mise à jour",
      updatedAt: "2 mars 2026",
      intro:
        "Cette politique explique comment City Map Poster Generator traite les informations lorsque vous utilisez ce site web.",
      sections: [
        {
          heading: "1. Données que nous traitons",
          paragraphs: [
            "Nous traitons des données techniques de requête telles que l'adresse IP, l'agent utilisateur et les horodatages afin d'exploiter, sécuriser et limiter les abus du service.",
            "Lorsque vous générez des affiches, nous traitons les champs de localisation et de configuration que vous soumettez pour créer les fichiers.",
          ],
        },
        {
          heading: "2. Pourquoi nous traitons ces données",
          paragraphs: [
            "Pour fournir les fonctionnalités principales, prévenir les abus, surveiller l'état du service et diagnostiquer les incidents opérationnels.",
          ],
        },
        {
          heading: "3. Stockage et durée de conservation",
          paragraphs: [
            "Les fichiers générés et les aperçus sont stockés temporairement puis supprimés automatiquement.",
            "Les journaux opérationnels peuvent être conservés pendant une période limitée pour des raisons de sécurité et de fiabilité.",
          ],
        },
        {
          heading: "4. Services tiers",
          paragraphs: [
            "L'application peut utiliser des services externes (par exemple géocodage, données cartographiques, CAPTCHA et services de polices) pour produire les résultats.",
          ],
        },
        {
          heading: "5. Vos droits",
          paragraphs: [
            "Si le RGPD s'applique, vous pouvez disposer de droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité selon la loi applicable.",
          ],
        },
      ],
    },
    cookies: {
      ...en.policies.cookies,
      title: "Politique de cookies",
      description: "Quels cookies sont utilisés et pourquoi.",
      updatedLabel: "Dernière mise à jour",
      updatedAt: "2 mars 2026",
      intro:
        "Cette politique explique quels cookies City Map Poster Generator utilise.",
      sections: [
        {
          heading: "1. Cookies essentiels",
          paragraphs: [
            "site_locale : mémorise votre préférence de langue.",
            "site_cookie_consent : mémorise votre choix concernant la bannière cookies.",
          ],
        },
        {
          heading: "2. Pourquoi les cookies sont utilisés",
          paragraphs: [
            "Les cookies sont utilisés pour conserver la langue choisie et enregistrer votre préférence de consentement.",
          ],
        },
        {
          heading: "3. Gérer les cookies",
          paragraphs: [
            "Vous pouvez supprimer les cookies dans les paramètres de votre navigateur. Dans ce cas, les préférences de langue et de consentement peuvent être réinitialisées.",
          ],
        },
      ],
    },
  },
};

const de: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle:
      "Kostenloser Stadtplan-Poster-Generator | Individuelle Map-Art online",
    siteDescription:
      "Erstelle kostenlos hochauflösende Stadtplan-Poster. Wähle aus 17 Designs, passe Typografie an und exportiere als PNG, SVG oder PDF.",
    keywords: [
      "stadtplan poster",
      "kartenposter erstellen",
      "individuelles stadtposter",
      "map art generator",
      "stadtkarte druck",
      "wandkarte design",
      "maptoposter",
    ],
    ogTitle: "Erstelle in Minuten dein eigenes Stadtplan-Poster",
    ogDescription:
      "Gestalte eine individuelle Stadtkarte mit professionellen Themes und exportiere direkt als PNG, SVG oder PDF.",
    homepageTitle: "Personalisiertes Stadtplan-Poster erstellen",
    homepageDescription:
      "Generiere und lade in wenigen Minuten ein stilvolles Stadtplan-Poster mit erweiterten Einstellungen herunter.",
    privacyTitle: "Datenschutzerklärung",
    privacyDescription:
      "Erfahre, wie City Map Poster Generator personenbezogene Daten verarbeitet und schützt.",
    cookiesTitle: "Cookie-Richtlinie",
    cookiesDescription:
      "Erfahre, welche Cookies City Map Poster Generator verwendet und warum.",
  },
  languageName: "Deutsch",
  languageLabel: "Sprache",
  header: {
    badge: "Öffentlicher Generator",
    title: "Stadtkarten-Poster sofort erstellen",
    subtitle:
      "Entwirf und lade hochauflösende Kartenposter mit allen integrierten maptoposter-Themes, mehrsprachigen Beschriftungen und flexiblen Exporten herunter, ganz ohne Konto.",
  },
  controls: {
    ...en.controls,
    title: "Kartensteuerung",
    description:
      "Hier stehen alle maptoposter-Optionen inklusive erweiterter Felder zur Verfügung.",
    location: "Ort",
    locationPlaceholder: "Stadt, Viertel, Sehenswürdigkeit suchen...",
    locationHelp:
      "Wähle einen Vorschlag, um Stadt/Land und exakte Koordinaten automatisch zu übernehmen.",
    city: "Stadt",
    cityPlaceholder: "Antwerpen",
    cityRequired: "Stadt ist erforderlich.",
    country: "Land",
    countryPlaceholder: "Belgien",
    countryRequired: "Land ist erforderlich.",
    searchingLocations: "Suche Orte...",
    noLocationResults: "Keine Ergebnisse für diese Suche.",
    distance: "Radius",
    theme: "Thema",
    browseThemes: "Themes durchsuchen",
    format: "Dateiformat",
    generateAllThemesTitle: "Alle Themes generieren",
    generateAllThemesDescription:
      "Erstellt alle 17 Themes und bündelt sie als ZIP-Download.",
    advancedOptions: "Erweiterte Optionen",
    latitude: "Breitengrad",
    longitude: "Längengrad",
    width: "Breite",
    height: "Höhe",
    mapLayersTitle: "Kartenebenen (Export)",
    mapLayersDescription:
      "Gilt sowohl für die Live-Vorschau als auch für die finale Generierung.",
    includeWater: "Wasser einbeziehen",
    includeWaterDescription: "Flüsse, Seen, Kanäle.",
    includeParks: "Parks/Grünflächen einbeziehen",
    includeParksDescription: "Parks und Grünflächen.",
    typographyTitle: "Typografie-Anpassungen",
    typographyDescription:
      "Optionale Größenanpassungen für Stadt/Land und Textfarbe für Vorschau und Export.",
    cityFontSize: "Schriftgröße Stadt (pt)",
    countryFontSize: "Schriftgröße Land (pt)",
    generatedButton: "Poster generieren",
    queueingButton: "Job wird eingereiht...",
    autoThemeDefault: "Auto (Theme-Standard)",
    labelPaddingScale: "Skalierung des Label-Abstands",
    labelPaddingHelp:
      "Erhöht den Abstand zwischen Stadt, Trennlinie, Land und Koordinaten bei größerer Typografie.",
    blurTitle: "Text-Hintergrundunschärfe",
    blurDescription:
      "Fügt hinter dem Textblock eine weiche Unschärfe-Fläche hinzu.",
    blurSize: "Unschärfegröße",
    blurStrength: "Unschärfestärke",
    textColor: "Textfarbe überschreiben",
    autoThemeTextColor: "Auto (Theme-Textfarbe)",
    textColorHelp:
      "Unterstützt Hex-Farben wie #8C4A18 oder #abc. Leer lassen, um die Theme-Textfarbe zu verwenden.",
    pickCustomTextColor: "Eigene Textfarbe wählen",
    reset: "Zurücksetzen",
    googleFontFamily: "Google Font-Familie",
    googleFontHelpTitle: "Typografie-Familie",
    googleFontHelpDescription:
      "Lädt und verwendet eine Google Font-Familie für Stadt-, Land- und Koordinaten-Labels im finalen Rendering.",
    explainGoogleFontFamily: "Google Font Family erklären",
    selectGoogleFont: "Google Font auswählen...",
    searchGoogleFonts: "Google Fonts durchsuchen...",
    searchGoogleFontsAria: "Google Font-Familie suchen",
    searchGoogleFontsHelp:
      "Suche und wähle nur aus den Ergebnissen von Google Fonts.",
    searchingFonts: "Schriftarten werden gesucht...",
    fontSearchUnavailable:
      "Schriftartensuche nicht verfügbar. Es werden Fallback-Vorschläge angezeigt.",
    noFallbackFonts:
      "Keine passenden Fallback-Schriftarten für diese Suchanfrage.",
    noFontsFound: "Keine passenden Schriftarten gefunden.",
    selection: "Auswahl",
    themeDefaultFont: "Theme-Standardschrift",
    fallbackFonts: "Fallback-Schriftarten",
    googleFonts: "Google-Schriftarten",
    captchaMissing:
      "CAPTCHA Site Key ist nicht konfiguriert. Setze NEXT_PUBLIC_TURNSTILE_SITE_KEY.",
    coordsUnavailable: "Wähle einen Ort, um Koordinaten anzuzeigen",
    locationSuggestionsCountLabel: "{count} Ortsvorschläge verfügbar.",
  },
  preview: {
    ...en.preview,
    title: "Live-Vorschau",
    description:
      "Die Vorschau nutzt dieselbe Render-Pipeline wie der finale Export.",
    disableRateLimitTitle: "Alle API-Rate-Limits deaktivieren",
    disableRateLimitDescription:
      "Nur für Development. Deaktiviert sämtliche API-Drosselungen.",
    zoomTitle: "Zoomfenster",
    zoomDescription: "Prüfe kleinere Texte in der Vorschau.",
    zoomLevel: "Zoomstufe",
    zoomLevelValue: "{value}x",
    zoomValue: "Ampliación {value}x",
    posterAlt: "Poster-Vorschau",
    textOverlayTitle: "Text-Overlay der Postervorschau",
    magnifiedTitle: "Vergrößerte Postervorschau",
    magnifiedOverlayTitle: "Vergrößertes Typografie-Overlay",
  },
  status: {
    ...en.status,
    title: "Generierungsstatus",
    description:
      "Warteschlangen-Jobs werden alle zwei Sekunden automatisch aktualisiert.",
    idle: "Kein aktiver Generierungsjob.",
    idleBadge: "inaktiv",
    queuedBadge: "wartend",
    jobLabel: "Auftrag",
    generationComplete: "Generierung abgeschlossen",
    generationFailed: "Generierung fehlgeschlagen",
    preparingDownload: "Download wird vorbereitet...",
    download: "Herunterladen",
  },
  themeExplorer: {
    ...en.themeExplorer,
    title: "Theme-Galerie",
    description:
      "Vergleiche alle integrierten Stile und wähle das Design, das am besten zu deinem Ergebnis passt.",
    loadingPreview: "Vorschau wird geladen...",
    previewUnavailable: "Vorschau nicht verfügbar",
    selected: "Ausgewählt",
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
  accessibility: {
    skipToMainContent: "Zum Hauptinhalt springen",
    closeDialog: "Dialog schließen",
    previewKeyboardHint:
      "Verwende die Pfeiltasten, um die Zoom-Linse zu bewegen. Halte Shift für größere Schritte gedrückt.",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Datenschutzerklärung",
      description: "Wie wir personenbezogene Daten verarbeiten und schützen.",
      updatedLabel: "Zuletzt aktualisiert",
      updatedAt: "2. März 2026",
      intro:
        "Diese Datenschutzerklärung erklärt, wie City Map Poster Generator Informationen verarbeitet, wenn du diese Website nutzt.",
      sections: [
        {
          heading: "1. Welche Daten wir verarbeiten",
          paragraphs: [
            "Wir verarbeiten technische Anfragedaten wie IP-Adresse, User-Agent und Zeitstempel, um den Dienst zu betreiben, zu schützen und zu begrenzen.",
            "Wenn du Poster generierst, verarbeiten wir die von dir übermittelten Standort- und Poster-Einstellungen, um Dateien zu erstellen.",
          ],
        },
        {
          heading: "2. Warum wir Daten verarbeiten",
          paragraphs: [
            "Um Kernfunktionen bereitzustellen, Missbrauch zu verhindern, den Dienstzustand zu überwachen und betriebliche Probleme zu analysieren.",
          ],
        },
        {
          heading: "3. Speicherung und Aufbewahrung",
          paragraphs: [
            "Generierte Dateien und Vorschauen werden temporär gespeichert und automatisch gelöscht.",
            "Betriebsprotokolle können aus Sicherheits- und Zuverlässigkeitsgründen für einen begrenzten Zeitraum aufbewahrt werden.",
          ],
        },
        {
          heading: "4. Drittanbieterdienste",
          paragraphs: [
            "Die Anwendung kann externe Dienste (z. B. Geocoding, Kartendaten, CAPTCHA und Font-Dienste) verwenden, um Ergebnisse zu erzeugen.",
          ],
        },
        {
          heading: "5. Deine Rechte",
          paragraphs: [
            "Wenn die DSGVO für dich gilt, hast du möglicherweise Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit gemäß geltendem Recht.",
          ],
        },
      ],
    },
    cookies: {
      ...en.policies.cookies,
      title: "Cookie-Richtlinie",
      description: "Welche Cookies verwendet werden und warum.",
      updatedLabel: "Zuletzt aktualisiert",
      updatedAt: "2. März 2026",
      intro:
        "Diese Cookie-Richtlinie erklärt, welche Cookies City Map Poster Generator verwendet.",
      sections: [
        {
          heading: "1. Essenzielle Cookies",
          paragraphs: [
            "site_locale: speichert deine Spracheinstellung.",
            "site_cookie_consent: speichert deine Cookie-Entscheidung.",
          ],
        },
        {
          heading: "2. Warum Cookies verwendet werden",
          paragraphs: [
            "Cookies werden verwendet, um Spracheinstellungen zu speichern und deine Einwilligungspräferenz zu merken.",
          ],
        },
        {
          heading: "3. Cookies verwalten",
          paragraphs: [
            "Du kannst Cookies in den Browsereinstellungen löschen. Dadurch können Sprache und Einwilligungspräferenzen zurückgesetzt werden.",
          ],
        },
      ],
    },
  },
};

const es: Dictionary = {
  ...en,
  seo: {
    ...en.seo,
    siteTitle:
      "Generador gratis de pósters de mapas de ciudad | Crea map art online",
    siteDescription:
      "Crea gratis pósters de mapas de ciudad en alta resolución. Elige entre 17 temas, ajusta tipografías y exporta en PNG, SVG o PDF.",
    keywords: [
      "poster mapa ciudad",
      "mapa personalizado",
      "generador map art",
      "crear poster de mapa",
      "mapa urbano para imprimir",
      "arte cartográfico",
      "maptoposter",
    ],
    ogTitle: "Crea tu póster de mapa de ciudad en minutos",
    ogDescription:
      "Diseña un mapa urbano único con temas profesionales y exporta al instante en PNG, SVG o PDF.",
    homepageTitle: "Crea un póster personalizado de mapa de ciudad",
    homepageDescription:
      "Genera y descarga en minutos un póster de mapa urbano con controles avanzados.",
    privacyTitle: "Política de privacidad",
    privacyDescription:
      "Conoce cómo City Map Poster Generator procesa y protege los datos personales.",
    cookiesTitle: "Política de cookies",
    cookiesDescription:
      "Conoce qué cookies utiliza City Map Poster Generator y con qué finalidad.",
  },
  languageName: "Español",
  languageLabel: "Idioma",
  header: {
    badge: "Generador público de pósters",
    title: "Genera pósters de mapas urbanos al instante",
    subtitle:
      "Diseña y descarga pósters cartográficos de alta resolución con todos los temas integrados de maptoposter, etiquetas multilingües y exportaciones flexibles, sin registro.",
  },
  controls: {
    ...en.controls,
    title: "Controles del mapa",
    description:
      "Aquí tienes todas las opciones de maptoposter, incluidos los ajustes avanzados.",
    location: "Ubicación",
    locationPlaceholder: "Buscar ciudad, barrio, punto de interés...",
    locationHelp:
      "Selecciona una sugerencia para completar automáticamente ciudad/país y coordenadas precisas.",
    city: "Ciudad",
    cityPlaceholder: "Amberes",
    cityRequired: "La ciudad es obligatoria.",
    country: "País",
    countryPlaceholder: "Bélgica",
    countryRequired: "El país es obligatorio.",
    searchingLocations: "Buscando ubicaciones...",
    noLocationResults: "No se encontraron resultados.",
    distance: "Distancia",
    theme: "Tema",
    browseThemes: "Explorar temas",
    format: "Formato de archivo",
    generateAllThemesTitle: "Generar todos los temas",
    generateAllThemesDescription:
      "Genera los 17 temas y crea una descarga en ZIP.",
    advancedOptions: "Opciones avanzadas",
    latitude: "Latitud",
    longitude: "Longitud",
    width: "Ancho",
    height: "Alto",
    mapLayersTitle: "Capas del mapa (exportación)",
    mapLayersDescription:
      "Se aplica solo a la generación final. La vista previa mantiene ajustes rápidos del servidor.",
    includeWater: "Incluir agua",
    includeWaterDescription: "Ríos, lagos, canales.",
    includeParks: "Incluir parques/zonas verdes",
    includeParksDescription: "Parques y áreas verdes.",
    typographyTitle: "Ajustes de tipografía",
    typographyDescription:
      "Tamaño personalizado de ciudad/país y color de texto para vista previa y exportaciones.",
    cityFontSize: "Tamaño de fuente ciudad (pt)",
    countryFontSize: "Tamaño de fuente país (pt)",
    generatedButton: "Generar póster",
    queueingButton: "Encolando tarea...",
    autoThemeDefault: "Auto (tema predeterminado)",
    labelPaddingScale: "Escala de espaciado de etiquetas",
    labelPaddingHelp:
      "Aumenta el espacio entre ciudad, divisor, país y coordenadas cuando la tipografía es más grande.",
    blurTitle: "Desenfoque de fondo del texto",
    blurDescription:
      "Añade un panel suavemente desenfocado detrás del bloque de texto.",
    blurSize: "Tamaño del desenfoque",
    blurStrength: "Intensidad del desenfoque",
    textColor: "Color de texto personalizado",
    autoThemeTextColor: "Auto (color de texto del tema)",
    textColorHelp:
      "Admite colores hex como #8C4A18 o #abc. Déjalo vacío para usar el color del tema.",
    pickCustomTextColor: "Elegir color de texto",
    reset: "Restablecer",
    googleFontFamily: "Familia de Google Font",
    googleFontHelpTitle: "Familia tipográfica",
    googleFontHelpDescription:
      "Descarga y aplica una familia de Google Font a las etiquetas de ciudad, país y coordenadas en el render final.",
    explainGoogleFontFamily: "Explicar Google Font Family",
    selectGoogleFont: "Seleccionar Google Font...",
    searchGoogleFonts: "Buscar en Google Fonts...",
    searchGoogleFontsAria: "Buscar familia de Google Font",
    searchGoogleFontsHelp:
      "Busca y selecciona solo entre resultados de Google Fonts.",
    searchingFonts: "Buscando fuentes...",
    fontSearchUnavailable:
      "La búsqueda de fuentes no está disponible. Mostrando sugerencias de respaldo.",
    noFallbackFonts: "Ninguna fuente de respaldo coincide con esta búsqueda.",
    noFontsFound: "No se encontraron fuentes coincidentes.",
    selection: "Selección",
    themeDefaultFont: "Fuente predeterminada del tema",
    fallbackFonts: "Fuentes de respaldo",
    googleFonts: "Fuentes de Google",
    captchaMissing:
      "La clave del sitio CAPTCHA no está configurada. Define NEXT_PUBLIC_TURNSTILE_SITE_KEY.",
    coordsUnavailable: "Selecciona una ubicación para mostrar coordenadas",
    locationSuggestionsCountLabel:
      "{count} sugerencias de ubicación disponibles.",
  },
  preview: {
    ...en.preview,
    title: "Vista previa en vivo",
    description:
      "La vista previa usa el mismo renderizador que la exportación final.",
    disableRateLimitTitle: "Desactivar todos los límites de API",
    disableRateLimitDescription:
      "Solo para desarrollo. Desactiva toda limitación de API.",
    zoomTitle: "Caja de zoom",
    zoomDescription: "Inspecciona textos pequeños en la vista previa.",
    zoomLevel: "Nivel de zoom",
    zoomLevelValue: "{value}x",
    zoomValue: "Zoom {value}x",
    posterAlt: "Vista previa del póster",
    textOverlayTitle: "Superposición de texto de vista previa",
    magnifiedTitle: "Vista previa ampliada del póster",
    magnifiedOverlayTitle: "Superposición tipográfica ampliada",
  },
  status: {
    ...en.status,
    title: "Estado de generación",
    description:
      "Las tareas en cola se actualizan automáticamente cada dos segundos.",
    idle: "No hay ninguna generación activa.",
    idleBadge: "inactivo",
    queuedBadge: "en cola",
    jobLabel: "Tarea",
    generationComplete: "Generación completada",
    generationFailed: "Generación fallida",
    preparingDownload: "Preparando descarga...",
    download: "Descargar",
  },
  themeExplorer: {
    ...en.themeExplorer,
    title: "Galería de temas",
    description:
      "Compara todos los estilos integrados y elige el diseño que mejor encaje con tu resultado.",
    loadingPreview: "Cargando vista previa...",
    previewUnavailable: "Vista previa no disponible",
    selected: "Seleccionado",
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
  accessibility: {
    skipToMainContent: "Saltar al contenido principal",
    closeDialog: "Cerrar diálogo",
    previewKeyboardHint:
      "Usa las flechas para mover la lente de zoom. Mantén Shift para movimientos más amplios.",
  },
  policies: {
    privacy: {
      ...en.policies.privacy,
      title: "Política de privacidad",
      description: "Cómo tratamos y protegemos tus datos personales.",
      updatedLabel: "Última actualización",
      updatedAt: "2 de marzo de 2026",
      intro:
        "Esta Política de privacidad explica cómo City Map Poster Generator procesa información cuando utilizas este sitio web.",
      sections: [
        {
          heading: "1. Datos que procesamos",
          paragraphs: [
            "Procesamos datos técnicos de solicitud como dirección IP, agente de usuario y marcas de tiempo para operar, proteger y limitar abusos del servicio.",
            "Cuando generas pósters, procesamos los campos de ubicación y configuración que envías para crear los archivos.",
          ],
        },
        {
          heading: "2. Por qué procesamos datos",
          paragraphs: [
            "Para ofrecer funcionalidades principales, prevenir abusos, supervisar la salud del servicio y diagnosticar incidencias operativas.",
          ],
        },
        {
          heading: "3. Almacenamiento y retención",
          paragraphs: [
            "Los archivos generados y las vistas previas se almacenan temporalmente y caducan automáticamente.",
            "Los registros operativos pueden conservarse durante un periodo limitado por motivos de seguridad y fiabilidad.",
          ],
        },
        {
          heading: "4. Servicios de terceros",
          paragraphs: [
            "La aplicación puede usar servicios externos (por ejemplo geocodificación, datos de mapas, CAPTCHA y servicios de fuentes) para generar resultados.",
          ],
        },
        {
          heading: "5. Tus derechos",
          paragraphs: [
            "Si aplica el RGPD, puedes tener derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad según la legislación aplicable.",
          ],
        },
      ],
    },
    cookies: {
      ...en.policies.cookies,
      title: "Política de cookies",
      description: "Qué cookies se usan y por qué.",
      updatedLabel: "Última actualización",
      updatedAt: "2 de marzo de 2026",
      intro:
        "Esta Política de cookies explica qué cookies usa City Map Poster Generator.",
      sections: [
        {
          heading: "1. Cookies esenciales",
          paragraphs: [
            "site_locale: recuerda tu preferencia de idioma.",
            "site_cookie_consent: recuerda tu elección en el banner de cookies.",
          ],
        },
        {
          heading: "2. Por qué se usan cookies",
          paragraphs: [
            "Las cookies se usan para mantener tu preferencia de idioma y almacenar tu elección de consentimiento.",
          ],
        },
        {
          heading: "3. Gestión de cookies",
          paragraphs: [
            "Puedes borrar cookies desde la configuración de tu navegador. Si lo haces, las preferencias de idioma y consentimiento pueden restablecerse.",
          ],
        },
      ],
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
