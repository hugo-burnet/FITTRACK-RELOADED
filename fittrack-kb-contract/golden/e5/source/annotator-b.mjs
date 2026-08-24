import {
  annotated,
  claim,
  needsAdjudication,
  zeroClaim
} from "./spec-helpers.mjs";

const annotations = [
  annotated("frag.f2.0001", [
    claim(
      "une différence d'amplitude EMG entre deux exercices n'est jamais traitée comme une preuve suffisante qu'un exercice produit plus d'hypertrophie qu'un autre.",
      {
        domain: "biomechanics",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        citations: [],
        cannotConclude: [
          "qu'un exercice produit plus d'hypertrophie qu'un autre"
        ],
        flags: ["emg_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "general_rule_not_a_single_study_outcome",
          evidenceTypes: "citation_is_illustrative_not_a_document_type_for_the_general_rule"
        }
      }
    ),
    claim(
      "l'EMG du hip thrust dépasse largement celle du squat pour le grand fessier (moyenne 69,5 % contre 29,4 % de la contraction volontaire maximale, pics 172 % contre 84,9 %)",
      {
        domain: "biomechanics",
        knowledgeType: "EMG_OBSERVATION",
        assessment: {
          directness: "emg_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.ed7e5bec1319486d"],
        cannotConclude: [
          "qu'un exercice produit plus d'hypertrophie qu'un autre"
        ],
        flags: ["emg_content"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "neuf semaines d'entraînement à volume égalisé produisent une hypertrophie fessière quasiment identique en IRM dans les trois régions du grand fessier",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        assessment: {
          directness: "direct_hypertrophy_measured",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.ed7e5bec1319486d"],
        cannotConclude: [
          "une équivalence universelle entre hip thrust et squat"
        ],
        flags: ["emg_content"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "sans corrélation fiable entre l'amplitude EMG et la croissance mesurée",
      {
        domain: "biomechanics",
        knowledgeType: "EVIDENCE",
        assessment: {
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.ed7e5bec1319486d"],
        cannotConclude: [
          "que l'EMG ne prédit jamais l'hypertrophie"
        ],
        flags: ["emg_content"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "outcome_combines_emg_and_growth_measurement",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    )
  ]),

  needsAdjudication(
    "frag.f2.0003",
    [
      claim(
        "qui étire le chef long au niveau de l'épaule pendant l'exercice",
        {
          domain: "biomechanics",
          knowledgeType: "BIOMECHANICAL_OBSERVATION",
          assessment: {
            directness: "biomechanical_only",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.c26ca4cf801ca5ab"],
          citationAttributionState: "UNRESOLVED",
          cannotConclude: [],
          flags: ["ambiguous_citation"],
          unresolvedAxes: {
            epistemicStatus: "status_not_explicit",
            confidenceByAspect: "confidence_range_applies_to_regional_hypertrophy_not_this_mechanism",
            evidenceTypes: "controlled_trial_does_not_map_to_closed_evidence_type"
          }
        }
      ),
      claim(
        "l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épaule pendant l'exercice, produit une hypertrophie substantiellement plus importante du chef long que le même exercice réalisé bras le long du corps (position neutre), à volume et effort égalisés sur plusieurs semaines",
        {
          domain: "exercise",
          knowledgeType: "EVIDENCE",
          epistemicStatus: "probable",
          assessment: {
            directness: "direct_hypertrophy_measured",
            supportsHypertrophySuperiority: true,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.c26ca4cf801ca5ab"],
          cannotConclude: [
            "que tout exercice overhead est supérieur pour tout le triceps"
          ],
          limitations: ["essai contrôlé unique"],
          unresolvedAxes: {
            confidenceByAspect: "moderate_to_high_range_not_scalar",
            evidenceTypes: "controlled_trial_does_not_establish_randomization"
          }
        }
      ),
      claim(
        "les extensions au-dessus de la tête (overhead extension, skull crusher incliné bras verticaux) ciblent préférentiellement le chef long",
        {
          domain: "exercise",
          knowledgeType: "EXPERT_PRACTICE",
          epistemicStatus: "practice_only",
          assessment: {
            directness: "expert_only",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.c26ca4cf801ca5ab"],
          citationAttributionState: "UNRESOLVED",
          cannotConclude: [],
          flags: ["ambiguous_citation", "expert_practice"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "practice_interpretation_has_no_explicit_document_type"
          }
        }
      ),
      claim(
        "les pushdowns et extensions bras le long du corps sollicitent davantage les chefs latéral et médial sans étirement supplémentaire du chef long.",
        {
          domain: "exercise",
          citations: [],
          cannotConclude: [
            "que les pushdowns n'hypertrophient pas le chef long"
          ],
          ambiguities: [
            "Le verbe « sollicitent » ne précise ni activation EMG, ni tension, ni hypertrophie."
          ],
          unresolvedAxes: {
            knowledgeType: "sollicitent_outcome_ambiguous",
            epistemicStatus: "status_not_explicit",
            confidenceByAspect: "confidence_not_stated",
            directness: "outcome_not_identified",
            evidenceTypes: "document_type_not_explicit"
          }
        }
      )
    ],
    [
      "La citation terminale soutient clairement le résultat hypertrophique, mais son rattachement au mécanisme et à la conséquence pratique reste ambigu.",
      "Le verbe « sollicitent » ne permet pas de résoudre le type de connaissance de la dernière proposition."
    ]
  ),

  annotated("frag.f2.0004", [
    claim(
      "**chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en poids libres ; tendance en faveur des machines pour les tests sur machines, p = 0,064)",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          evidenceTypes: ["meta_analysis"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.02cf57ff924cbbd8"],
        cannotConclude: ["que les machines sont meilleures pour la force"],
        unresolvedAxes: {
          confidenceByAspect: "reported_confidence_applies_to_hypertrophy",
          directness: "closed_directness_vocabulary_has_no_strength_specific_value"
        }
      }
    ),
    claim(
      "**mais aucune différence significative d'hypertrophie entre les deux modalités** (SMD −0,055, IC95 % −0,397 à 0,287, p = 0,751), sur des interventions de 9 semaines en moyenne",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "direct_hypertrophy_measured",
          evidenceTypes: ["meta_analysis"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.02cf57ff924cbbd8"],
        cannotConclude: [
          "que poids libres et machines sont équivalents pour l'hypertrophie"
        ],
        limitations: [
          "nombre limité d'études d'hypertrophie disponibles"
        ],
        unresolvedAxes: {
          confidenceByAspect: "moderate_to_high_range_not_scalar"
        }
      }
    ),
    claim(
      "le choix entre poids libres et machines pour l'hypertrophie devrait reposer sur la stabilité, le confort, la disponibilité et la préférence individuelle plutôt que sur une supposée supériorité universelle d'une modalité.",
      {
        domain: "exercise",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: [],
        flags: ["expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "practice_interpretation_not_explicitly_sourced"
        }
      }
    )
  ]),

  annotated("frag.f2.0008", [
    claim(
      "Peu d'études biomécaniques dédiées quantifient directement la charge au coude pendant les exercices de triceps (skull crusher, extension overhead) en musculation récréative",
      {
        domain: "biomechanics",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "absence_of_evidence",
        citations: [],
        cannotConclude: [
          "que le skull crusher impose une charge élevée mesurée au coude"
        ],
        flags: ["explicit_absence", "biomechanical_risk_language"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated_for_absence_claim",
          directness: "absence_claim_has_no_direct_measurement",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "la littérature disponible sur la charge au coude provient principalement du contexte du lancer au baseball, peu généralisable",
      {
        domain: "biomechanics",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "indirect_clinical",
          confidenceByAspect: [
            { aspect: "generalization", confidence: "very_low" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c606a5fa04358b7b"],
        cannotConclude: [
          "que les données de baseball s'appliquent aux pratiquants de musculation"
        ],
        flags: ["biomechanical_risk_language"],
        unresolvedAxes: {
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "l'affirmation courante selon laquelle le skull crusher ou l'extension overhead imposerait une contrainte particulière au coude repose largement sur un raisonnement biomécanique de premier principe (moment de flexion élevé en bras de levier long) plutôt que sur une mesure directe publiée en contexte de musculation",
      {
        domain: "biomechanics",
        knowledgeType: "HYPOTHESIS",
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "mechanistic_hypothesis",
          confidenceByAspect: [
            { aspect: "direction", confidence: "very_low" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["que le skull crusher est dangereux pour le coude"],
        limitations: ["plutôt que sur une mesure directe publiée en contexte de musculation"],
        flags: ["biomechanical_risk_language", "explicit_absence"],
        unresolvedAxes: {
          evidenceTypes: "no_direct_document_type_supports_the_hypothesis"
        }
      }
    )
  ]),

  annotated("frag.e5f2.00083542", [
    claim(
      "Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *evidence-based* documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "qualitative_survey",
          evidenceTypes: ["qualitative_study"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.13c064ac2a25902d"],
        cannotConclude: [
          "que les pratiques des coachs causent de meilleurs résultats"
        ],
        limitations: ["niveau très faible pour toute affirmation causale"],
        unresolvedAxes: {
          confidenceByAspect: "very_low_only_applies_to_causal_not_descriptive_claims"
        }
      }
    ),
    claim(
      "avec des domaines où l'expérience pratique dépasse ou diverge de la littérature disponible",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "qualitative_survey",
          evidenceTypes: ["qualitative_study"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.13c064ac2a25902d"],
        cannotConclude: ["que les recommandations suivantes sont validées"],
        limitations: ["niveau très faible pour toute affirmation causale"],
        unresolvedAxes: {
          confidenceByAspect: "very_low_only_applies_to_causal_not_descriptive_claims"
        }
      }
    )
  ]),

  needsAdjudication(
    "frag.e5f2.00026956",
    [
      claim("Le grand droit de l'abdomen réalise la **flexion du tronc**", {
        domain: "anatomy",
        knowledgeType: "ANATOMICAL_FACT",
        citations: ["cand.e5-citation.2a28c5f0b581556c"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: [],
        flags: ["ambiguous_citation"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "architectural_citation_scope_unclear",
          evidenceTypes: "architectural_analysis_not_a_closed_document_type"
        }
      }),
      claim("les obliques externes et internes réalisent la **flexion latérale**", {
        domain: "anatomy",
        knowledgeType: "ANATOMICAL_FACT",
        citations: ["cand.e5-citation.2a28c5f0b581556c"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: [],
        flags: ["ambiguous_citation"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "architectural_citation_scope_unclear",
          evidenceTypes: "architectural_analysis_not_a_closed_document_type"
        }
      }),
      claim("les obliques externes et internes réalisent la **flexion latérale** et la **rotation du tronc**", {
        canonicalStatement: "Les obliques externes et internes réalisent la rotation du tronc.",
        domain: "anatomy",
        knowledgeType: "ANATOMICAL_FACT",
        citations: ["cand.e5-citation.2a28c5f0b581556c"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: [],
        flags: ["ambiguous_citation"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "architectural_citation_scope_unclear",
          evidenceTypes: "architectural_analysis_not_a_closed_document_type"
        }
      }),
      claim("le transverse de l'abdomen agit principalement comme stabilisateur de la pression intra-abdominale plutôt que comme moteur de mouvement.", {
        domain: "anatomy",
        knowledgeType: "ANATOMICAL_FACT",
        citations: ["cand.e5-citation.2a28c5f0b581556c"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: [],
        flags: ["ambiguous_citation"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          directness: "architectural_citation_scope_unclear",
          evidenceTypes: "architectural_analysis_not_a_closed_document_type"
        }
      }),
      claim("une étude EMG montre une activité différentielle des régions du transverse de l'abdomen pendant la rotation du tronc", {
        domain: "biomechanics",
        knowledgeType: "EMG_OBSERVATION",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["emg_study"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.f036e4fac1fa698e"],
        cannotConclude: ["une hypertrophie régionale correspondante"],
        flags: ["emg_content"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated"
        }
      })
    ],
    [
      "La première citation termine une phrase générale sur l'architecture et ne mappe pas explicitement chacune des actions anatomiques.",
      "Flexion latérale et rotation pourraient être représentées comme deux outcomes atomiques, mais le second span réutilise nécessairement la proposition coordonnée complète."
    ]
  ),

  annotated("frag.e5f2.00028637", [
    claim(
      "La difficulté ressentie à un instant donné du mouvement dépend du rapport entre le **moment de force externe** (produit par la charge et son bras de levier par rapport à l'articulation) et le **moment de force interne** (produit par le muscle et son bras de levier anatomique, qui varie lui-même avec l'angle articulaire).",
      {
        domain: "biomechanics",
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "established",
        assessment: {
          directness: "biomechanical_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: [],
        flags: ["modeling_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "Une cartographie tridimensionnelle continue des bras de levier de l'épaule montre que ces bras de levier internes varient de façon non linéaire et parfois importante sur l'amplitude de mouvement",
      {
        domain: "biomechanics",
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "established",
        assessment: {
          directness: "biomechanical_only",
          confidenceByAspect: [
            { aspect: "descriptive_accuracy", confidence: "high" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.08f1787eb97af7ab"],
        cannotConclude: [],
        unresolvedAxes: {
          evidenceTypes: "cartography_document_type_not_explicit"
        }
      }
    ),
    claim(
      "généralisable par analogie anatomique à d'autres articulations, même si des cartographies aussi détaillées n'existent pas pour chaque articulation.",
      {
        domain: "biomechanics",
        knowledgeType: "HYPOTHESIS",
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "mechanistic_hypothesis",
          confidenceByAspect: [
            { aspect: "generalization", confidence: "very_low" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: [],
        limitations: [
          "des cartographies aussi détaillées n'existent pas pour chaque articulation"
        ],
        flags: ["explicit_absence"],
        unresolvedAxes: {
          evidenceTypes: "analogy_has_no_explicit_document_type"
        }
      }
    )
  ]),

  needsAdjudication(
    "frag.e5f2.00034666",
    [
      claim(
        "l'hypothèse que l'entraînement réalisé lorsque le muscle est en **position étirée/allongée** produit un stimulus hypertrophique supérieur ou complémentaire à l'entraînement en position raccourcie, à volume et effort égalisés.",
        {
          domain: "exercise",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["une supériorité quantitative directe chez l'humain entraîné"],
          flags: ["modeling_content"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated_for_hypothesis",
            evidenceTypes: "no_document_type_attached_to_this_sentence"
          }
        }
      ),
      claim(
        "Une revue narrative détaille les mécanismes proposés de l'hypertrophie médiée par l'étirement, notamment l'activation de voies de signalisation anabolique (Akt/mTOR) par la tension mécanique passive et active à grande longueur",
        {
          domain: "biomechanics",
          knowledgeType: "MECHANISM",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            evidenceTypes: ["narrative_review"],
            confidenceByAspect: [
              { aspect: "generalization", confidence: "low" }
            ],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.d2cea0ce1a8a2a0f"],
          cannotConclude: ["une application quantitative directe chez l'humain entraîné"],
          limitations: [
            "niveau faible pour une application quantitative directe chez l'humain entraîné"
          ]
        }
      ),
      claim(
        "la sarcomérogenèse en série observée dans des modèles animaux",
        {
          domain: "biomechanics",
          knowledgeType: "MECHANISM",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "animal_model",
            evidenceTypes: ["narrative_review"],
            confidenceByAspect: [
              { aspect: "generalization", confidence: "low" }
            ],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.d2cea0ce1a8a2a0f"],
          cannotConclude: ["une application quantitative directe chez l'humain entraîné"],
          limitations: ["translationnelle depuis des modèles animaux"]
        }
      ),
      claim(
        "le principe qualitatif (tension à grande longueur = stimulus important) soit cohérent avec plusieurs essais humains cités ci-dessous.",
        {
          domain: "biomechanics",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["une application quantitative directe chez l'humain entraîné"],
          ambiguities: [
            "Les essais humains annoncés sont hors du fragment cible et ne peuvent pas être utilisés comme citations."
          ],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated_for_qualitative_principle",
            evidenceTypes: "supporting_human_trials_are_outside_fragment"
          }
        }
      )
    ],
    [
      "La dernière proposition renvoie à des essais hors fragment et reste une hypothèse en monde fermé.",
      "La confiance faible porte sur l'application quantitative humaine, non sur chaque mécanisme descriptif."
    ]
  ),

  annotated("frag.f2.0021", [
    claim(
      "Un essai randomisé intra-sujet chez des sujets entraînés compare directement des répétitions partielles en position allongée à des répétitions en amplitude complète et trouve des adaptations musculaires similaires entre les deux conditions",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_hypertrophy_measured",
          evidenceTypes: ["randomized_trial", "within_participant_trial"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.424e50e70e773a55"],
        cannotConclude: ["une équivalence pour tous les muscles et exercices"],
        limitations: [
          "échantillon limité, muscles et exercices spécifiques du haut du corps"
        ]
      }
    ),
    claim(
      "Une méta-analyse et revue systématique comparant amplitude partielle et complète de façon plus large confirme l'absence de supériorité générale de l'amplitude complète lorsque la partielle est réalisée à grande longueur",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          evidenceTypes: ["meta_analysis", "systematic_review"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.40b2fe19ffc586b3"],
        cannotConclude: ["une équivalence universelle entre amplitude partielle et complète"],
        limitations: ["l'hétérogénéité des protocoles inclus"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated_for_meta_analysis",
          directness: "measured_outcomes_not_named_in_this_sentence"
        }
      }
    )
  ]),

  needsAdjudication(
    "frag.e5f2.00044614",
    [
      claim(
        "une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série",
        {
          domain: "biomechanics",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: [
            "qu'une stabilité maximale (machine guidée) est toujours supérieure à un poids libre pour l'hypertrophie"
          ],
          flags: ["modeling_content"],
          unresolvedAxes: {
            confidenceByAspect: "low_to_moderate_range_not_scalar",
            evidenceTypes: "document_type_not_stated"
          }
        }
      ),
      claim(
        "Une instabilité excessive peut réduire la charge utilisable et détourner l'effort vers des muscles stabilisateurs non ciblés.",
        {
          domain: "biomechanics",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: [],
          unresolvedAxes: {
            confidenceByAspect: "low_to_moderate_range_not_scalar",
            evidenceTypes: "document_type_not_stated"
          }
        }
      ),
      claim(
        "qu'une stabilité maximale (machine guidée) est toujours supérieure à un poids libre pour l'hypertrophie",
        {
          domain: "exercise",
          knowledgeType: "MYTH_REFUTATION",
          epistemicStatus: "refuted",
          assessment: {
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: [
            "qu'une stabilité maximale (machine guidée) est toujours supérieure à un poids libre pour l'hypertrophie"
          ],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated",
            directness: "support_is_an_internal_cross_section_reference",
            evidenceTypes: "meta_analysis_is_named_but_not_cited_in_target_fragment"
          }
        }
      ),
      claim(
        "la méta-analyse de la section 2.5 ne trouve pas de différence d'hypertrophie entre poids libres et machines malgré des différences évidentes de demande de stabilisation.",
        {
          domain: "exercise",
          knowledgeType: "EVIDENCE",
          epistemicStatus: "uncertain",
          assessment: {
            directness: "direct_hypertrophy_measured",
            evidenceTypes: ["meta_analysis"],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["une équivalence universelle entre poids libres et machines"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated_for_cross_section_summary"
          }
        }
      ),
      claim(
        "La stabilité est donc un paramètre qui influence la *technique et la charge utilisable*, pas un déterminant direct et indépendant démontré de l'hypertrophie.",
        {
          domain: "biomechanics",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["un déterminant direct et indépendant démontré de l'hypertrophie"],
          unresolvedAxes: {
            confidenceByAspect: "low_to_moderate_range_not_scalar",
            evidenceTypes: "document_type_not_stated"
          }
        }
      )
    ],
    [
      "Le fragment qualifie globalement le passage comme mécanistique/pratique sans mapper séparément chaque proposition.",
      "La méta-analyse est un renvoi interne sans occurrence de citation P0 dans le fragment cible."
    ]
  ),

  needsAdjudication(
    "frag.f2.0023",
    [
      claim(
        "Le développé militaire (overhead press) et les élévations latérales sollicitent fortement le complexe de la coiffe des rotateurs à des amplitudes d'abduction élevées",
        {
          domain: "biomechanics",
          knowledgeType: "BIOMECHANICAL_OBSERVATION",
          assessment: {
            directness: "biomechanical_only",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["un danger clinique démontré en musculation récréative"],
          flags: ["biomechanical_risk_language"],
          unresolvedAxes: {
            epistemicStatus: "sollicitent_measure_not_named",
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "document_type_not_stated"
          }
        }
      ),
      claim(
        "un risque supposé (et non démontré de façon causale en musculation récréative) de conflit sous-acromial par analogie avec la littérature sur les athlètes de sports de lancer",
        {
          domain: "clinical",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            confidenceByAspect: [
              { aspect: "generalization", confidence: "very_low" }
            ],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [
            "cand.e5-citation.3a033ed6c17d5188",
            "cand.e5-citation.387bef6af9d96c23"
          ],
          citationAttributionState: "UNRESOLVED",
          cannotConclude: ["un risque causal démontré en musculation récréative"],
          flags: ["ambiguous_citation", "biomechanical_risk_language", "clinical_content"],
          unresolvedAxes: {
            evidenceTypes: "one_citation_says_systematic_review_but_group_mapping_is_ambiguous"
          }
        }
      ),
      claim(
        "Ces données proviennent de populations d'athlètes de lancer à charges répétitives à haute vitesse, pas de pratiquants de musculation",
        {
          domain: "clinical",
          knowledgeType: "EVIDENCE",
          epistemicStatus: "uncertain",
          assessment: {
            directness: "indirect_clinical",
            confidenceByAspect: [
              { aspect: "generalization", confidence: "very_low" }
            ],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [
            "cand.e5-citation.3a033ed6c17d5188",
            "cand.e5-citation.387bef6af9d96c23"
          ],
          citationAttributionState: "UNRESOLVED",
          cannotConclude: ["une généralisation à l'overhead press en musculation"],
          flags: ["ambiguous_citation", "clinical_content"],
          unresolvedAxes: {
            evidenceTypes: "document_types_not_clear_for_both_grouped_citations"
          }
        }
      ),
      claim(
        "leur généralisation à l'overhead press en musculation constitue un **risque supposé par analogie, niveau de preuve très faible pour cette population spécifique**.",
        {
          domain: "clinical",
          knowledgeType: "HYPOTHESIS",
          epistemicStatus: "mechanistic_only",
          assessment: {
            directness: "mechanistic_hypothesis",
            confidenceByAspect: [
              { aspect: "generalization", confidence: "very_low" }
            ],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["un risque clinique démontré"],
          flags: ["biomechanical_risk_language", "clinical_content"],
          unresolvedAxes: {
            evidenceTypes: "analogy_has_no_direct_document_type"
          }
        }
      )
    ],
    [
      "Les deux citations sont groupées et leur contribution individuelle aux propositions de risque et de population n'est pas explicitée.",
      "Le verbe « sollicitent » ne nomme pas la mesure biomécanique sous-jacente."
    ]
  ),

  annotated("frag.f2.0005", [
    claim(
      "La stabilité requise par un exercice — support du torse, base d'appui, guidage de la trajectoire par une machine ou un rail — détermine dans quelle mesure l'effort du pratiquant doit être partagé entre la production de force du muscle cible et la stabilisation posturale/articulaire.",
      {
        domain: "biomechanics",
        knowledgeType: "HYPOTHESIS",
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: [],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_stated"
        }
      }
    ),
    claim(
      "les surfaces instables augmentent l'activation des muscles stabilisateurs du tronc",
      {
        domain: "biomechanics",
        knowledgeType: "EMG_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["systematic_review", "meta_analysis", "emg_study"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c912c0efbdc07ea5"],
        cannotConclude: ["une hypertrophie supérieure des stabilisateurs"],
        flags: ["emg_content"]
      }
    ),
    claim(
      "diminuent généralement l'activation du muscle agoniste principal",
      {
        domain: "biomechanics",
        knowledgeType: "EMG_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["systematic_review", "meta_analysis", "emg_study"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c912c0efbdc07ea5"],
        cannotConclude: ["une hypertrophie inférieure du muscle agoniste"],
        flags: ["emg_content"]
      }
    ),
    claim(
      "la force produite, comparé à un exercice équivalent sur surface stable",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          evidenceTypes: ["systematic_review", "meta_analysis"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c912c0efbdc07ea5"],
        cannotConclude: [],
        unresolvedAxes: {
          directness: "closed_directness_vocabulary_has_no_performance_specific_value"
        }
      }
    ),
    claim(
      "l'instabilité redistribue l'effort plutôt que de l'augmenter globalement pour le muscle cible.",
      {
        domain: "biomechanics",
        knowledgeType: "HYPOTHESIS",
        epistemicStatus: "mechanistic_only",
        assessment: {
          directness: "mechanistic_hypothesis",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: [],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated_for_interpretation",
          evidenceTypes: "interpretation_not_a_document_type"
        }
      }
    )
  ]),

  annotated("frag.f2.0007", [
    claim(
      "Une analyse biomécanique dédiée aux exercices de développé (chest exercises) quantifie les moments articulaires à l'épaule, au coude et au poignet et trouve que les exercices de poulie (cable crossover) imposent des moments maximaux à l'épaule significativement plus élevés que les variantes de développé couché",
      {
        domain: "biomechanics",
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "biomechanical_only",
          evidenceTypes: ["biomechanical_study"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.a286511957b56850"],
        cannotConclude: ["un danger clinique"],
        flags: ["biomechanical_risk_language"]
      }
    )
  ]),

  annotated("frag.e5f2.00072017", [
    claim(
      "La position de hanche diffère entre ces deux variantes (hanche fléchie en position assise, hanche en extension relative en position couchée sur le ventre), ce qui modifie la longueur des ischio-jambiers biarticulaires au début du mouvement.",
      {
        domain: "biomechanics",
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        assessment: {
          directness: "biomechanical_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["une hypertrophie régionale supérieure"],
        unresolvedAxes: {
          epistemicStatus: "status_not_explicit",
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_stated"
        }
      }
    ),
    claim(
      "la sensation perçue ne coïncide pas nécessairement avec l'activation mesurée par région",
      {
        domain: "biomechanics",
        knowledgeType: "EMG_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["emg_study"],
          confidenceByAspect: [
            { aspect: "direction", confidence: "moderate" }
          ],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.ffdc005a36bf405b"],
        cannotConclude: ["une hypertrophie régionale correspondante"],
        flags: ["emg_content"]
      }
    ),
    claim(
      "l'EMG ne prouve pas l'hypertrophie régionale correspondante.",
      {
        domain: "biomechanics",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          directness: "emg_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["une hypertrophie régionale correspondante"],
        flags: ["emg_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated_for_general_guardrail",
          evidenceTypes: "guardrail_not_a_document_type"
        }
      }
    )
  ]),

  annotated("frag.f2.0022", [
    claim(
      "Ces variantes polyarticulaires sollicitent l'ensemble du quadriceps de façon relativement homogène selon l'étude d'hypertrophie régionale du squat déjà citée",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_hypertrophy_measured",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.47bb4d2d4f9c68ae"],
        cannotConclude: ["une équivalence exacte entre toutes les variantes"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "le vaste latéral montrant l'association la plus forte avec le gain de force.",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        citations: ["cand.e5-citation.47bb4d2d4f9c68ae"],
        cannotConclude: ["une relation causale"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "association_measure_not_mapped_to_closed_directness",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim(
      "Une comparaison EMG et de perception d'effort entre leg press et Smith machine squat documente des profils d'activation du quadriceps globalement similaires entre ces deux modalités guidées",
      {
        domain: "biomechanics",
        knowledgeType: "EMG_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "emg_only",
          evidenceTypes: ["emg_study"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.ba3ee2b6d8ba70be"],
        cannotConclude: ["une équivalence hypertrophique"],
        flags: ["emg_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated"
        }
      }
    ),
    claim(
      "Une étude testant si le squat classique produit une hypertrophie régionale différenciée entre les chefs du quadriceps ne trouve pas de différence significative entre eux dans son échantillon",
      {
        domain: "exercise",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "direct_hypertrophy_measured",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.7bbb1bafbd944e3a"],
        cannotConclude: ["une équivalence entre les chefs du quadriceps"],
        limitations: ["dans son échantillon"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    )
  ]),

  needsAdjudication(
    "frag.f3.0001",
    [
      claim("« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».", {
        domain: "clinical",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["que la douleur pendant l'exercice est sans danger"],
        flags: ["ambiguous_citation", "clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "general_myth_scope_not_identical_to_study_population",
          evidenceTypes: "document_type_not_explicit"
        }
      }),
      claim("Des exercices tolérablement douloureux peuvent produire des résultats comparables", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        cannotConclude: ["une obligation d'avoir mal"],
        flags: ["clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }),
      claim("un petit avantage antalgique à court terme dans certaines douleurs chroniques, sans supériorité durable démontrée", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "direct_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        cannotConclude: ["une supériorité durable"],
        flags: ["clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }),
      claim("ce n’est ni une obligation d’avoir mal ni une permission d’ignorer une aggravation", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.c1f9eef136b9ebeb"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: [],
        flags: ["ambiguous_citation", "clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "practice_guardrail_not_an_explicit_document_type"
        }
      })
    ],
    [
      "La citation terminale soutient clairement les résultats cliniques, mais sa portée sur le mythe général et le garde-fou pratique reste ambiguë."
    ]
  ),

  annotated("frag.f3.0002", [
    claim(
      "Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base le lendemain",
      {
        domain: "clinical",
        knowledgeType: "DEFINITION",
        epistemicStatus: "established",
        assessment: {
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.1c793d3b304a122b"],
        cannotConclude: ["que 5/10 est sûr pour toute douleur ou toute pathologie"],
        flags: ["clinical_content", "numeric_threshold"],
        unresolvedAxes: {
          confidenceByAspect: "protocol_definition_not_a_confidence_claim",
          directness: "protocol_description_not_an_outcome",
          evidenceTypes: "trial_type_not_explicit"
        }
      }
    ),
    claim(
      "il s’agit d’un protocole de recherche, non d’une règle pour toute douleur ou toute pathologie",
      {
        domain: "clinical",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.1c793d3b304a122b"],
        cannotConclude: ["une règle pour toute douleur ou toute pathologie"],
        flags: ["clinical_content", "numeric_threshold"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "non_universality_is_a_scope_guardrail",
          evidenceTypes: "trial_type_not_explicit"
        }
      }
    )
  ]),

  annotated("frag.f3.0007", [
    claim("un red flag n’est pas un diagnostic.", {
      domain: "clinical",
      knowledgeType: "DEFINITION",
      epistemicStatus: "established",
      citations: [],
      cannotConclude: ["un diagnostic"],
      flags: ["clinical_content", "red_flag_content"],
      unresolvedAxes: {
        confidenceByAspect: "definition_not_graded",
        directness: "definition_not_an_outcome",
        evidenceTypes: "document_type_not_explicit"
      }
    }),
    claim("Les signaux isolés ont souvent une faible précision", {
      domain: "clinical",
      knowledgeType: "EVIDENCE",
      epistemicStatus: "probable",
      assessment: {
        directness: "direct_clinical",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.3983536a53df6cdb"],
      cannotConclude: ["qu'un signal isolé diagnostique une pathologie"],
      flags: ["clinical_content", "red_flag_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "document_type_not_explicit"
      }
    }),
    claim("la combinaison, le contexte et l’évolution déterminent le niveau de suspicion", {
      domain: "clinical",
      knowledgeType: "EVIDENCE",
      epistemicStatus: "probable",
      assessment: {
        directness: "direct_clinical",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.3983536a53df6cdb"],
      cannotConclude: ["un diagnostic"],
      flags: ["clinical_content", "red_flag_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "document_type_not_explicit"
      }
    })
  ], {
    annotationNotes: "La phrase prescrivant ce que l'IA doit dire est du contenu de politique de sortie et n'est pas une claim scientifique."
  }),

  needsAdjudication(
    "frag.e5f3.00012613",
    [
      claim("**gestion de la charge suivie d’une exposition progressive**, et non le repos complet.", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["que le repos est toujours nocif"],
        flags: ["clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "introductory_synthesis_not_explicitly_sourced"
        }
      }),
      claim("Pour le tendon d’Achille de portion moyenne, l’APTA recommande une charge tendineuse aussi élevée que tolérée au moins trois fois par semaine et déconseille le repos complet", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: {
          directness: "direct_clinical",
          evidenceTypes: ["clinical_practice_guideline"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.0a09e6efb74343fb"],
        cannotConclude: ["trois séances par semaine comme seuil universel pour tous les tendons"],
        flags: ["clinical_content", "numeric_threshold"] ,
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated"
        }
      }),
      claim("Aucun mode unique — excentrique, heavy slow resistance (HSR), concentrique ou isométrique — n’est universellement supérieur", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "uncertain",
        assessment: {
          directness: "direct_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [
          "cand.e5-citation.cc503ab0bba6f4c3",
          "cand.e5-citation.dd480d6d3ce15a6d"
        ],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["une équivalence universelle entre les modes"],
        flags: ["ambiguous_citation", "clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_types_not_explicit_for_grouped_citations"
        }
      }),
      claim("les isométriques n’offrent pas une analgésie immédiate fiable chez tous", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [
          "cand.e5-citation.cc503ab0bba6f4c3",
          "cand.e5-citation.dd480d6d3ce15a6d"
        ],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["que les isométriques ne soulagent jamais"],
        flags: ["ambiguous_citation", "clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_types_not_explicit_for_grouped_citations"
        }
      })
    ],
    [
      "Les citations Maetz et Clifford forment un groupe terminal sans mapping individuel explicite aux deux outcomes."
    ]
  ),

  annotated("frag.e5f3.00014985", [
    claim(
      "La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de dommage.",
      {
        domain: "clinical",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          directness: "biomechanical_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["un seuil clinique de dommage"],
        flags: ["biomechanical_risk_language", "clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "general_guardrail_not_explicitly_sourced"
        }
      }
    ),
    claim(
      "Une revue ne trouve pas de preuve in vivo crédible que davantage de flexion lombaire pendant le soulèvement soit un facteur de risque de lombalgie",
      {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "absence_of_evidence",
        assessment: {
          directness: "indirect_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.97d5e335856e2df6"],
        cannotConclude: ["que la flexion lombaire ne présente aucun risque"],
        limitations: [
          "les charges étudiées étaient toutefois souvent légères",
          "les données surtout transversales"
        ],
        flags: ["biomechanical_risk_language", "clinical_content", "explicit_absence"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "review_type_not_explicit"
        }
      }
    )
  ]),

  annotated("frag.e5f3.00025760", [
    claim(
      "Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge",
      {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.1b8b3f44f6dd20d6"],
        cannotConclude: ["que l'orthèse remplace la progression de charge"],
        flags: ["clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated"
        }
      }
    ),
    claim(
      "un consensus de physiothérapeutes a retenu éducation, pacing, exercice progressif et orthèse",
      {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.1b8b3f44f6dd20d6"],
        cannotConclude: ["une hiérarchie d'efficacité entre ces options"],
        flags: ["clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated"
        }
      }
    ),
    claim(
      "douleur définie par l’acceptabilité du patient plutôt que par un chiffre universel",
      {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          evidenceTypes: ["consensus_statement"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.1b8b3f44f6dd20d6"],
        cannotConclude: ["que tout niveau de douleur accepté est sûr"],
        flags: ["clinical_content", "expert_practice", "numeric_threshold"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated"
        }
      }
    )
  ], {
    annotationNotes: "La première phrase est une instruction de politique de sortie et n'est pas extraite comme claim scientifique."
  }),

  annotated("frag.f3.0003", [
    claim("L’imagerie ne dicte pas seule la programmation.", {
      domain: "clinical",
      knowledgeType: "MYTH_REFUTATION",
      epistemicStatus: "refuted",
      assessment: {
        directness: "direct_clinical",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.bb0b9f62a20d045d"],
      cannotConclude: ["que l'imagerie est sans pertinence clinique"],
      flags: ["clinical_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "document_type_not_explicit"
      }
    }),
    claim("Bombements, protrusions et autres signes dégénératifs sont fréquents chez les personnes asymptomatiques et augmentent avec l’âge", {
      domain: "clinical",
      knowledgeType: "EVIDENCE",
      epistemicStatus: "probable",
      assessment: {
        directness: "direct_clinical",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.bb0b9f62a20d045d"],
      cannotConclude: ["que les signes d'imagerie causent les symptômes"],
      flags: ["clinical_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "document_type_not_explicit"
      }
    }),
    claim("ils doivent être corrélés aux symptômes et à l’examen clinique", {
      domain: "clinical",
      knowledgeType: "EXPERT_PRACTICE",
      epistemicStatus: "practice_only",
      assessment: {
        directness: "expert_only",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.bb0b9f62a20d045d"],
      cannotConclude: ["que l'imagerie dicte seule la programmation"],
      flags: ["clinical_content", "expert_practice"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "practice_recommendation_document_type_not_explicit"
      }
    })
  ]),

  needsAdjudication(
    "frag.e5f3.00010897",
    [
      claim(
        "Le seuil doit être abaissé quand l’irritabilité est élevée : douleur au repos, réaction avec faible charge, amplitude très sensible, aggravation durable ou perte de fonction.",
        {
          domain: "clinical",
          knowledgeType: "EXPERT_PRACTICE",
          epistemicStatus: "practice_only",
          assessment: {
            directness: "expert_only",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.596245dcbd28f2f3"],
          citationAttributionState: "UNRESOLVED",
          cannotConclude: ["un seuil numérique universel"],
          flags: ["ambiguous_citation", "clinical_content", "numeric_threshold", "expert_practice"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "citation_is_on_following_consensus_sentence"
          }
        }
      ),
      claim(
        "Le consensus de Berne propose une progression selon irritabilité et réponse symptomatique",
        {
          domain: "clinical",
          knowledgeType: "EXPERT_PRACTICE",
          epistemicStatus: "practice_only",
          assessment: {
            directness: "expert_only",
            evidenceTypes: ["consensus_statement"],
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: ["cand.e5-citation.596245dcbd28f2f3"],
          cannotConclude: ["un seuil numérique universel"],
          flags: ["clinical_content", "expert_practice"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated"
          }
        }
      )
    ],
    [
      "La citation porte syntaxiquement sur le consensus de Berne; son rattachement à la règle précédente est anaphorique et doit être revu."
    ]
  ),

  annotated("frag.e5f3.00014346", [
    claim(
      "Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exercice aérobie et exercice général",
      {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: {
          directness: "direct_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.db13b05020d9cd68"],
        cannotConclude: ["qu'une méthode est nécessaire pour tous"],
        flags: ["clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }
    ),
    claim("aucune méthode n’est nécessaire pour tous", {
      domain: "clinical",
      knowledgeType: "EVIDENCE",
      epistemicStatus: "established_direction",
      assessment: {
        directness: "direct_clinical",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.db13b05020d9cd68"],
      cannotConclude: ["qu'une méthode est universellement nécessaire"],
      flags: ["clinical_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "document_type_not_explicit"
      }
    }),
    claim("L’OMS préconise une prise en charge non chirurgicale personnalisée et intégrée de la lombalgie chronique primaire", {
      domain: "clinical",
      knowledgeType: "EVIDENCE",
      epistemicStatus: "established_direction",
      assessment: {
        directness: "direct_clinical",
        evidenceTypes: ["medical_body_recommendation"],
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.9306bf2f305a3ed6"],
      cannotConclude: [],
      flags: ["clinical_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated"
      }
    }),
    claim("L’imagerie n’est habituellement pas appropriée pour une lombalgie non compliquée sans red flags", {
      domain: "clinical",
      knowledgeType: "EVIDENCE",
      epistemicStatus: "established_direction",
      assessment: {
        directness: "direct_clinical",
        supportsHypertrophySuperiority: false,
        supportsDemonstratedClinicalRisk: false
      },
      citations: ["cand.e5-citation.5d8a519fce6f7204"],
      cannotConclude: ["que l'imagerie n'est jamais appropriée"],
      flags: ["clinical_content", "red_flag_content"],
      unresolvedAxes: {
        confidenceByAspect: "confidence_not_stated",
        evidenceTypes: "document_type_not_explicit"
      }
    })
  ]),

  needsAdjudication(
    "frag.e5f3.00023412",
    [
      claim(
        "Le terme historique « impingement » ne prouve pas qu’un tissu est mécaniquement “écrasé” par toute élévation.",
        {
          domain: "clinical",
          knowledgeType: "MYTH_REFUTATION",
          epistemicStatus: "refuted",
          assessment: {
            directness: "biomechanical_only",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["qu'un tissu est mécaniquement écrasé par toute élévation"],
          flags: ["biomechanical_risk_language", "clinical_content"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "document_type_not_stated"
          }
        }
      ),
      claim(
        "Pour les élévations latérales, presses et rotations, la réponse clinique prime sur un angle prétendument parfait.",
        {
          domain: "clinical",
          knowledgeType: "EXPERT_PRACTICE",
          epistemicStatus: "practice_only",
          assessment: {
            directness: "expert_only",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [],
          cannotConclude: ["un angle universellement parfait"],
          flags: ["clinical_content", "expert_practice"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "document_type_not_stated"
          }
        }
      )
    ],
    [
      "La phrase centrale est une règle de formulation produit et n'est pas extraite; la dernière phrase peut relever soit d'une pratique prudente, soit d'une politique produit."
    ]
  ),

  needsAdjudication(
    "frag.e5f3.00029304",
    [
      claim("ce n’est pas « mauvais pour les genoux ».", {
        domain: "clinical",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        citations: [],
        cannotConclude: ["que le leg extension est sûr à toute charge et toute amplitude"],
        flags: ["clinical_content", "biomechanical_risk_language"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "general_myth_not_explicitly_tied_to_one_citation",
          evidenceTypes: "document_type_not_stated"
        }
      }),
      claim("Avec une résistance fixée à la jambe, la demande peut augmenter près de l’extension", {
        domain: "biomechanics",
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "biomechanical_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.2528e8e8fb4afc48"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["une lésion clinique"],
        flags: ["ambiguous_citation", "biomechanical_risk_language"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }),
      claim("certaines machines à came modifient ce profil.", {
        domain: "biomechanics",
        knowledgeType: "BIOMECHANICAL_OBSERVATION",
        epistemicStatus: "probable",
        assessment: {
          directness: "biomechanical_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.2528e8e8fb4afc48"],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["une lésion clinique"],
        flags: ["ambiguous_citation", "biomechanical_risk_language"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      }),
      claim("Ajuster amplitude et charge selon symptômes.", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["une interdiction générale du leg extension"],
        flags: ["clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_stated"
        }
      }),
      claim("Les deux chaînes sont recommandées pour la PFP", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "established_direction",
        assessment: {
          directness: "direct_clinical",
          evidenceTypes: ["clinical_practice_guideline"],
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.6dba11447ad738d6"],
        cannotConclude: ["une supériorité d'une chaîne"],
        flags: ["clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated"
        }
      }),
      claim("les profils biomécaniques ne prouvent pas une lésion clinique", {
        domain: "clinical",
        knowledgeType: "MYTH_REFUTATION",
        epistemicStatus: "refuted",
        assessment: {
          directness: "biomechanical_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: ["cand.e5-citation.2528e8e8fb4afc48"],
        cannotConclude: ["une lésion clinique"],
        flags: ["biomechanical_risk_language", "clinical_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_explicit"
        }
      })
    ],
    [
      "La citation biomécanique est syntaxiquement attachée au garde-fou final; son soutien aux deux propositions de profil précédentes doit être revu."
    ]
  ),

  annotated("frag.e5f3.00030639", [
    claim(
      "reprendre sous le volume et l’intensité antérieurs, car la tolérance à la charge et aux courbatures a diminué.",
      {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["un pourcentage universel de reprise"],
        flags: ["clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_type_not_stated"
        }
      }
    ),
    claim(
      "Aucun pourcentage universel de reprise n’est soutenu pour toutes populations",
      {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "absence_of_evidence",
        citations: [],
        cannotConclude: ["un pourcentage universel de reprise"],
        flags: ["clinical_content", "explicit_absence", "numeric_threshold"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          directness: "absence_claim_has_no_direct_measurement",
          evidenceTypes: "document_type_not_stated"
        }
      }
    )
  ], {
    annotationNotes: "La règle d'étiquetage de « 50 % » et « +10 % par semaine » est une instruction d'encodage, pas une claim scientifique autonome."
  }),

  zeroClaim(
    "frag.f3.0023",
    "Bloc de finalité et de politique de sécurité produit: il définit les limites de l'IA et ne formule pas une claim scientifique E5.",
    {
      annotationNotes: "Le contenu doit être routé comme output/product-safety policy, sans devenir un diagnostic, une contre-indication ou une règle clinique exécutable."
    }
  ),

  needsAdjudication(
    "frag.e5f3.00002764",
    [
      claim("Tout signal rouge prévaut sur le coaching.", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [],
        cannotConclude: ["un diagnostic"],
        flags: ["clinical_content", "red_flag_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "safety_rule_not_explicitly_sourced"
        }
      }),
      claim("Syndrome de la queue de cheval, déficit neurologique progressif, fracture, infection ou malignité suspectées exigent une évaluation médicale appropriée", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [
          "cand.e5-citation.2ff9226e8f58bd0d",
          "cand.e5-citation.c8bdbcc7615aa0aa"
        ],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["un diagnostic certain à partir d'un signal isolé"],
        flags: ["ambiguous_citation", "clinical_content", "red_flag_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_types_not_explicit_for_grouped_citations"
        }
      }),
      claim("les signes isolés sont imparfaits", {
        domain: "clinical",
        knowledgeType: "EVIDENCE",
        epistemicStatus: "probable",
        assessment: {
          directness: "direct_clinical",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [
          "cand.e5-citation.2ff9226e8f58bd0d",
          "cand.e5-citation.c8bdbcc7615aa0aa"
        ],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["qu'un signe isolé diagnostique une pathologie"],
        flags: ["ambiguous_citation", "clinical_content", "red_flag_content"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_types_not_explicit_for_grouped_citations"
        }
      }),
      claim("doivent être interprétés en combinaison et dans leur contexte", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: {
          directness: "expert_only",
          supportsHypertrophySuperiority: false,
          supportsDemonstratedClinicalRisk: false
        },
        citations: [
          "cand.e5-citation.2ff9226e8f58bd0d",
          "cand.e5-citation.c8bdbcc7615aa0aa"
        ],
        citationAttributionState: "UNRESOLVED",
        cannotConclude: ["un diagnostic"],
        flags: ["ambiguous_citation", "clinical_content", "red_flag_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "document_types_not_explicit_for_grouped_citations"
        }
      })
    ],
    [
      "Les deux citations terminales sont groupées et leur soutien individuel aux red flags, à la précision des signes et à l'action d'orientation n'est pas explicite."
    ]
  ),

  annotated("frag.e5f3.00000822", [
    ...[
      ["lombalgie chronique", "cand.e5-citation.74576bec668a04f0"],
      ["tendinopathie de la coiffe", "cand.e5-citation.de3fd03b4fcca391"],
      ["épicondylalgie latérale", "cand.e5-citation.05975ca374952a2f"],
      ["douleur fémoro-patellaire", "cand.e5-citation.76e6da4d2004c295"],
      ["tendinopathie d’Achille", "cand.e5-citation.215ce6bb5cbc42f3"],
      ["arthrose du genou", "cand.e5-citation.7f8f850f3bdf4a2c"]
    ].map(([condition, citationId]) =>
      claim(
        "Les recommandations soutiennent l’exercice pour la lombalgie chronique, la tendinopathie de la coiffe, l’épicondylalgie latérale, la douleur fémoro-patellaire, la tendinopathie d’Achille et l’arthrose du genou",
        {
          canonicalStatement: `Les recommandations soutiennent l'exercice pour ${condition}.`,
          domain: "clinical",
          knowledgeType: "EVIDENCE",
          epistemicStatus: "established_direction",
          assessment: {
            directness: "direct_clinical",
            supportsHypertrophySuperiority: false,
            supportsDemonstratedClinicalRisk: false
          },
          citations: [citationId],
          cannotConclude: ["que l'exercice est la seule composante de prise en charge"],
          flags: ["clinical_content"],
          unresolvedAxes: {
            confidenceByAspect: "confidence_not_stated",
            evidenceTypes: "document_type_not_explicit_in_target_fragment"
          }
        }
      )
    )
  ], {
    annotationNotes: "La proposition coordonnée est décomposée en six claims atomiques. Le même span verbatim porte chaque prédicat; les labels de citation nomment explicitement la condition correspondante."
  })
];

export default annotations;
