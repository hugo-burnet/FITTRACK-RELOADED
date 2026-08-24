import { annotated, claim } from "./spec-helpers.mjs";
import primaryF2 from "./annotator-a-f2.mjs";
import primaryF3 from "./annotator-a-f3.mjs";
import secondary from "./annotator-b.mjs";

const primaryById = new Map([...primaryF2, ...primaryF3].map((item) => [item.fragmentId, item]));
const secondaryById = new Map(secondary.map((item) => [item.fragmentId, item]));

function resolvedCopy(specification, overrides = {}) {
  const { ambiguities: _removed, ...rest } = specification;
  return { ...rest, annotationStatus: "annotated", ...overrides };
}

const custom = {
  "frag.f2.0003": resolvedCopy(primaryById.get("frag.f2.0003"), {
    claims: [
      {
        ...secondaryById.get("frag.f2.0003").claims[0],
        citations: [],
        citationAttributionState: "UNRESOLVED",
        ambiguities: [
          "La citation terminale porte explicitement sur le résultat hypertrophique ; son support du mécanisme est ambigu."
        ]
      },
      ...primaryById.get("frag.f2.0003").claims.slice(1)
    ],
    annotationNotes:
      "Le mécanisme, le résultat longitudinal et les deux interprétations pratiques restent quatre unités distinctes."
  }),

  "frag.e5f2.00026956": resolvedCopy(primaryById.get("frag.e5f2.00026956"), {
    annotationNotes:
      "Les deux actions coordonnées des obliques restent une seule claim anatomique ; les séparer dupliquerait le même span sujet-prédicat."
  }),

  "frag.e5f2.00034666": resolvedCopy(primaryById.get("frag.e5f2.00034666"), {
    claims: primaryById.get("frag.e5f2.00034666").claims.map((item, index) =>
      index === 2 ? { ...item, knowledgeType: "MECHANISM" } : item
    ),
    annotationNotes:
      "La sarcomérogenèse observée est un mécanisme rapporté depuis un modèle animal, pas une nouvelle hypothèse autonome."
  }),

  "frag.e5f2.00044614": resolvedCopy(secondaryById.get("frag.e5f2.00044614"), {
    annotationNotes:
      "La phrase rapportant le résultat de la méta-analyse est une claim EVIDENCE explicite même si le renvoi interne ne fournit aucune CitationOccurrence P0."
  }),

  "frag.f2.0023": resolvedCopy(secondaryById.get("frag.f2.0023"), {
    annotationNotes:
      "Le fragment affirme séparément une observation de sollicitation, un risque seulement supposé, la population indirecte et la généralisation très faible."
  }),

  "frag.e5f3.00030639": annotated(
    "frag.e5f3.00030639",
    [
      primaryById.get("frag.e5f3.00030639").claims[0],
      claim("la tolérance à la charge et aux courbatures a diminué.", {
        domain: "clinical",
        knowledgeType: "EXPERT_PRACTICE",
        epistemicStatus: "practice_only",
        assessment: { directness: "expert_only" },
        flags: ["clinical_content", "expert_practice"],
        unresolvedAxes: {
          confidenceByAspect: "confidence_not_stated",
          evidenceTypes: "no_document_type_stated"
        }
      }),
      primaryById.get("frag.e5f3.00030639").claims[1]
    ],
    {
      annotationNotes:
        "La justification sur la tolérance est séparable de la recommandation de reprise et de l'absence de seuil universel."
    }
  ),

  "frag.e5f3.00002764": resolvedCopy(secondaryById.get("frag.e5f3.00002764"), {
    claims: secondaryById.get("frag.e5f3.00002764").claims.slice(1),
    annotationNotes:
      "La priorité du red flag sur le coaching reste une politique produit ; l'orientation, l'imperfection des signes isolés et leur interprétation contextuelle sont séparées."
  }),

  "frag.e5f3.00000822": resolvedCopy(primaryById.get("frag.e5f3.00000822"), {
    annotationNotes:
      "Une seule proposition coordonnée est conservée : six duplications du même rawStatement ne créeraient pas six claims atomiques. Le mapping individuel population-citation reste ambigu."
  }),

  "frag.e5f2.00066319": resolvedCopy(primaryById.get("frag.e5f2.00066319"), {
    annotationNotes:
      "La claim textuelle est conservée, mais le verbe « favorise » ne permet pas de choisir entre EMG, force et biomécanique ; les axes restent UNRESOLVED."
  }),

  "frag.e5f2.00075653": resolvedCopy(primaryById.get("frag.e5f2.00075653"), {
    claims: primaryById.get("frag.e5f2.00075653").claims.map((item, index) =>
      index === 1
        ? {
            ...item,
            knowledgeType: undefined,
            epistemicStatus: undefined,
            assessment: undefined,
            citations: [],
            citationAttributionState: "UNRESOLVED",
            unresolvedAxes: {
              knowledgeType: "meta_analysis_scope_does_not_identify_the_outcome_for_abduction_machines",
              epistemicStatus: "status_not_explicit",
              directness: "measurement_scope_ambiguous",
              evidenceTypes: "grouped_citations_do_not_map_cleanly_to_this_claim",
              confidenceByAspect: "confidence_not_stated"
            },
            ambiguities: [
              "La méta-analyse nommée porte sur le grand fessier tandis que la proposition vise moyen et petit fessiers ; le fragment ne permet pas une attribution sûre."
            ]
          }
        : item
    ),
    annotationNotes:
      "Les quatre unités sont conservées ; la citation de la claim sur les machines d'abduction n'est pas forcée et ses axes restent non résolus."
  })
};

export default {
  decisions: [
    {
      fragmentId: "frag.f2.0001",
      selected: "B",
      justification:
        "Les quatre claims et citations sont identiques ; l'ambiguïté de portée de la règle générale est déjà portée au niveau de la claim et ne justifie pas un statut fragment needs_adjudication."
    },
    {
      fragmentId: "frag.f2.0003",
      selected: "CUSTOM",
      annotation: custom["frag.f2.0003"],
      justification:
        "Le span mécanistique court de B est plus atomique, tandis que le span de résultat et l'absence de citation sur les conseils chez A évitent fusion et citation bleed."
    },
    {
      fragmentId: "frag.f2.0004",
      selected: "B",
      justification:
        "Les spans B conservent les statistiques, la durée et les comparateurs nécessaires à la portée des deux résultats."
    },
    {
      fragmentId: "frag.e5f2.00026956",
      selected: "CUSTOM",
      annotation: custom["frag.e5f2.00026956"],
      justification:
        "La claim supplémentaire de B duplique un sous-span déjà contenu dans sa claim suivante ; le découpage A évite ce double comptage."
    },
    {
      fragmentId: "frag.e5f2.00028637",
      selected: "A",
      justification:
        "Le span A isole le résultat sur la variation non linéaire des bras de levier sans embarquer la présentation de l'étude."
    },
    {
      fragmentId: "frag.e5f2.00034666",
      selected: "CUSTOM",
      annotation: custom["frag.e5f2.00034666"],
      justification:
        "Trois unités suffisent ; le principe qualitatif final est une relation de cohérence, tandis que la sarcomérogenèse observée doit être typée MECHANISM."
    },
    {
      fragmentId: "frag.f2.0021",
      selected: "A",
      justification:
        "A conserve dans la claim de synthèse l'hétérogénéité explicitement énoncée et adopte le statut prudent uncertain."
    },
    {
      fragmentId: "frag.e5f2.00044614",
      selected: "CUSTOM",
      annotation: custom["frag.e5f2.00044614"],
      justification:
        "La phrase sur la méta-analyse porte un résultat distinct et ne doit pas disparaître faute de CitationOccurrence dans le fragment."
    },
    {
      fragmentId: "frag.f2.0023",
      selected: "CUSTOM",
      annotation: custom["frag.f2.0023"],
      justification:
        "B sépare correctement la sollicitation, le risque supposé, la population indirecte et l'extrapolation ; les citations groupées restent explicitement ambiguës."
    },
    {
      fragmentId: "frag.f2.0005",
      selected: "B",
      justification:
        "La conclusion mécanistique sur la redistribution de l'effort est une cinquième affirmation explicite, distincte des deux observations EMG et du résultat de force."
    },
    {
      fragmentId: "frag.f2.0007",
      selected: "A",
      justification:
        "Le span A est le prédicat comparatif minimal ; B fusionne la présentation méthodologique avec le résultat."
    },
    {
      fragmentId: "frag.e5f2.00072017",
      selected: "B",
      justification:
        "La phrase finale réfute explicitement l'inférence EMG vers hypertrophie ; la qualifier de claim MYTH_REFUTATION est préférable à extraire « preuve récente, niveau modéré »."
    },
    {
      fragmentId: "frag.f2.0022",
      selected: "A",
      justification:
        "Le fragment ne justifie pas de forcer un statut probable sur l'association force ni sur l'observation EMG ; A laisse ces axes non résolus."
    },
    {
      fragmentId: "frag.f3.0001",
      selected: "A",
      justification:
        "Les deux annotations convergent ; A conserve le connecteur « voire » qui borne l'avantage antalgique comme extension du résultat comparable."
    },
    {
      fragmentId: "frag.f3.0002",
      selected: "A",
      justification:
        "Claims et citations sont identiques ; A conserve la résolution d'axes la plus conforme à l'exemple normatif du Design Review."
    },
    {
      fragmentId: "frag.f3.0007",
      selected: "A",
      justification:
        "La différence porte sur une frontière de ponctuation ; A fournit le span minimal sans modifier le sens."
    },
    {
      fragmentId: "frag.e5f3.00012613",
      selected: "A",
      justification:
        "Le span A conserve le sujet « Le principe commun » et reste autonome ; les trois résultats sourcés sont identiques."
    },
    {
      fragmentId: "frag.e5f3.00014985",
      selected: "A",
      justification:
        "Les claims sont identiques ; A conserve les limites transversales avec la claim d'absence de preuve."
    },
    {
      fragmentId: "frag.e5f3.00025760",
      selected: "A",
      justification:
        "Le connecteur « avec » conserve le rattachement de la règle d'acceptabilité au consensus cité."
    },
    {
      fragmentId: "frag.f3.0003",
      selected: "A",
      justification:
        "La citation soutient directement la fréquence des signes d'imagerie, pas nécessairement le garde-fou général initial ; A évite cette propagation."
    },
    {
      fragmentId: "frag.e5f3.00010897",
      selected: "A",
      justification:
        "La citation du consensus suit la seconde phrase et ne doit pas être propagée à la règle de seuil de la première phrase."
    },
    {
      fragmentId: "frag.e5f3.00014346",
      selected: "B",
      justification:
        "« Aucune méthode n'est nécessaire pour tous » décrit la portée de la recommandation APTA ; EVIDENCE/established_direction est plus fidèle que MYTH_REFUTATION/refuted."
    },
    {
      fragmentId: "frag.e5f3.00023412",
      selected: "A",
      justification:
        "Les claims concordent ; les axes non énoncés peuvent rester non résolus sans maintenir le fragment en needs_adjudication."
    },
    {
      fragmentId: "frag.e5f3.00029304",
      selected: "A",
      justification:
        "Les citations terminales ont des portées distinctes et ne soutiennent pas directement les deux observations de profil mécanique ; A évite ce citation bleed et reste prudent sur leur statut."
    },
    {
      fragmentId: "frag.e5f3.00030639",
      selected: "CUSTOM",
      annotation: custom["frag.e5f3.00030639"],
      justification:
        "La recommandation de reprise, sa justification sur la tolérance et l'absence de pourcentage universel sont trois unités indépendantes."
    },
    {
      fragmentId: "frag.e5f3.00002764",
      selected: "CUSTOM",
      annotation: custom["frag.e5f3.00002764"],
      justification:
        "La priorité sur le coaching est une politique produit ; l'orientation, la précision imparfaite des signes et leur interprétation contextuelle restent trois claims distinctes."
    },
    {
      fragmentId: "frag.e5f3.00000822",
      selected: "CUSTOM",
      annotation: custom["frag.e5f3.00000822"],
      justification:
        "Le prédicat n'apparaît qu'une fois : dupliquer six fois le même rawStatement pour forcer un mapping citation-population créerait de faux claims."
    }
  ],
  primaryOnlyResolutions: [
    {
      fragmentId: "frag.e5f2.00066319",
      annotation: custom["frag.e5f2.00066319"],
      justification:
        "La claim est réelle mais son outcome sous-jacent n'est pas nommé ; conserver des axes UNRESOLVED est préférable à forcer EMG, biomécanique ou hypertrophie."
    },
    {
      fragmentId: "frag.e5f2.00075653",
      annotation: custom["frag.e5f2.00075653"],
      justification:
        "La portée groupée de la méta-analyse est incohérente avec la proposition sur moyen/petit fessiers ; l'attribution est laissée UNRESOLVED sans supprimer la claim textuelle."
    }
  ]
};
