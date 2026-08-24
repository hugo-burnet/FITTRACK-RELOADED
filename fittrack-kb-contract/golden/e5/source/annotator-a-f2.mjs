import {
  annotated,
  claim,
  needsAdjudication,
  zeroClaim
} from "./spec-helpers.mjs";

const anatomy = (rawStatement, options = {}) =>
  claim(rawStatement, {
    domain: "anatomy",
    knowledgeType: "ANATOMICAL_FACT",
    ...options
  });

const biomechanics = (rawStatement, options = {}) =>
  claim(rawStatement, {
    domain: "biomechanics",
    knowledgeType: "BIOMECHANICAL_OBSERVATION",
    assessment: {
      directness: "biomechanical_only",
      supportsDemonstratedClinicalRisk: false,
      ...options.assessment
    },
    ...options,
    assessment: {
      directness: "biomechanical_only",
      supportsDemonstratedClinicalRisk: false,
      ...options.assessment
    }
  });

const evidence = (rawStatement, options = {}) =>
  claim(rawStatement, {
    domain: "exercise",
    knowledgeType: "EVIDENCE",
    ...options
  });

const emg = (rawStatement, options = {}) =>
  claim(rawStatement, {
    domain: "exercise",
    knowledgeType: "EMG_OBSERVATION",
    assessment: {
      directness: "emg_only",
      supportsHypertrophySuperiority: false,
      ...options.assessment
    },
    ...options,
    assessment: {
      directness: "emg_only",
      supportsHypertrophySuperiority: false,
      ...options.assessment
    },
    flags: [...(options.flags ?? []), "emg_content"]
  });

const practice = (rawStatement, options = {}) =>
  claim(rawStatement, {
    domain: "exercise",
    knowledgeType: "EXPERT_PRACTICE",
    epistemicStatus: "practice_only",
    assessment: {
      directness: "expert_only",
      ...options.assessment
    },
    ...options,
    assessment: {
      directness: "expert_only",
      ...options.assessment
    },
    flags: [...(options.flags ?? []), "expert_practice"]
  });

const hypothesis = (rawStatement, options = {}) =>
  claim(rawStatement, {
    domain: "biomechanics",
    knowledgeType: "HYPOTHESIS",
    epistemicStatus: "mechanistic_only",
    assessment: {
      directness: "mechanistic_hypothesis",
      supportsDemonstratedClinicalRisk: false,
      ...options.assessment
    },
    ...options,
    assessment: {
      directness: "mechanistic_hypothesis",
      supportsDemonstratedClinicalRisk: false,
      ...options.assessment
    }
  });

export default [
  needsAdjudication(
    "frag.f2.0001",
    [
      claim(
        "une différence d'amplitude EMG entre deux exercices n'est jamais traitée comme une preuve suffisante qu'un exercice produit plus d'hypertrophie qu'un autre.",
        {
          domain: "exercise",
          knowledgeType: "MYTH_REFUTATION",
          epistemicStatus: "refuted",
          citations: [],
          limitations: [
            "L'étude Plotkin est présentée comme illustrative ; la portée de sa citation pour cette règle générale reste ambiguë."
          ],
          cannotConclude: [
            "Une amplitude EMG supérieure démontre une hypertrophie supérieure."
          ],
          flags: ["emg_content", "ambiguous_citation"]
        }
      ),
      emg(
        "l'EMG du hip thrust dépasse largement celle du squat pour le grand fessier (moyenne 69,5 % contre 29,4 % de la contraction volontaire maximale, pics 172 % contre 84,9 %)",
        {
          citations: ["cand.e5-citation.ed7e5bec1319486d"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            confidenceByAspect: "confidence_not_stated"
          },
          cannotConclude: [
            "Cette différence d'EMG démontre une hypertrophie supérieure du hip thrust."
          ]
        }
      ),
      evidence(
        "neuf semaines d'entraînement à volume égalisé produisent une hypertrophie fessière quasiment identique en IRM dans les trois régions du grand fessier",
        {
          citations: ["cand.e5-citation.ed7e5bec1319486d"],
          assessment: { directness: "direct_hypertrophy_measured" },
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            confidenceByAspect: "confidence_not_stated"
          },
          cannotConclude: [
            "Le hip thrust et le squat sont équivalents pour toute population, toute durée et tout protocole."
          ]
        }
      ),
      evidence(
        "sans corrélation fiable entre l'amplitude EMG et la croissance mesurée",
        {
          citations: ["cand.e5-citation.ed7e5bec1319486d"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            directness: "combined_emg_and_imaging_outcome",
            confidenceByAspect: "confidence_not_stated"
          },
          cannotConclude: ["L'EMG ne prédit jamais l'hypertrophie."],
          flags: ["emg_content"]
        }
      )
    ],
    [
      "La citation Plotkin soutient clairement les résultats comparatifs, mais son rattachement à la règle générale initiale demande adjudication."
    ]
  ),

  needsAdjudication(
    "frag.f2.0003",
    [
      biomechanics(
        "l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épaule pendant l'exercice",
        {
          citations: [],
          citationAttributionState: "UNRESOLVED",
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            evidenceTypes: "citation_scope_ambiguous"
          },
          flags: ["ambiguous_citation"]
        }
      ),
      evidence(
        "produit une hypertrophie substantiellement plus importante du chef long que le même exercice réalisé bras le long du corps (position neutre), à volume et effort égalisés sur plusieurs semaines",
        {
          citations: ["cand.e5-citation.c26ca4cf801ca5ab"],
          epistemicStatus: "probable",
          assessment: { directness: "direct_hypertrophy_measured" },
          unresolvedAxes: {
            confidenceByAspect: "confidence_range_moderate_to_high",
            evidenceTypes: "controlled_trial_does_not_resolve_closed_vocabulary_type"
          },
          limitations: ["Essai contrôlé unique."],
          cannotConclude: [
            "Tout exercice overhead est supérieur pour l'ensemble du triceps."
          ]
        }
      ),
      practice(
        "les extensions au-dessus de la tête (overhead extension, skull crusher incliné bras verticaux) ciblent préférentiellement le chef long",
        {
          citations: [],
          citationAttributionState: "UNRESOLVED",
          flags: ["ambiguous_citation"],
          cannotConclude: [
            "Les extensions au-dessus de la tête sont universellement supérieures pour le triceps."
          ]
        }
      ),
      claim(
        "les pushdowns et extensions bras le long du corps sollicitent davantage les chefs latéral et médial sans étirement supplémentaire du chef long.",
        {
          domain: "exercise",
          citations: [],
          citationAttributionState: "UNRESOLVED",
          unresolvedAxes: {
            knowledgeType: "sollicitation_outcome_not_operationalized",
            epistemicStatus: "status_not_explicit",
            directness: "measurement_type_not_stated",
            evidenceTypes: "citation_scope_ambiguous"
          },
          ambiguities: [
            "Le terme sollicitent ne précise ni EMG, ni tension, ni hypertrophie."
          ],
          flags: ["ambiguous_citation"]
        }
      )
    ],
    [
      "La citation terminale soutient le résultat hypertrophique ; sa portée pour le mécanisme et les deux conseils pratiques n'est pas explicite.",
      "Le type de connaissance de la sollicitation des chefs latéral et médial n'est pas déterminable."
    ]
  ),

  annotated("frag.f2.0004", [
    evidence(
      "chaque modalité produit un gain de force supérieur dans son propre mode de test",
      {
        citations: ["cand.e5-citation.02cf57ff924cbbd8"],
        epistemicStatus: "probable",
        assessment: { evidenceTypes: ["meta_analysis"] },
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated_for_force",
          directness: "force_directness_not_available_in_closed_vocabulary"
        }
      }
    ),
    evidence(
      "aucune différence significative d'hypertrophie entre les deux modalités",
      {
        citations: ["cand.e5-citation.02cf57ff924cbbd8"],
        epistemicStatus: "uncertain",
        assessment: {
          directness: "direct_hypertrophy_measured",
          evidenceTypes: ["meta_analysis"]
        },
        unresolvedAxes: {
          confidenceByAspect: "confidence_range_moderate_to_high"
        },
        limitations: ["Nombre limité d'études d'hypertrophie disponibles."],
        cannotConclude: [
          "Les poids libres et les machines sont équivalents pour l'hypertrophie."
        ]
      }
    ),
    practice(
      "le choix entre poids libres et machines pour l'hypertrophie devrait reposer sur la stabilité, le confort, la disponibilité et la préférence individuelle plutôt que sur une supposée supériorité universelle d'une modalité.",
      {
        citations: [],
        citationAttributionState: "NOT_CITED",
        cannotConclude: [
          "Une modalité est universellement supérieure pour l'hypertrophie."
        ]
      }
    )
  ]),

  annotated("frag.f2.0008", [
    evidence(
      "Peu d'études biomécaniques dédiées quantifient directement la charge au coude pendant les exercices de triceps (skull crusher, extension overhead) en musculation récréative",
      {
        epistemicStatus: "absence_of_evidence",
        citations: [],
        flags: ["explicit_absence", "biomechanical_risk_language"],
        cannotConclude: [
          "Aucune charge au coude n'existe pendant ces exercices."
        ]
      }
    ),
    evidence(
      "la littérature disponible sur la charge au coude provient principalement du contexte du lancer au baseball, peu généralisable",
      {
        epistemicStatus: "uncertain",
        citations: ["cand.e5-citation.c606a5fa04358b7b"],
        assessment: {
          confidenceByAspect: [
            { aspect: "generalization", confidence: "very_low" }
          ]
        },
        unresolvedAxes: {
          directness: "baseball_biomechanics_are_indirect_for_the_target_population",
          evidenceTypes: "document_type_not_stated"
        },
        flags: ["biomechanical_risk_language"],
        cannotConclude: [
          "Les données du lancer au baseball se généralisent à la musculation récréative."
        ]
      }
    ),
    hypothesis(
      "l'affirmation courante selon laquelle le skull crusher ou l'extension overhead imposerait une contrainte particulière au coude repose largement sur un raisonnement biomécanique de premier principe (moment de flexion élevé en bras de levier long) plutôt que sur une mesure directe publiée en contexte de musculation",
      {
        citations: [],
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "generalization", confidence: "very_low" }
          ]
        },
        flags: ["explicit_absence", "biomechanical_risk_language"],
        cannotConclude: [
          "Le skull crusher ou l'extension overhead est dangereux pour le coude."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00083542", [
    evidence(
      "Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *evidence-based* documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée",
      {
        citations: ["cand.e5-citation.13c064ac2a25902d"],
        epistemicStatus: "uncertain",
        assessment: {
          directness: "qualitative_survey",
          evidenceTypes: ["qualitative_study"]
        },
        unresolvedAxes: {
          confidenceByAspect: "very_low_is_only_explicit_for_causal_claims"
        },
        cannotConclude: [
          "La pratique des coachs cause de meilleurs résultats."
        ]
      }
    ),
    evidence(
      "avec des domaines où l'expérience pratique dépasse ou diverge de la littérature disponible",
      {
        citations: ["cand.e5-citation.13c064ac2a25902d"],
        epistemicStatus: "uncertain",
        assessment: {
          directness: "qualitative_survey",
          evidenceTypes: ["qualitative_study"]
        },
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated_for_descriptive_claim"
        }
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00000259",
    "Introduction décrivant le périmètre du rapport et un renvoi interne ; aucune affirmation scientifique autonome à extraire."
  ),

  zeroClaim(
    "frag.f2.0002",
    "Décision méthodologique interne qui classe les familles de preuves du rapport ; elle ne constitue pas une claim scientifique E5."
  ),

  needsAdjudication(
    "frag.e5f2.00026956",
    [
      anatomy("Le grand droit de l'abdomen réalise la **flexion du tronc**", {
        citations: ["cand.e5-citation.2a28c5f0b581556c"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          directness: "architecture_method_not_stated"
        }
      }),
      anatomy(
        "les obliques externes et internes réalisent la **flexion latérale** et la **rotation du tronc**",
        {
          citations: ["cand.e5-citation.2a28c5f0b581556c"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            directness: "architecture_method_not_stated"
          }
        }
      ),
      anatomy(
        "le transverse de l'abdomen agit principalement comme stabilisateur de la pression intra-abdominale plutôt que comme moteur de mouvement.",
        {
          citations: ["cand.e5-citation.2a28c5f0b581556c"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            directness: "architecture_method_not_stated"
          }
        }
      ),
      emg(
        "une étude EMG montre une activité différentielle des régions du transverse de l'abdomen pendant la rotation du tronc",
        {
          citations: ["cand.e5-citation.f036e4fac1fa698e"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "study_is_emg_but_document_type_mapping_requires_adjudication"
          }
        }
      )
    ],
    [
      "La portée exacte de la citation architecturale sur chacune des trois fonctions anatomiques coordonnées demande adjudication."
    ]
  ),

  annotated("frag.e5f2.00028637", [
    biomechanics(
      "La difficulté ressentie à un instant donné du mouvement dépend du rapport entre le **moment de force externe** (produit par la charge et son bras de levier par rapport à l'articulation) et le **moment de force interne** (produit par le muscle et son bras de levier anatomique, qui varie lui-même avec l'angle articulaire).",
      {
        epistemicStatus: "established",
        citations: []
      }
    ),
    biomechanics(
      "ces bras de levier internes varient de façon non linéaire et parfois importante sur l'amplitude de mouvement",
      {
        epistemicStatus: "established",
        citations: ["cand.e5-citation.08f1787eb97af7ab"],
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "descriptive_accuracy", confidence: "high" }
          ]
        },
        unresolvedAxes: { evidenceTypes: "document_type_not_stated" }
      }
    ),
    hypothesis(
      "généralisable par analogie anatomique à d'autres articulations, même si des cartographies aussi détaillées n'existent pas pour chaque articulation.",
      {
        citations: [],
        epistemicStatus: "mechanistic_only",
        limitations: [
          "Des cartographies aussi détaillées n'existent pas pour chaque articulation."
        ],
        cannotConclude: [
          "La cartographie de l'épaule décrit directement toutes les autres articulations."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00034666", [
    hypothesis(
      "l'hypothèse que l'entraînement réalisé lorsque le muscle est en **position étirée/allongée** produit un stimulus hypertrophique supérieur ou complémentaire à l'entraînement en position raccourcie, à volume et effort égalisés.",
      {
        citations: [],
        cannotConclude: [
          "L'entraînement à grande longueur produit universellement une hypertrophie supérieure."
        ]
      }
    ),
    claim(
      "Une revue narrative détaille les mécanismes proposés de l'hypertrophie médiée par l'étirement, notamment l'activation de voies de signalisation anabolique (Akt/mTOR) par la tension mécanique passive et active à grande longueur",
      {
        domain: "biomechanics",
        knowledgeType: "MECHANISM",
        epistemicStatus: "mechanistic_only",
        citations: ["cand.e5-citation.d2cea0ce1a8a2a0f"],
        assessment: {
          directness: "mechanistic_hypothesis",
          evidenceTypes: ["narrative_review"],
          supportsDemonstratedClinicalRisk: false
        }
      }
    ),
    hypothesis(
      "la sarcomérogenèse en série observée dans des modèles animaux",
      {
        citations: ["cand.e5-citation.d2cea0ce1a8a2a0f"],
        assessment: {
          directness: "animal_model",
          evidenceTypes: ["narrative_review"],
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "generalization", confidence: "low" }
          ]
        },
        limitations: [
          "Preuve translationnelle depuis des modèles animaux, faible pour une application quantitative directe chez l'humain entraîné."
        ]
      }
    )
  ]),

  annotated("frag.f2.0021", [
    evidence(
      "Un essai randomisé intra-sujet chez des sujets entraînés compare directement des répétitions partielles en position allongée à des répétitions en amplitude complète et trouve des adaptations musculaires similaires entre les deux conditions",
      {
        citations: ["cand.e5-citation.424e50e70e773a55"],
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_hypertrophy_measured",
          evidenceTypes: ["randomized_trial", "within_participant_trial"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        },
        limitations: [
          "Échantillon limité, muscles et exercices spécifiques du haut du corps."
        ],
        cannotConclude: [
          "Les répétitions partielles allongées sont équivalentes à l'amplitude complète pour tous les muscles et protocoles."
        ]
      }
    ),
    evidence(
      "Une méta-analyse et revue systématique comparant amplitude partielle et complète de façon plus large confirme l'absence de supériorité générale de l'amplitude complète lorsque la partielle est réalisée à grande longueur, tout en soulignant l'hétérogénéité des protocoles inclus",
      {
        citations: ["cand.e5-citation.40b2fe19ffc586b3"],
        epistemicStatus: "uncertain",
        assessment: {
          directness: "direct_hypertrophy_measured",
          evidenceTypes: ["systematic_review", "meta_analysis"]
        },
        unresolvedAxes: { confidenceByAspect: "confidence_not_stated" },
        limitations: ["Hétérogénéité des protocoles inclus."],
        cannotConclude: [
          "L'amplitude complète et les répétitions partielles sont universellement équivalentes."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00044614", [
    hypothesis(
      "une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série",
      {
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "low" }
          ]
        }
      }
    ),
    hypothesis(
      "Une instabilité excessive peut réduire la charge utilisable et détourner l'effort vers des muscles stabilisateurs non ciblés.",
      {
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "low" }
          ]
        }
      }
    ),
    claim(
      "qu'une stabilité maximale (machine guidée) est toujours supérieure à un poids libre pour l'hypertrophie",
      {
        domain: "exercise",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        cannotConclude: [
          "Une stabilité maximale est toujours supérieure pour l'hypertrophie."
        ]
      }
    ),
    hypothesis(
      "La stabilité est donc un paramètre qui influence la *technique et la charge utilisable*, pas un déterminant direct et indépendant démontré de l'hypertrophie.",
      {
        cannotConclude: [
          "La stabilité détermine directement et indépendamment l'hypertrophie."
        ]
      }
    )
  ]),

  needsAdjudication(
    "frag.f2.0023",
    [
      hypothesis(
        "Le développé militaire (overhead press) et les élévations latérales sollicitent fortement le complexe de la coiffe des rotateurs à des amplitudes d'abduction élevées",
        {
          citations: [],
          citationAttributionState: "UNRESOLVED",
          flags: ["ambiguous_citation", "biomechanical_risk_language"]
        }
      ),
      evidence(
        "Ces données proviennent de populations d'athlètes de lancer à charges répétitives à haute vitesse, pas de pratiquants de musculation",
        {
          citations: [
            "cand.e5-citation.3a033ed6c17d5188",
            "cand.e5-citation.387bef6af9d96c23"
          ],
          epistemicStatus: "uncertain",
          assessment: {
            directness: "indirect_clinical",
            confidenceByAspect: [
              { aspect: "generalization", confidence: "very_low" }
            ]
          },
          unresolvedAxes: {
            evidenceTypes: "one_label_states_systematic_review_but_group_mapping_is_ambiguous"
          },
          flags: ["ambiguous_citation", "biomechanical_risk_language"]
        }
      ),
      hypothesis(
        "leur généralisation à l'overhead press en musculation constitue un **risque supposé par analogie, niveau de preuve très faible pour cette population spécifique**.",
        {
          citations: [],
          citationAttributionState: "UNRESOLVED",
          assessment: {
            directness: "mechanistic_hypothesis",
            supportsDemonstratedClinicalRisk: false,
            confidenceByAspect: [
              { aspect: "generalization", confidence: "very_low" }
            ]
          },
          flags: ["ambiguous_citation", "biomechanical_risk_language"],
          cannotConclude: [
            "L'overhead press cause un conflit sous-acromial chez les pratiquants de musculation."
          ]
        }
      )
    ],
    [
      "Les deux citations terminales forment un groupe et leur contribution individuelle aux propositions du fragment n'est pas explicite."
    ]
  ),

  needsAdjudication(
    "frag.e5f2.00066319",
    [
      claim(
        "La prise neutre du hammer curl favorise le brachial et le brachioradial relativement au biceps brachial",
        {
          domain: "exercise",
          unresolvedAxes: {
            knowledgeType: "favorise_does_not_identify_emg_force_or_biomechanical_outcome",
            epistemicStatus: "status_not_explicit",
            directness: "measurement_type_not_stated",
            evidenceTypes: "only_internal_section_references"
          },
          citationAttributionState: "NOT_CITED",
          ambiguities: [
            "Le verbe favorise ne précise pas la mesure sous-jacente."
          ]
        }
      )
    ],
    [
      "Le type de résultat derrière favorise est indéterminable à partir de ce fragment seul."
    ]
  ),

  annotated("frag.f2.0011", [
    claim(
      "Deux exercices partageant le pattern de mouvement et le muscle principal, mais différant sur une dimension significative (longueur musculaire dominante, biarticularité exploitée différemment, demande lombaire).",
      {
        domain: "exercise",
        knowledgeType: "DEFINITION",
        epistemicStatus: "practice_only",
        flags: ["modeling_content"]
      }
    ),
    biomechanics(
      "le squat impose une charge axiale rachidienne et une demande de stabilisation du tronc absente en leg press, et une extension de hanche concomitante qui sollicite davantage les fessiers et ischio-jambiers en synergie.",
      {
        unresolvedAxes: { epistemicStatus: "status_not_explicit" },
        flags: ["biomechanical_risk_language"]
      }
    ),
    practice(
      "Ce sont des substitutions raisonnables pour l'hypertrophie du quadriceps (aucune étude ne démontrant de supériorité franche de l'un sur l'autre pour ce muscle spécifiquement dans les données identifiées), mais pas interchangeables pour l'objectif de force spécifique au squat ni pour la demande lombaire.",
      {
        flags: ["explicit_absence"],
        limitations: [
          "Aucune étude identifiée ne démontre de supériorité franche pour l'hypertrophie spécifique du quadriceps."
        ],
        cannotConclude: [
          "Le squat et la leg press sont interchangeables pour la force spécifique au squat ou la demande lombaire."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00085197", [
    practice(
      "substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergente) est une pratique largement répandue chez les coachs *evidence-based*, fondée sur l'observation clinique individuelle plutôt que sur une preuve populationnelle",
      {
        flags: ["clinical_content"],
        limitations: [
          "Fondée sur l'observation clinique individuelle plutôt que sur une preuve populationnelle."
        ],
        cannotConclude: [
          "Cette substitution est une règle universelle de sécurité."
        ]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00091327",
    "Instruction de remplissage de la base de données ; contenu de gouvernance hors claims scientifiques E5."
  ),

  annotated("frag.f2.0015", [
    evidence(
      "contraintes précises au coude en musculation récréative (section 6.2)",
      {
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence", "biomechanical_risk_language"]
      }
    ),
    evidence(
      "lien longitudinal direct entre charge lombaire modélisée et incidence de blessure en musculation (section 6.4)",
      {
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence", "biomechanical_risk_language"]
      }
    ),
    evidence(
      "contraintes cervicales/thoraciques spécifiques aux exercices de musculation (section 6.4)",
      {
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence", "biomechanical_risk_language"]
      }
    ),
    evidence(
      "charge de cheville en musculation pure hors contexte clinique (section 6.7)",
      {
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence", "biomechanical_risk_language"]
      }
    ),
    evidence(
      "hypertrophie régionale directement mesurée pour de nombreuses paires d'exercices couramment comparées en pratique (Bayesian curl, straight-arm pulldown, nombreuses variantes de mollets) où seul un raisonnement biomécanique de premier principe est actuellement disponible.",
      {
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence"],
        limitations: [
          "Seul un raisonnement biomécanique de premier principe est actuellement disponible."
        ],
        cannotConclude: [
          "Le raisonnement biomécanique démontre une hypertrophie régionale différentielle."
        ]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00095348",
    "Règle d'encodage de la base de données ; elle ne doit pas être transformée en claim scientifique autonome."
  ),

  zeroClaim(
    "frag.e5f2.00000087",
    "Sous-titre et métadonnée d'état du document, sans prédicat scientifique qualifiable."
  ),

  annotated("frag.e5f2.00005159", [
    evidence(
      "La majorité des études d'imagerie régionale et de biomécanique porte sur de petits échantillons (souvent moins de 20 à 40 sujets), majoritairement de jeunes hommes non entraînés ou récréativement entraînés, sur des durées de 6 à 12 semaines.",
      {
        epistemicStatus: "uncertain",
        assessment: {
          confidenceByAspect: [
            { aspect: "generalization", confidence: "low" }
          ]
        },
        limitations: [
          "Petits échantillons, surtout jeunes hommes non entraînés ou récréativement entraînés, sur 6 à 12 semaines."
        ]
      }
    ),
    emg(
      "Les données EMG comparatives entre exercices sont nombreuses mais hétérogènes en méthodologie (normalisation, placement des électrodes, phase du mouvement analysée).",
      {
        epistemicStatus: "uncertain",
        limitations: [
          "Hétérogénéité de normalisation, de placement des électrodes et de phase analysée."
        ]
      }
    ),
    biomechanics(
      "Les données de moment arms et de forces articulaires proviennent souvent de modèles musculo-squelettiques ou de cadavres, extrapolés à des humains vivants en mouvement dynamique.",
      {
        epistemicStatus: "uncertain",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "generalization", confidence: "low" }
          ]
        },
        limitations: [
          "Extrapolation de modèles musculo-squelettiques ou de cadavres à des humains vivants en mouvement dynamique."
        ]
      }
    ),
    evidence(
      "Peu d'études suivent des athlètes très avancés ou des femmes en nombre suffisant.",
      {
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence"],
        assessment: {
          confidenceByAspect: [
            { aspect: "generalization", confidence: "low" }
          ]
        }
      }
    )
  ]),

  annotated("frag.e5f2.00011252", [
    anatomy(
      "Le deltoïde est composé de trois faisceaux aux orientations de fibres et aux bras de levier distincts.",
      {
        unresolvedAxes: { epistemicStatus: "status_not_explicit" }
      }
    ),
    biomechanics(
      "ces bras de levier varient fortement et de façon non linéaire selon la position angulaire de l'épaule dans les trois plans",
      {
        epistemicStatus: "established",
        citations: ["cand.e5-citation.048b25250c849a98"],
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "descriptive_accuracy", confidence: "high" }
          ]
        },
        unresolvedAxes: { evidenceTypes: "document_type_not_stated" }
      }
    ),
    hypothesis(
      "ce qui a des implications directes pour le choix du profil de résistance",
      {
        citations: [],
        cannotConclude: [
          "Une position ou un profil de résistance est hypertrophiquement supérieur."
        ]
      }
    )
  ]),

  annotated("frag.f2.0024", [
    biomechanics(
      "Avec un poids libre soumis à la gravité, le moment externe est maximal lorsque le segment est horizontal (bras de levier de la charge maximal par rapport à la verticale de la gravité) et diminue vers zéro lorsque le segment est vertical.",
      {
        epistemicStatus: "established",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "descriptive_accuracy", confidence: "high" }
          ]
        }
      }
    ),
    biomechanics(
      "un développé couché haltères impose l'essentiel de la difficulté externe en fin de course (bras tendus, quand le poids est loin du point d'appui vertical)",
      {
        epistemicStatus: "probable",
        unresolvedAxes: { confidenceByAspect: "application_specific_not_graded" }
      }
    ),
    biomechanics(
      "un curl haltère debout impose l'essentiel de la difficulté au milieu de l'amplitude, lorsque l'avant-bras est horizontal.",
      {
        epistemicStatus: "probable",
        unresolvedAxes: { confidenceByAspect: "application_specific_not_graded" }
      }
    ),
    biomechanics(
      "le « point difficile » de l'exercice dépend de l'orientation du corps par rapport à la verticale, pas uniquement de l'anatomie musculaire",
      {
        epistemicStatus: "established",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "high" }
          ]
        },
        limitations: ["Application spécifique à documenter exercice par exercice."]
      }
    )
  ]),

  annotated("frag.e5f2.00038965", [
    biomechanics(
      "un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dorsal dans une moindre mesure) peut être placé en position **plus ou moins étirée** en manipulant simultanément l'angle des deux articulations qu'il traverse, ce qu'un muscle mono-articulaire ne permet pas.",
      {
        epistemicStatus: "established",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    biomechanics(
      "étirer les ischio-jambiers en combinant flexion de hanche et extension de genou (RDL) plutôt qu'en flexion de genou isolée assise",
      {
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    biomechanics(
      "étirer le chef long du triceps en combinant flexion d'épaule et flexion de coude (extension overhead)",
      {
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    biomechanics(
      "étirer le droit fémoral en combinant extension de hanche et flexion de genou (fentes arrière, leg curl debout avec hanche en extension).",
      {
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    hypothesis(
      "Ce raisonnement est une **extrapolation biomécanique de niveau modéré**, solidement ancrée dans l'anatomie mais testée directement seulement pour certains muscles (triceps, quadriceps partiellement).",
      {
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "generalization", confidence: "moderate" }
          ]
        },
        limitations: [
          "Testé directement seulement pour certains muscles, notamment triceps et quadriceps partiellement."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00042447", [
    claim(
      "qu'il existe une règle universelle applicable à tous les muscles et exercices",
      {
        domain: "exercise",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        cannotConclude: [
          "Une règle d'amplitude unique s'applique à tous les muscles et exercices."
        ]
      }
    ),
    claim(
      "que toucher des repères arbitraires (barre au sternum, genou à 90°) est nécessaire indépendamment de l'anatomie individuelle ou de la douleur",
      {
        domain: "exercise",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        flags: ["clinical_content", "numeric_threshold"],
        cannotConclude: [
          "Des repères arbitraires sont nécessaires indépendamment de l'anatomie individuelle ou de la douleur."
        ]
      }
    ),
    claim(
      "qu'une amplitude partielle est toujours inférieure quel que soit son positionnement dans la course musculaire.",
      {
        domain: "exercise",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        cannotConclude: [
          "Toute amplitude partielle est inférieure quel que soit son positionnement."
        ]
      }
    )
  ]),

  annotated("frag.f2.0005", [
    hypothesis(
      "La stabilité requise par un exercice — support du torse, base d'appui, guidage de la trajectoire par une machine ou un rail — détermine dans quelle mesure l'effort du pratiquant doit être partagé entre la production de force du muscle cible et la stabilisation posturale/articulaire.",
      {
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    emg(
      "les surfaces instables augmentent l'activation des muscles stabilisateurs du tronc",
      {
        citations: ["cand.e5-citation.c912c0efbdc07ea5"],
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["systematic_review", "meta_analysis"],
          supportsHypertrophySuperiority: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    emg(
      "diminuent généralement l'activation du muscle agoniste principal",
      {
        citations: ["cand.e5-citation.c912c0efbdc07ea5"],
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["systematic_review", "meta_analysis"],
          supportsHypertrophySuperiority: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    evidence(
      "et la force produite, comparé à un exercice équivalent sur surface stable",
      {
        citations: ["cand.e5-citation.c912c0efbdc07ea5"],
        epistemicStatus: "probable",
        assessment: {
          evidenceTypes: ["systematic_review", "meta_analysis"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        },
        unresolvedAxes: {
          directness: "force_directness_not_available_in_closed_vocabulary"
        }
      }
    )
  ]),

  annotated("frag.f2.0007", [
    biomechanics(
      "les exercices de poulie (cable crossover) imposent des moments maximaux à l'épaule significativement plus élevés que les variantes de développé couché",
      {
        epistemicStatus: "probable",
        citations: ["cand.e5-citation.a286511957b56850"],
        assessment: {
          directness: "biomechanical_only",
          evidenceTypes: ["biomechanical_study"],
          supportsDemonstratedClinicalRisk: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        },
        cannotConclude: [
          "Les exercices de poulie sont dangereux pour l'épaule."
        ],
        flags: ["biomechanical_risk_language"]
      }
    )
  ]),

  needsAdjudication(
    "frag.e5f2.00075653",
    [
      biomechanics(
        "Les extensions de hanche à genou fléchi (position réduisant le bras de levier des ischio-jambiers biarticulaires par flexion de genou, isolant relativement mieux le grand fessier)",
        {
          citations: [],
          citationAttributionState: "UNRESOLVED",
          unresolvedAxes: { epistemicStatus: "status_not_explicit" },
          flags: ["ambiguous_citation"]
        }
      ),
      evidence(
        "les machines d'abduction ciblant le moyen et le petit fessier sont soutenues par une méta-analyse d'hypertrophie déjà citée",
        {
          citations: ["cand.e5-citation.d447aa51a6252413"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            directness: "hypertrophy_measurement_scope_ambiguous",
            confidenceByAspect: "confidence_not_stated"
          },
          assessment: { evidenceTypes: ["meta_analysis"] },
          flags: ["ambiguous_citation"]
        }
      ),
      emg(
        "des données EMG sur l'activation du moyen fessier selon la charge en abduction de hanche horizontale",
        {
          citations: ["cand.e5-citation.83740fb8401e6046"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            confidenceByAspect: "confidence_not_stated"
          }
        }
      ),
      emg(
        "pendant des exercices de renforcement multi-articulaires",
        {
          citations: ["cand.e5-citation.beb7e214150b6d00"],
          unresolvedAxes: {
            epistemicStatus: "predicate_depends_on_prior_emg_phrase",
            confidenceByAspect: "confidence_not_stated"
          },
          ambiguities: [
            "Le dernier complément hérite grammaticalement de données EMG, mais son prédicat est elliptique."
          ]
        }
      )
    ],
    [
      "Le rattachement de la méta-analyse aux extensions de hanche et aux machines d'abduction n'est pas syntaxiquement univoque.",
      "La dernière proposition EMG est elliptique."
    ]
  ),

  annotated("frag.f2.0012", [
    biomechanics(
      "l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas",
      {
        epistemicStatus: "established",
        citations: [],
        citationAttributionState: "UNRESOLVED",
        flags: ["ambiguous_citation"]
      }
    ),
    evidence(
      "avec une preuve directe d'hypertrophie différentielle du chef long entre les deux configurations",
      {
        citations: ["cand.e5-citation.1cb73570ada2b3fd"],
        epistemicStatus: "probable",
        assessment: { directness: "direct_hypertrophy_measured" },
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_stated"
        }
      }
    ),
    biomechanics(
      "position de hanche différente modulant la longueur des ischio-jambiers biarticulaires en début de mouvement.",
      {
        unresolvedAxes: { epistemicStatus: "status_not_explicit" }
      }
    ),
    practice(
      "Ces paires ne devraient pas être présentées comme interchangeables lorsque l'objectif est une hypertrophie régionale précise (par exemple prioriser le chef long du triceps ou la portion proximale des ischio-jambiers).",
      {
        cannotConclude: [
          "Ces paires sont interchangeables pour tout objectif d'hypertrophie régionale."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00084420", [
    practice(
      "les exercices sur machine ou en câble sont généralement plus rapides à installer et permettent des incréments de charge plus fins (empilement de plaques, poulies réglables), ce qui facilite la surcharge progressive à petite échelle",
      {
        limitations: ["Plausible mais non quantifié par essai."],
        cannotConclude: [
          "Les machines ou câbles produisent une surcharge progressive supérieure dans tous les contextes."
        ]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00086736",
    "Description d'un schéma de données et instruction de gouvernance épistémique ; hors claims scientifiques E5."
  ),

  zeroClaim(
    "frag.e5f2.00095815",
    "Instruction d'encodage du champ primaryMuscles ; aucune claim scientifique autonome."
  ),

  annotated("frag.e5f2.00018221", [
    anatomy(
      "Le quadriceps comprend quatre chefs : le **droit fémoral** (rectus femoris), seul chef **biarticulaire** (fléchisseur de hanche et extenseur de genou), et les trois **vastes** (latéral, médial, intermédiaire), mono-articulaires au genou uniquement.",
      {
        epistemicStatus: "established",
        citations: ["cand.e5-citation.59f06d40f0604733"],
        unresolvedAxes: {
          directness: "anatomical_document_method_not_stated",
          evidenceTypes: "document_type_not_stated"
        }
      }
    ),
    biomechanics(
      "le droit fémoral subit une **insuffisance active** lorsque la hanche est fléchie en même temps que le genou est étendu (car il est simultanément étiré à la hanche et raccourci au genou)",
      {
        epistemicStatus: "established",
        citations: ["cand.e5-citation.59f06d40f0604733"],
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        unresolvedAxes: { evidenceTypes: "document_type_not_stated" }
      }
    ),
    biomechanics(
      "ce qui limite sa capacité à produire une force maximale dans cette configuration",
      {
        epistemicStatus: "established",
        citations: ["cand.e5-citation.59f06d40f0604733"],
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        unresolvedAxes: { evidenceTypes: "document_type_not_stated" }
      }
    )
  ]),

  annotated("frag.e5f2.00030555", [
    biomechanics(
      "Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)",
      { epistemicStatus: "established" }
    ),
    biomechanics(
      "le moment résultant à l'articulation varie tout de même avec l'angle formé entre le câble et le segment corporel.",
      { epistemicStatus: "established" }
    ),
    biomechanics(
      "Les câbles permettent de modifier l'angle de traction indépendamment de la gravité, ce qui autorise des profils de résistance impossibles en poids libre",
      { epistemicStatus: "established" }
    ),
    biomechanics(
      "maintenir une tension significative en position d'épaule fléchie complète (fin de mouvement d'un cable fly), configuration où un haltère perdrait presque toute résistance car le bras de levier gravitationnel s'annule.",
      { epistemicStatus: "probable" }
    ),
    claim(
      "la traduction en supériorité hypertrophique nette par rapport aux poids libres ne soit pas démontrée de façon générale",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "absence_of_evidence",
        flags: ["explicit_absence"],
        cannotConclude: [
          "Les câbles sont généralement supérieurs aux poids libres pour l'hypertrophie."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00037232", [
    evidence(
      "Un essai comparant un entraînement à intensité modérée en amplitude partielle à grande longueur contre un entraînement à haute intensité en amplitude complète trouve des adaptations architecturales et hypertrophiques similaires",
      {
        citations: ["cand.e5-citation.e129f4d3477086ee"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "trial_randomization_not_stated"
        },
        assessment: { directness: "direct_hypertrophy_measured" },
        cannotConclude: [
          "Les deux protocoles sont équivalents pour toute population et tout muscle."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00041891", [
    practice(
      "l'amplitude complète reste une règle par défaut solide et sans inconvénient démontré pour la plupart des exercices et pratiquants.",
      {
        assessment: {
          directness: "expert_only",
          confidenceByAspect: [
            { aspect: "generalization", confidence: "moderate" }
          ]
        },
        cannotConclude: [
          "L'amplitude complète est nécessaire ou sans inconvénient pour chaque exercice et chaque pratiquant."
        ]
      }
    ),
    evidence(
      "Les répétitions partielles systématiquement réalisées en position raccourcie (par exemple ne pas descendre en squat, ne pas étirer le curl) sont probablement inférieures pour l'hypertrophie du muscle concerné.",
      {
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_hypertrophy_measured",
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    evidence(
      "Les répétitions partielles réalisées en position **allongée** peuvent égaler l'amplitude complète dans certains muscles et protocoles.",
      {
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_hypertrophy_measured",
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        },
        cannotConclude: [
          "Les répétitions partielles allongées égalent toujours l'amplitude complète."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00043879", [
    emg(
      "Une comparaison EMG et cinématique de squats unilatéraux sous différentes conditions de stabilité montre des différences d'activation et de contrôle moteur selon le niveau de stabilité requis",
      {
        citations: ["cand.e5-citation.3b83d077892029de"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "study_design_not_stated"
        }
      }
    ),
    emg(
      "Une étude comparant l'activation musculaire et la cinématique du développé couché unilatéral sur surface stable contre instable, avec un ou deux haltères, illustre concrètement comment le degré de stabilité modifie la sollicitation",
      {
        citations: ["cand.e5-citation.7a7b63c156a7ef59"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "study_design_not_stated"
        }
      }
    )
  ]),

  annotated("frag.f2.0009", [
    claim(
      "une charge de compression ou de cisaillement lombaire élevée mesurée par modélisation est une **charge mécanique documentée**, pas un **risque de blessure démontré**.",
      {
        domain: "biomechanics",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        flags: ["biomechanical_risk_language"],
        cannotConclude: [
          "Une charge mécanique élevée démontre un risque de blessure."
        ]
      }
    ),
    evidence(
      "Le rachis, comme tout tissu, s'adapte à la charge progressive",
      {
        domain: "clinical",
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "support_not_stated_in_fragment"
        },
        flags: ["clinical_content"]
      }
    ),
    claim(
      "l'existence d'une force élevée pendant un soulevé de terre maximal ne permet pas de conclure que l'exercice est dangereux pour un pratiquant correctement progressé.",
      {
        domain: "clinical",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          directness: "biomechanical_only",
          supportsDemonstratedClinicalRisk: false
        },
        flags: ["clinical_content", "biomechanical_risk_language"],
        cannotConclude: [
          "Une force élevée rend le soulevé de terre dangereux."
        ]
      }
    ),
    evidence(
      "Aucune étude longitudinale de cohorte en musculation récréative reliant directement une charge lombaire mesurée par modélisation à une incidence de blessure n'a été identifiée dans cette recherche pour les principaux mouvements de musculation",
      {
        domain: "clinical",
        epistemicStatus: "absence_of_evidence",
        assessment: {
          evidenceTypes: ["cohort"],
          supportsDemonstratedClinicalRisk: false
        },
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "absent_study_has_no_directness"
        },
        flags: ["explicit_absence", "clinical_content", "biomechanical_risk_language"],
        cannotConclude: [
          "La charge lombaire modélisée ne présente aucun risque de blessure."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00072017", [
    biomechanics(
      "La position de hanche diffère entre ces deux variantes (hanche fléchie en position assise, hanche en extension relative en position couchée sur le ventre), ce qui modifie la longueur des ischio-jambiers biarticulaires au début du mouvement.",
      {
        unresolvedAxes: { epistemicStatus: "status_not_explicit" }
      }
    ),
    emg(
      "la sensation perçue ne coïncide pas nécessairement avec l'activation mesurée par région",
      {
        citations: ["cand.e5-citation.ffdc005a36bf405b"],
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          supportsHypertrophySuperiority: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ]
        }
      }
    ),
    emg(
      "preuve EMG régionale récente, niveau modéré",
      {
        citations: ["cand.e5-citation.ffdc005a36bf405b"],
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          supportsHypertrophySuperiority: false,
          confidenceByAspect: [
            { aspect: "regional_specificity", confidence: "moderate" }
          ]
        },
        cannotConclude: [
          "L'activation EMG régionale prouve l'hypertrophie régionale correspondante."
        ]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00078216",
    "Cadre de modélisation définissant les critères d'une substitution dans la future base ; aucune claim scientifique autonome."
  ),

  annotated("frag.e5f2.00085985", [
    practice(
      "Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres lourds pour l'isolation, en particulier en fin d'amplitude.",
      {
        limitations: ["Retour subjectif rapporté par des coachs."],
        cannotConclude: [
          "Les câbles et machines produisent une activation ou une hypertrophie supérieure."
        ]
      }
    ),
    emg(
      "la sensation subjective peut se **dissocier** de l'activation EMG mesurée par région musculaire",
      {
        citations: ["cand.e5-citation.71402607369ba956"],
        epistemicStatus: "probable",
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "study_design_not_stated"
        }
      }
    ),
    claim(
      "la sensation perçue ne doit donc jamais être traitée comme une mesure fiable de l'activation réelle, encore moins de l'hypertrophie.",
      {
        domain: "exercise",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        citations: ["cand.e5-citation.71402607369ba956"],
        assessment: { directness: "emg_only", supportsHypertrophySuperiority: false },
        flags: ["emg_content"],
        cannotConclude: [
          "La sensation subjective mesure de façon fiable l'activation réelle ou l'hypertrophie."
        ]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00096243",
    "Instruction de métadonnées pour deux champs subjectifs ; contenu de gouvernance hors claims scientifiques E5."
  ),

  annotated("frag.e5f2.00025178", [
    anatomy(
      "Le **gastrocnémien** est **biarticulaire** (fléchisseur plantaire de cheville et fléchisseur de genou), tandis que le **soléaire** est **mono-articulaire** (fléchisseur plantaire de cheville uniquement).",
      {
        epistemicStatus: "established",
        citations: []
      }
    ),
    biomechanics(
      "la contribution relative du gastrocnémien et du soléaire au couple de flexion plantaire varie selon l'angle du genou, le gastrocnémien étant désavantagé mécaniquement (raccourci, donc moins capable de produire de la tension) lorsque le genou est fléchi, ce qui reporte la charge relative vers le soléaire",
      {
        epistemicStatus: "probable",
        citations: ["cand.e5-citation.f710dba38d921300"],
        assessment: {
          directness: "biomechanical_only",
          evidenceTypes: ["biomechanical_study"],
          supportsDemonstratedClinicalRisk: false
        },
        unresolvedAxes: {
          confidenceByAspect: "confidence_range_moderate_to_high"
        }
      }
    ),
    practice(
      "privilégier le mollet debout (genou tendu, gastrocnémien en position longue et fonctionnelle) pour le gastrocnémien et le mollet assis ou la presse à cuisses jambes fléchies (genou fléchi, gastrocnémien raccourci et mécaniquement désavantagé) pour isoler davantage le soléaire.",
      {
        citations: [],
        limitations: [
          "Extrapolation biomécanique plausible, pas preuve longitudinale directe."
        ]
      }
    ),
    evidence(
      "peu d'essais longitudinaux d'hypertrophie régionale du mollet comparant directement ces deux configurations d'angle de genou aient été identifiés dans cette recherche",
      {
        epistemicStatus: "absence_of_evidence",
        citations: [],
        flags: ["explicit_absence"],
        cannotConclude: [
          "La prescription est validée par une preuve longitudinale directe."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00033791", [
    biomechanics(
      "Les bandes élastiques ont une courbe de résistance croissante avec l'étirement (résistance minimale en position raccourcie, maximale en position étirée), l'inverse potentiel d'un poids libre dans certains mouvements.",
      {
        epistemicStatus: "established"
      }
    ),
    emg(
      "Une étude comparant l'activité musculaire lors d'exercices mono-articulaires du haut du corps avec bandes élastiques contre poids libres documente des différences d'activation liées à cette courbe de résistance spécifique",
      {
        citations: ["cand.e5-citation.8754ca02170001b9"],
        epistemicStatus: "uncertain",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["emg_study"],
          supportsHypertrophySuperiority: false,
          confidenceByAspect: [
            { aspect: "direction", confidence: "low" }
          ]
        },
        cannotConclude: [
          "Les différences d'activation établissent une hiérarchie d'efficacité hypertrophique."
        ]
      }
    )
  ]),

  zeroClaim(
    "frag.e5f2.00035721",
    "Phrase de transition annonçant les essais listés dans les fragments suivants, sans résultat autonome."
  ),

  annotated("frag.e5f2.00040144", [
    evidence(
      "Une revue systématique de référence sur l'effet de l'amplitude de mouvement sur le développement musculaire trouve un avantage généralement en faveur de l'amplitude complète par rapport à l'amplitude partielle, en particulier lorsque la partielle est réalisée en position **raccourcie** du muscle",
      {
        citations: ["cand.e5-citation.86007a6b5a3833e7"],
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_hypertrophy_measured",
          evidenceTypes: ["systematic_review"]
        },
        unresolvedAxes: { confidenceByAspect: "confidence_not_stated" }
      }
    ),
    hypothesis(
      "ce n'est pas l'amplitude en tant que telle mais la **position de longueur atteinte** qui semble déterminante.",
      {
        citations: [],
        cannotConclude: [
          "La position de longueur est démontrée comme l'unique déterminant de l'hypertrophie."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00049828", [
    biomechanics(
      "La charge au poignet varie fortement selon la prise (barre droite, barre EZ, haltères, poignées neutres) et l'exercice.",
      {
        unresolvedAxes: { epistemicStatus: "status_not_explicit" },
        flags: ["biomechanical_risk_language"]
      }
    ),
    biomechanics(
      "L'analyse biomécanique des exercices de développé montre des moments au poignet mesurables mais généralement inférieurs à ceux de l'épaule et du coude dans les mouvements étudiés",
      {
        epistemicStatus: "probable",
        citations: ["cand.e5-citation.914fa60e871f7618"],
        assessment: {
          directness: "biomechanical_only",
          evidenceTypes: ["biomechanical_study"],
          supportsDemonstratedClinicalRisk: false
        },
        flags: ["biomechanical_risk_language"]
      }
    ),
    evidence(
      "Une revue sur les blessures les plus courantes en musculation situe le poignet parmi les sites de blessure rapportés sans quantifier de mécanisme causal spécifique par exercice",
      {
        domain: "clinical",
        epistemicStatus: "uncertain",
        citations: ["cand.e5-citation.4912c85f39dfc76d"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "injury_report_directness_not_stated",
          evidenceTypes: "review_type_not_specific"
        },
        flags: ["clinical_content", "biomechanical_risk_language"],
        cannotConclude: [
          "Un exercice ou un mécanisme spécifique cause les blessures du poignet rapportées."
        ]
      }
    )
  ]),

  annotated("frag.f2.0022", [
    evidence(
      "Ces variantes polyarticulaires sollicitent l'ensemble du quadriceps de façon relativement homogène selon l'étude d'hypertrophie régionale du squat déjà citée",
      {
        citations: ["cand.e5-citation.47bb4d2d4f9c68ae"],
        epistemicStatus: "probable",
        assessment: { directness: "direct_hypertrophy_measured" },
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "study_design_not_stated"
        }
      }
    ),
    evidence(
      "le vaste latéral montrant l'association la plus forte avec le gain de force.",
      {
        citations: ["cand.e5-citation.47bb4d2d4f9c68ae"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "association_directness_not_available_in_closed_vocabulary",
          evidenceTypes: "study_design_not_stated"
        },
        cannotConclude: [
          "L'hypertrophie du vaste latéral cause le gain de force."
        ]
      }
    ),
    emg(
      "Une comparaison EMG et de perception d'effort entre leg press et Smith machine squat documente des profils d'activation du quadriceps globalement similaires entre ces deux modalités guidées",
      {
        citations: ["cand.e5-citation.ba3ee2b6d8ba70be"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "study_design_not_stated"
        },
        cannotConclude: [
          "Les deux modalités produisent une hypertrophie équivalente."
        ]
      }
    ),
    evidence(
      "Une étude testant si le squat classique produit une hypertrophie régionale différenciée entre les chefs du quadriceps ne trouve pas de différence significative entre eux dans son échantillon",
      {
        citations: ["cand.e5-citation.7bbb1bafbd944e3a"],
        epistemicStatus: "uncertain",
        assessment: { directness: "direct_hypertrophy_measured" },
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "study_design_not_stated"
        },
        cannotConclude: [
          "Tous les chefs du quadriceps hypertrophient de façon équivalente dans toute population."
        ]
      }
    )
  ]),

  annotated("frag.f2.0010", [
    claim(
      "Deux exercices sollicitant le même pattern de mouvement, la même fonction musculaire principale, une longueur musculaire dominante comparable, et ne différant principalement que par le profil de résistance ou le niveau de stabilité.",
      {
        domain: "exercise",
        knowledgeType: "DEFINITION",
        epistemicStatus: "practice_only",
        flags: ["modeling_content"]
      }
    ),
    practice(
      "La méta-analyse de la section 2.5 (pas de différence d'hypertrophie poids libres/machines) et celle de la section 7.6 (pas de différence unilatéral/bilatéral) fournissent une base de preuve directe pour qualifier ce type de paires de « quasi directes » sur le plan de l'hypertrophie, même si la spécificité de force diffère.",
      {
        citations: [],
        limitations: [
          "Les preuves citées sont des renvois internes et la spécificité de force diffère."
        ],
        cannotConclude: [
          "Ces exercices sont interchangeables pour la force spécifique."
        ]
      }
    )
  ]),

  annotated("frag.e5f2.00085638", [
    practice(
      "les exercices sur machine ou guidés (Smith machine, presse) sont souvent préférés pour le suivi longitudinal de la charge car ils réduisent la variabilité de trajectoire d'une séance à l'autre par rapport aux poids libres",
      {
        limitations: ["Plausible mécaniquement et non quantifié."],
        cannotConclude: [
          "Les exercices guidés mesurent toujours mieux la progression ou produisent de meilleurs résultats."
        ]
      }
    )
  ])
];
