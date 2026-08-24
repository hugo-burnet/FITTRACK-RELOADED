import {
  annotated,
  claim,
  needsAdjudication,
  zeroClaim
} from "./spec-helpers.mjs";

const clinicalClaim = (rawStatement, options = {}) =>
  claim(rawStatement, { domain: "clinical", ...options });

const expertPractice = (rawStatement, options = {}) =>
  clinicalClaim(rawStatement, {
    knowledgeType: "EXPERT_PRACTICE",
    epistemicStatus: "practice_only",
    assessment: { directness: "expert_only" },
    flags: ["clinical_content", "expert_practice"],
    ...options
  });

export default [
  annotated("frag.f3.0001", [
    clinicalClaim(
      "**« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**",
      {
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation", "clinical_content"],
        cannotConclude: ["La douleur pendant l’exercice est sans danger."]
      }
    ),
    clinicalClaim(
      "Des exercices tolérablement douloureux peuvent produire des résultats comparables",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        flags: ["clinical_content"],
        unresolvedAxes: {
          directness: "outcomes_compared_not_explicit_in_span",
          evidenceTypes: "document_type_not_explicit_in_fragment"
        }
      }
    ),
    clinicalClaim(
      "voire un petit avantage antalgique à court terme dans certaines douleurs chroniques, sans supériorité durable démontrée",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: { directness: "direct_clinical" },
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        flags: ["clinical_content"],
        cannotConclude: ["Une supériorité durable est démontrée."],
        limitations: ["dans certaines douleurs chroniques", "à court terme"]
      }
    ),
    expertPractice(
      "ce n’est ni une obligation d’avoir mal ni une permission d’ignorer une aggravation",
      {
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation", "clinical_content", "expert_practice"],
        cannotConclude: [
          "Il est obligatoire d’avoir mal.",
          "Une aggravation peut être ignorée."
        ]
      }
    )
  ]),

  annotated("frag.f3.0002", [
    clinicalClaim(
      "Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base le lendemain",
      {
        knowledgeType: "DEFINITION",
        epistemicStatus: "established",
        citations: ["cand.e5-citation.1c793d3b304a122b"],
        flags: ["clinical_content", "numeric_threshold"],
        cannotConclude: ["5/10 est un seuil universel de sécurité."],
        limitations: ["utilisé dans certains essais tendineux"]
      }
    ),
    clinicalClaim(
      "il s’agit d’un protocole de recherche, non d’une règle pour toute douleur ou toute pathologie",
      {
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        citations: ["cand.e5-citation.1c793d3b304a122b"],
        flags: ["clinical_content", "numeric_threshold"],
        cannotConclude: ["Ce protocole s’applique à toute douleur ou toute pathologie."]
      }
    )
  ]),

  annotated("frag.f3.0007", [
    clinicalClaim("un red flag n’est pas un diagnostic", {
      knowledgeType: "DEFINITION",
      epistemicStatus: "established",
      flags: ["clinical_content", "red_flag_content"],
      cannotConclude: ["Un red flag permet de poser un diagnostic."]
    }),
    clinicalClaim("Les signaux isolés ont souvent une faible précision", {
      knowledgeType: "EVIDENCE",
      epistemicStatus: "probable",
      citations: ["cand.e5-citation.3983536a53df6cdb"],
      flags: ["clinical_content", "red_flag_content"]
    }),
    clinicalClaim(
      "la combinaison, le contexte et l’évolution déterminent le niveau de suspicion",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        citations: ["cand.e5-citation.3983536a53df6cdb"],
        flags: ["clinical_content", "red_flag_content"]
      }
    )
  ], {
    annotationNotes:
      "La phrase imposant ce que l’IA doit dire relève de la politique de sortie et n’est pas une claim scientifique."
  }),

  annotated("frag.e5f3.00012613", [
    expertPractice(
      "Le principe commun est la **gestion de la charge suivie d’une exposition progressive**, et non le repos complet.",
      { cannotConclude: ["Le repos est toujours nocif."] }
    ),
    clinicalClaim(
      "Pour le tendon d’Achille de portion moyenne, l’APTA recommande une charge tendineuse aussi élevée que tolérée au moins trois fois par semaine et déconseille le repos complet",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: {
          directness: "direct_clinical",
          evidenceTypes: ["clinical_practice_guideline"]
        },
        citations: ["cand.e5-citation.0a09e6efb74343fb"],
        flags: ["clinical_content", "numeric_threshold"],
        cannotConclude: [
          "Trois séances par semaine constituent un seuil universel pour tous les tendons."
        ]
      }
    ),
    clinicalClaim(
      "Aucun mode unique — excentrique, heavy slow resistance (HSR), concentrique ou isométrique — n’est universellement supérieur",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        citations: [
          "cand.e5-citation.cc503ab0bba6f4c3",
          "cand.e5-citation.dd480d6d3ce15a6d"
        ],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation", "clinical_content"],
        cannotConclude: ["Les modalités sont équivalentes pour tous les outcomes."]
      }
    ),
    clinicalClaim(
      "les isométriques n’offrent pas une analgésie immédiate fiable chez tous",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: { directness: "direct_clinical" },
        citations: [
          "cand.e5-citation.cc503ab0bba6f4c3",
          "cand.e5-citation.dd480d6d3ce15a6d"
        ],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation", "clinical_content"],
        cannotConclude: ["Les isométriques ne procurent jamais d’analgésie."]
      }
    )
  ]),

  annotated("frag.e5f3.00014985", [
    clinicalClaim(
      "La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de dommage.",
      {
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        flags: ["biomechanical_risk_language", "clinical_content"],
        cannotConclude: [
          "Une valeur de compression, de cisaillement ou de moment externe démontre à elle seule un dommage."
        ]
      }
    ),
    clinicalClaim(
      "Une revue ne trouve pas de preuve in vivo crédible que davantage de flexion lombaire pendant le soulèvement soit un facteur de risque de lombalgie",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "absence_of_evidence",
        citations: ["cand.e5-citation.97d5e335856e2df6"],
        flags: ["clinical_content", "explicit_absence"],
        limitations: [
          "les charges étudiées étaient toutefois souvent légères",
          "les données surtout transversales"
        ],
        cannotConclude: ["La flexion lombaire ne présente aucun risque."]
      }
    )
  ], {
    annotationNotes:
      "La phrase listant des facteurs qui « comptent » ne précise ni direction ni relation évaluable."
  }),

  annotated("frag.e5f3.00025760", [
    expertPractice(
      "Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge",
      {
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"]
        },
        citations: ["cand.e5-citation.1b8b3f44f6dd20d6"],
        cannotConclude: ["Une orthèse remplace la progression de charge."]
      }
    ),
    expertPractice(
      "un consensus de physiothérapeutes a retenu éducation, pacing, exercice progressif et orthèse",
      {
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"]
        },
        citations: ["cand.e5-citation.1b8b3f44f6dd20d6"]
      }
    ),
    expertPractice(
      "avec douleur définie par l’acceptabilité du patient plutôt que par un chiffre universel",
      {
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"]
        },
        citations: ["cand.e5-citation.1b8b3f44f6dd20d6"],
        flags: ["clinical_content", "expert_practice", "numeric_threshold"],
        cannotConclude: ["Un chiffre universel définit l’acceptabilité de la douleur."]
      }
    )
  ], {
    annotationNotes:
      "L’instruction adressée à l’IA est une politique de sortie et n’est pas extraite."
  }),

  zeroClaim(
    "frag.e5f3.00000076",
    "Métadonnée de version et de date de revue, sans prédicat clinique extractible."
  ),

  annotated("frag.f3.0003", [
    clinicalClaim("**L’imagerie ne dicte pas seule la programmation.**", {
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      flags: ["clinical_content"],
      cannotConclude: ["L’imagerie est sans pertinence clinique."]
    }),
    clinicalClaim(
      "Bombements, protrusions et autres signes dégénératifs sont fréquents chez les personnes asymptomatiques et augmentent avec l’âge",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: { directness: "imaging_descriptive" },
        citations: ["cand.e5-citation.bb0b9f62a20d045d"],
        flags: ["clinical_content"]
      }
    ),
    expertPractice(
      "ils doivent être corrélés aux symptômes et à l’examen clinique",
      {
        citations: ["cand.e5-citation.bb0b9f62a20d045d"],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation", "clinical_content", "expert_practice"]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f3.00003967",
    "Élément isolé d’une liste d’informations à demander, sans relation clinique évaluable."
  ),

  annotated("frag.e5f3.00010897", [
    expertPractice(
      "Le seuil doit être abaissé quand l’irritabilité est élevée : douleur au repos, réaction avec faible charge, amplitude très sensible, aggravation durable ou perte de fonction.",
      { flags: ["clinical_content", "expert_practice", "numeric_threshold"] }
    ),
    expertPractice(
      "Le consensus de Berne propose une progression selon irritabilité et réponse symptomatique",
      {
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"]
        },
        citations: ["cand.e5-citation.596245dcbd28f2f3"]
      }
    )
  ]),

  annotated("frag.e5f3.00013618", [
    expertPractice("ajouter vitesse, stockage-restitution d’énergie, sauts ou lancers selon l’objectif")
  ]),

  annotated("frag.e5f3.00014346", [
    clinicalClaim(
      "Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exercice aérobie et exercice général",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: { directness: "direct_clinical" },
        citations: ["cand.e5-citation.db13b05020d9cd68"],
        flags: ["clinical_content"]
      }
    ),
    clinicalClaim("aucune méthode n’est nécessaire pour tous", {
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      citations: ["cand.e5-citation.db13b05020d9cd68"],
      flags: ["clinical_content"],
      cannotConclude: ["Une méthode est nécessaire pour toute personne lombalgique chronique."]
    }),
    clinicalClaim(
      "L’OMS préconise une prise en charge non chirurgicale personnalisée et intégrée de la lombalgie chronique primaire",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: {
          directness: "direct_clinical",
          evidenceTypes: ["medical_body_recommendation"]
        },
        citations: ["cand.e5-citation.9306bf2f305a3ed6"],
        flags: ["clinical_content"]
      }
    ),
    clinicalClaim(
      "L’imagerie n’est habituellement pas appropriée pour une lombalgie non compliquée sans red flags",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: { directness: "direct_clinical" },
        citations: ["cand.e5-citation.5d8a519fce6f7204"],
        flags: ["clinical_content", "red_flag_content"]
      }
    )
  ]),

  annotated("frag.e5f3.00023412", [
    clinicalClaim(
      "Le terme historique « impingement » ne prouve pas qu’un tissu est mécaniquement “écrasé” par toute élévation.",
      {
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        flags: ["biomechanical_risk_language", "clinical_content"],
        cannotConclude: ["Toute élévation écrase mécaniquement un tissu."]
      }
    ),
    expertPractice(
      "Pour les élévations latérales, presses et rotations, la réponse clinique prime sur un angle prétendument parfait."
    )
  ], {
    annotationNotes:
      "La phrase prescrivant le vocabulaire de l’IA est une politique de sortie, non une claim clinique."
  }),

  annotated("frag.e5f3.00029304", [
    clinicalClaim("ce n’est pas « mauvais pour les genoux »", {
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      flags: ["clinical_content"],
      cannotConclude: ["La leg extension est universellement sans risque."]
    }),
    clinicalClaim(
      "Avec une résistance fixée à la jambe, la demande peut augmenter près de l’extension",
      {
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        flags: ["biomechanical_risk_language", "clinical_content"],
        cannotConclude: ["Cette demande démontre une lésion clinique."]
      }
    ),
    clinicalClaim("certaines machines à came modifient ce profil", {
      knowledgeType: "BIOMECHANICAL_OBSERVATION",
      epistemicStatus: "uncertain",
      assessment: {
        directness: "biomechanical_only",
        supportsDemonstratedClinicalRisk: false
      },
      flags: ["biomechanical_risk_language", "clinical_content"]
    }),
    expertPractice("Ajuster amplitude et charge selon symptômes."),
    clinicalClaim("Les deux chaînes sont recommandées pour la PFP", {
      knowledgeType: "EVIDENCE",
      epistemicStatus: "established_direction",
      assessment: {
        directness: "direct_clinical",
        evidenceTypes: ["clinical_practice_guideline"]
      },
      citations: ["cand.e5-citation.6dba11447ad738d6"],
      flags: ["clinical_content"]
    }),
    clinicalClaim("les profils biomécaniques ne prouvent pas une lésion clinique", {
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      citations: ["cand.e5-citation.2528e8e8fb4afc48"],
      flags: ["biomechanical_risk_language", "clinical_content"],
      cannotConclude: ["Un profil biomécanique démontre une lésion clinique."]
    })
  ]),

  annotated("frag.e5f3.00030639", [
    expertPractice(
      "**Après interruption sans douleur :** reprendre sous le volume et l’intensité antérieurs"
    ),
    clinicalClaim(
      "Aucun pourcentage universel de reprise n’est soutenu pour toutes populations",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "absence_of_evidence",
        flags: ["clinical_content", "explicit_absence", "numeric_threshold"],
        cannotConclude: ["Une règle de reprise chiffrée est universelle."]
      }
    )
  ], {
    annotationNotes:
      "L’étiquetage obligatoire des règles « 50 % » et « +10 % » relève de la gouvernance produit."
  }),

  zeroClaim(
    "frag.e5f3.00035268",
    "Exemple de formulation interdite relevant exclusivement de la politique de sortie."
  ),

  zeroClaim(
    "frag.e5f3.00035555",
    "Transition d’implémentation sans affirmation clinique autonome."
  ),

  zeroClaim(
    "frag.e5f3.00040275",
    "Définition interne d’un niveau de preuve, relevant de la modélisation du produit."
  ),

  annotated("frag.e5f3.00045746", [
    clinicalClaim("Une tolérance de groupe ne garantit pas une tolérance individuelle.", {
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      flags: ["clinical_content"],
      cannotConclude: ["Une tolérance observée dans un groupe garantit la tolérance individuelle."]
    })
  ]),

  zeroClaim(
    "frag.e5f3.00047064",
    "Justification d’une structure de données et du comportement attendu de l’IA, sans claim clinique."
  ),

  zeroClaim(
    "frag.f3.0023",
    "Déclaration de finalité et politique de sécurité du produit, non vérité médicale ou scientifique."
  ),

  annotated("frag.e5f3.00002764", [
    expertPractice(
      "Syndrome de la queue de cheval, déficit neurologique progressif, fracture, infection ou malignité suspectées exigent une évaluation médicale appropriée",
      {
        citations: [
          "cand.e5-citation.2ff9226e8f58bd0d",
          "cand.e5-citation.c8bdbcc7615aa0aa"
        ],
        citationAttributionState: "UNRESOLVED",
        flags: [
          "ambiguous_citation",
          "clinical_content",
          "expert_practice",
          "red_flag_content"
        ],
        cannotConclude: ["Ces signaux posent à eux seuls un diagnostic."]
      }
    ),
    clinicalClaim(
      "les signes isolés sont imparfaits et doivent être interprétés en combinaison et dans leur contexte",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        citations: [
          "cand.e5-citation.2ff9226e8f58bd0d",
          "cand.e5-citation.c8bdbcc7615aa0aa"
        ],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation", "clinical_content", "red_flag_content"]
      }
    )
  ], {
    annotationNotes:
      "La priorité absolue du signal rouge sur le coaching est une politique produit et n’est pas une claim scientifique."
  }),

  zeroClaim(
    "frag.e5f3.00006083",
    "Élément nominal isolé d’une hiérarchie de modification, sans prédicat évaluable."
  ),

  zeroClaim(
    "frag.e5f3.00011779",
    "Branche abrégée d’un algorithme produit reliant un état runtime à une action."
  ),

  annotated("frag.e5f3.00013767", [
    clinicalClaim(
      "Les facteurs psychologiques ont des associations faibles à modérées avec douleur/fonction",
      {
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        citations: ["cand.e5-citation.74b46fb6b798e5ad"],
        flags: ["clinical_content"]
      }
    ),
    clinicalClaim("mais leur pouvoir pronostique individuel reste incertain", {
      knowledgeType: "EVIDENCE",
      epistemicStatus: "uncertain",
      citations: ["cand.e5-citation.74b46fb6b798e5ad"],
      flags: ["clinical_content"],
      cannotConclude: ["Ces facteurs prédisent de façon certaine l’évolution individuelle."]
    })
  ], {
    annotationNotes:
      "La liste initiale d’« erreurs courantes » est normative et ne fournit pas des résultats scientifiques atomiques."
  }),

  annotated("frag.e5f3.00020521", [
    expertPractice(
      "passer temporairement du squat barre au belt squat, split squat ou presse peut réduire une exposition irritante, sans supposer que la compression est la cause",
      {
        flags: [
          "biomechanical_risk_language",
          "clinical_content",
          "expert_practice"
        ],
        cannotConclude: ["La compression est la cause des symptômes."]
      }
    )
  ]),

  annotated("frag.e5f3.00029088", [
    clinicalClaim(
      "une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées",
      {
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        flags: ["biomechanical_risk_language", "clinical_content"],
        cannotConclude: ["Cette demande démontre un dommage fémoro-patellaire."]
      }
    ),
    expertPractice(
      "utiliser une box, une profondeur partielle ou une assistance peut doser cette demande"
    )
  ]),

  annotated("frag.e5f3.00030376", [
    expertPractice("reconstruire les mouvements spécifiques")
  ]),

  zeroClaim(
    "frag.e5f3.00035453",
    "Exemple de formulation diagnostique interdite relevant de la politique de sortie."
  ),

  zeroClaim(
    "frag.e5f3.00040415",
    "Instruction de classification interne de la KB, sans pratique clinique spécifique."
  ),

  zeroClaim(
    "frag.e5f3.00046416",
    "Exigence d’audit des sorties de l’IA, relevant de la gouvernance produit."
  ),

  zeroClaim(
    "frag.e5f3.00046765",
    "Liste de champs du schéma de données, sans prédicat clinique."
  ),

  annotated("frag.e5f3.00000530", [
    expertPractice("**Adapter une exposition, pas interdire une anatomie.**", {
      cannotConclude: ["Une anatomie justifie à elle seule une interdiction."]
    }),
    expertPractice(
      "La décision doit partir de la réponse individuelle à une tâche — localisation et comportement des symptômes, irritabilité, amplitude, charge, volume, vitesse, lendemain de séance — plutôt que du seul nom d’une lésion.",
      { cannotConclude: ["Le seul nom d’une lésion suffit à dicter l’adaptation."] }
    )
  ]),

  zeroClaim(
    "frag.e5f3.00006012",
    "Élément nominal isolé d’une hiérarchie de modification, sans prédicat évaluable."
  ),

  zeroClaim(
    "frag.e5f3.00011856",
    "Branche abrégée d’un algorithme produit reliant un état runtime à une action."
  ),

  annotated("frag.e5f3.00013710", [
    expertPractice("surveiller la charge totale sportive et quotidienne")
  ]),

  annotated("frag.e5f3.00020101", [
    expertPractice(
      "**Hip thrust :** option pour entraîner les extenseurs de hanche avec moins de demande de maintien debout"
    ),
    expertPractice("ajuster l’extension terminale si sensible")
  ]),

  annotated("frag.e5f3.00028841", [
    clinicalClaim("ce n’est pas une interdiction générale", {
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      flags: ["clinical_content"],
      cannotConclude: ["Le genou au-delà des orteils est interdit de façon générale."]
    }),
    clinicalClaim(
      "Restreindre l’avancée du genou déplace une partie de la demande vers hanche/tronc",
      {
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        flags: ["biomechanical_risk_language", "clinical_content"]
      }
    ),
    expertPractice(
      "l’adéquation dépend de la mobilité, du but, de la charge et des symptômes"
    )
  ]),

  annotated("frag.e5f3.00030421", [
    expertPractice(
      "réintroduire efforts proches de l’échec, vitesse, sauts, changements de direction ou gestes overhead en dernier lorsque pertinents"
    )
  ]),

  zeroClaim(
    "frag.e5f3.00035234",
    "Exemple de formulation interdite relevant exclusivement de la politique de sortie."
  ),

  zeroClaim(
    "frag.e5f3.00040114",
    "Définition interne d’un niveau de preuve, relevant de la modélisation du produit."
  ),

  zeroClaim(
    "frag.e5f3.00046247",
    "Règle de maintenance et de traçabilité de la base, sans claim clinique."
  ),

  zeroClaim(
    "frag.e5f3.00046893",
    "Liste de champs du schéma de données, sans prédicat clinique."
  ),

  needsAdjudication(
    "frag.e5f3.00000822",
    [
      clinicalClaim(
        "Les recommandations soutiennent l’exercice pour la lombalgie chronique, la tendinopathie de la coiffe, l’épicondylalgie latérale, la douleur fémoro-patellaire, la tendinopathie d’Achille et l’arthrose du genou",
        {
          knowledgeType: "EVIDENCE",
          epistemicStatus: "established_direction",
          assessment: { directness: "direct_clinical" },
          citations: [
            "cand.e5-citation.74576bec668a04f0",
            "cand.e5-citation.de3fd03b4fcca391",
            "cand.e5-citation.05975ca374952a2f",
            "cand.e5-citation.76e6da4d2004c295",
            "cand.e5-citation.215ce6bb5cbc42f3",
            "cand.e5-citation.7f8f850f3bdf4a2c"
          ],
          citationAttributionState: "UNRESOLVED",
          flags: ["ambiguous_citation", "clinical_content"],
          ambiguities: [
            "La phrase coordonne six populations séparément évaluables, mais le span ne répète le prédicat qu’une fois.",
            "Les six citations terminales semblent ordonnées comme les six populations, sans mapping explicite dans le fragment."
          ]
        }
      )
    ],
    [
      "Découpage atomique impossible sans produire pour cinq populations un rawStatement dépourvu de prédicat.",
      "Attribution individuelle des six citations non explicite."
    ]
  ),

  zeroClaim(
    "frag.e5f3.00003688",
    "Élément d’une liste d’informations à demander et garde-fou de politique produit, sans claim autonome correctement formée."
  ),

  zeroClaim(
    "frag.e5f3.00012091",
    "Branche abrégée d’un algorithme produit reliant des observations runtime à une zone et une action."
  ),

  annotated("frag.e5f3.00013464", [
    expertPractice("introduire une contraction tolérée, isométrique ou isotone")
  ]),

  annotated("frag.e5f3.00019956", [
    expertPractice("**Leg press :** utile si le torse soutenu est mieux toléré"),
    expertPractice(
      "limiter la profondeur si la flexion hanche/lombaire en fin d’amplitude irrite"
    )
  ]),

  annotated("frag.e5f3.00030276", [
    expertPractice(
      "augmenter d’abord une seule variable — répétitions, séries, charge, amplitude ou vitesse"
    )
  ]),

  zeroClaim(
    "frag.e5f3.00035183",
    "Exemple de diagnostic implicite interdit relevant de la politique de sortie."
  )
];
