import { RUBRIC_VERSION, SCENARIO_ID, SCENARIO_VERSION, type Scenario } from '../domain/types';

export const aphasiaIntakeScenario: Scenario = {
  id: SCENARIO_ID,
  version: SCENARIO_VERSION,
  rubricVersion: RUBRIC_VERSION,
  title: 'Intake met een cliënt met afasie na een beroerte',
  estimatedDuration: '10–15 minuten',
  client: {
    name: 'Erik de Vries',
    age: 62,
    fictional: true,
    condition: 'Beroerte in de linkerhersenhelft, drie weken geleden',
    communicationProfile: 'Matige expressieve afasie',
    comprehension: 'Begrip grotendeels intact bij korte, eenvoudige zinnen',
    speech: 'Woordvindingsproblemen, korte uitingen, soms semantische substituties',
    emotionalState: 'Onzeker en soms gefrustreerd',
    energy: 'Vermoeid bij langere gesprekken',
    homeSituation: 'Woont samen met zijn partner',
    previousOccupation: 'Buschauffeur',
    primaryGoal: 'Beter communiceren met partner, kinderen en kleinkinderen',
    personalNeed:
      'Direct aangesproken worden, serieus genomen worden en tijd krijgen om te antwoorden',
  },
  briefing: {
    medicalBackground:
      'Erik de Vries is een fictieve cliënt van 62 jaar. Drie weken geleden had hij een beroerte in de linkerhersenhelft. Hij heeft een matige expressieve afasie. Het begrip is grotendeels intact bij korte, eenvoudige zinnen. Spreken kost inspanning: hij zoekt naar woorden, spreekt in korte uitingen en vervangt soms een woord door een betekenisverwant woord.',
    consultationContext:
      'Je ziet Erik voor een eerste logopedische intake in de revalidatie. Het doel is om samen de hulpvraag, de communicatie in het dagelijks leven en mogelijke vervolgstappen te verkennen. Dit is geen diagnostische testbatterij.',
    studentRole:
      'Jij bent de logopedist in opleiding. Je leidt het gesprek, past je taal aan, geeft tijd en blijft respectvol, ook bij frustratie of vermoeidheid.',
  },
  learningObjectives: [
    { id: 'lo-1', text: 'Een logopedische intake gestructureerd opbouwen.' },
    { id: 'lo-2', text: 'Open en gesloten vragen passend inzetten.' },
    { id: 'lo-3', text: 'Korte en duidelijke zinnen gebruiken.' },
    { id: 'lo-4', text: 'Eén vraag tegelijk stellen.' },
    { id: 'lo-5', text: 'Voldoende antwoordtijd geven.' },
    { id: 'lo-6', text: 'Controleren of de cliënt de vraag begreep.' },
    { id: 'lo-7', text: 'Passende communicatieondersteuning bieden.' },
    { id: 'lo-8', text: 'De cliënt rechtstreeks aanspreken.' },
    { id: 'lo-9', text: 'Frustratie herkennen en erop reageren.' },
    { id: 'lo-10', text: 'Vermoeidheid herkennen en het gesprek aanpassen.' },
    { id: 'lo-11', text: 'Communicatieve participatie thuis en sociaal verkennen.' },
    { id: 'lo-12', text: 'De eigen prioriteiten van de cliënt achterhalen.' },
    { id: 'lo-13', text: 'Observatie scheiden van interpretatie.' },
    { id: 'lo-14', text: 'Het gesprek nauwkeurig samenvatten.' },
    { id: 'lo-15', text: 'Een passend eerste behandeldoel en vervolgstap voorstellen.' },
  ],
  startNodeId: 'd1-greeting',
  nodes: [
    {
      id: 'd1-greeting',
      phaseId: 'greeting',
      phaseLabel: 'Begroeting en uitleg',
      scoredCompetencies: ['adaptedCommunication', 'empathyAndProfessionalBehaviour'],
      prompt: {
        text: 'Hallo... u bent... eh... de... logopedie? Ja.',
        context: 'Erik zit rechtop, kijkt onzeker en wacht af.',
      },
      promptEmotion: 'neutral',
      options: [
        {
          id: 'd1-high',
          text: 'Goedemiddag, meneer de Vries. Ik ben de logopedist. Ik wil horen hoe het praten gaat. Is dat goed?',
          nextNodeId: 'd2-concern',
          quality: 'high',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 1, empathyAndProfessionalBehaviour: 1 },
          clientResponse: {
            text: 'Ja. Goed. Ik ben... Erik. Meneer is... zo stijf.',
            context: 'Erik ontspant iets en maakt oogcontact.',
          },
          emotion: 'reassured',
          fatigueDelta: 0,
          delayedFeedback:
            'Je stelde je kort voor, sprak Erik direct aan en vroeg toestemming voor het gesprek.',
          educationalRationale:
            'Een korte, respectvolle uitleg in eenvoudige zinnen ondersteunt begrip en rapport.',
          flags: { addressedClientDirectly: true },
        },
        {
          id: 'd1-partial',
          text: 'We doen een anamnese over uw CVA en daarna taaltesten. Begrijpt u dat allemaal?',
          nextNodeId: 'd2-concern',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 0.5, empathyAndProfessionalBehaviour: 0.5 },
          clientResponse: {
            text: 'Ana... wat? Even... kwijt. Te snel.',
            context: 'Erik fronst en leunt iets naar voren.',
          },
          emotion: 'neutral',
          fatigueDelta: 1,
          delayedFeedback:
            'De bedoeling was duidelijk, maar jargon en een dubbele boodschap maakten het te zwaar.',
          educationalRationale:
            'Vakwoorden en gestapelde informatie bemoeilijken het begrip, ook als het auditieve begrip relatief goed is.',
          flags: { usedLongQuestions: true },
        },
        {
          id: 'd1-low',
          text: 'We gaan even gezellig kletsen, hoor. Dan kijk ik hoe jij het taaltje doet.',
          nextNodeId: 'd2-concern',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { adaptedCommunication: 0, empathyAndProfessionalBehaviour: 0 },
          clientResponse: {
            text: 'Ik ben... geen kind. Bah.',
            context: 'Erik trekt zijn schouders op en kijkt weg.',
          },
          emotion: 'frustrated',
          fatigueDelta: 1,
          delayedFeedback:
            'Infantilisering beschadigt het contact. Spreek een volwassene met afasie als volwassene aan.',
          educationalRationale:
            'Aangepaste taal is niet hetzelfde als vereenvoudigen tot kindertaal of een informele toon zonder toestemming.',
        },
      ],
    },
    {
      id: 'd2-concern',
      phaseId: 'presenting-concern',
      phaseLabel: 'Hulpvraag',
      scoredCompetencies: ['historyTakingAndGoals', 'adaptedCommunication'],
      prompt: {
        text: 'Praten is... eh... lastig. Ja.',
        context: 'Erik wacht op een duidelijke, enkele vraag.',
      },
      promptEmotion: 'listening',
      options: [
        {
          id: 'd2-low',
          text: 'Wanneer was het CVA, welke uitval had u, en hoe is slikken én taal nu vergeleken met vorige week?',
          nextNodeId: 'd3-language',
          quality: 'inappropriate',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 0, adaptedCommunication: 0 },
          clientResponse: {
            text: 'Wacht... slikken... vorige week... Ik... snap het niet.',
            context: 'Erik wrijft over zijn voorhoofd.',
          },
          emotion: 'confused',
          fatigueDelta: 1,
          delayedFeedback:
            'Een lange, dubbele vraag overvraagt. Erik raakt de draad kwijt, terwijl het begrip voor korte zinnen wél meezit.',
          educationalRationale:
            'Stel één korte vraag tegelijk en bouw medische voorgeschiedenis stapsgewijs op.',
          flags: { usedLongQuestions: true },
        },
        {
          id: 'd2-high',
          text: 'Wat is er voor u nu het lastigst als u wilt praten?',
          nextNodeId: 'd3-language',
          quality: 'high',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 1, adaptedCommunication: 1 },
          clientResponse: {
            text: 'Woorden. Ze... komen niet. In mijn hoofd... wel. Mond... nee.',
            context: 'Erik gebaart van hoofd naar mond.',
          },
          emotion: 'listening',
          fatigueDelta: 0,
          delayedFeedback:
            'Een korte open vraag gaf Erik ruimte om de kern van de hulpvraag zelf te benoemen.',
          educationalRationale:
            'Open, enkelvoudige vragen helpen om de beleving van de cliënt centraal te zetten.',
        },
        {
          id: 'd2-partial',
          text: 'Kunt u nog praten, ja of nee?',
          nextNodeId: 'd3-language',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 0.5, adaptedCommunication: 0.5 },
          clientResponse: {
            text: 'Ja. Maar niet... goed. Meer is er... wel.',
            context: 'Erik knikt, maar lijkt onvolledig gehoord.',
          },
          emotion: 'neutral',
          fatigueDelta: 0,
          delayedFeedback:
            'Een gesloten vraag is helder, maar te smal voor een hulpvraag in de intake.',
          educationalRationale:
            'Gesloten vragen zijn nuttig ter toetsing, niet als enige manier om de hulpvraag te verkennen.',
        },
      ],
    },
    {
      id: 'd3-language',
      phaseId: 'language',
      phaseLabel: 'Taal en spreken',
      scoredCompetencies: ['adaptedCommunication', 'observation'],
      prompt: {
        text: 'Ik wil... zeggen... werk. Ik was... eh... auto. Nee. Groot. Mensen.',
        context: 'Erik zoekt naar het woord buschauffeur.',
      },
      promptEmotion: 'thinking',
      options: [
        {
          id: 'd3-partial',
          text: 'Zeg eens huis, boom, auto. En daarna de dagen van de week.',
          nextNodeId: 'd4-home',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 0.5, observation: 0.5 },
          clientResponse: {
            text: 'Huis... boom... Dat is... school. Ik wil praten... over thuis.',
            context: 'Erik werkt mee, maar raakt geïrriteerd over de toetsvorm.',
          },
          emotion: 'thinking',
          fatigueDelta: 1,
          delayedFeedback:
            'Je kreeg wel taaloutput, maar de intake werd een test in plaats van een gesprek over functioneren.',
          educationalRationale:
            'Screening kan later. Eerst observeren in betekenisvolle conversatie.',
        },
        {
          id: 'd3-low',
          text: 'Buschauffeur, dat wou u zeggen. Vertel verder, ik vul de woorden wel aan.',
          nextNodeId: 'd4-home',
          quality: 'inappropriate',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 0, observation: 0 },
          clientResponse: {
            text: '... Ja. Misschien. U zegt het... al.',
            context: 'Erik leunt achterover en laat het woord over aan jou.',
          },
          emotion: 'frustrated',
          fatigueDelta: 1,
          delayedFeedback:
            'Zinnen afmaken ontneemt initiatief. Erik wordt stiller in plaats van ondersteund.',
          educationalRationale:
            'Wacht, bied tijd, en vraag pas daarna of ondersteuning gewenst is.',
          flags: { finishedSentences: true },
        },
        {
          id: 'd3-high',
          text: 'U zoekt een woord. Neem de tijd. Ik wacht. Mag ik daarna helpen?',
          nextNodeId: 'd4-home',
          quality: 'high',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 1, observation: 1 },
          clientResponse: {
            text: 'Ja. Wachten... goed. Bus. Chauffeur. Dat... is het.',
            context: 'Na een korte pauze vindt Erik het woord zelf.',
          },
          emotion: 'reassured',
          fatigueDelta: 0,
          delayedFeedback:
            'Je gaf antwoordtijd en vroeg toestemming voor hulp. Erik kon zelf verder.',
          educationalRationale: 'Tijd en gevraagde ondersteuning versterken autonome communicatie.',
          flags: { gaveResponseTime: true, offeredCommunicationSupport: true },
        },
      ],
    },
    {
      id: 'd4-home',
      phaseId: 'home',
      phaseLabel: 'Communicatie thuis',
      scoredCompetencies: ['historyTakingAndGoals', 'observation'],
      prompt: {
        text: 'Thuis... mijn vrouw. Zij... praat veel.',
        context: 'Erik kijkt naar de zijkant, alsof hij zijn partner zoekt.',
      },
      promptEmotion: 'listening',
      options: [
        {
          id: 'd4-high',
          text: 'Hoe gaat het praten thuis, met uw partner?',
          nextNodeId: 'd5-participation',
          quality: 'high',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 1, observation: 1 },
          clientResponse: {
            text: 'Zij praat. Ik... knik. Soms boos. Niet op haar. Op... woorden.',
            context: 'Erik klopt met twee vingers op tafel.',
          },
          emotion: 'listening',
          fatigueDelta: 0,
          delayedFeedback:
            'Je vroeg naar communicatie thuis en kreeg informatie over rolverdeling en frustratie.',
          educationalRationale: 'Participatie thuis hoort in de intake, niet alleen de stoornis.',
        },
        {
          id: 'd4-low',
          text: 'Dat vraag ik later wel aan uw vrouw. Zij kan het beter uitleggen.',
          nextNodeId: 'd5-participation',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { historyTakingAndGoals: 0, observation: 0 },
          clientResponse: {
            text: 'Vraag... mij. Ik woon daar. Ik... weet het.',
            context: 'Erik tikt tegen zijn borst.',
          },
          emotion: 'frustrated',
          fatigueDelta: 1,
          delayedFeedback:
            'Over de cliënt heen praten is onveilig in de samenwerkingsrelatie. Erik wil zelf gehoord worden.',
          educationalRationale:
            'Naasten zijn waardevol, maar de cliënt blijft de eerste gesprekspartner.',
        },
        {
          id: 'd4-partial',
          text: 'Woont u samen, ja of nee?',
          nextNodeId: 'd5-participation',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 0.5, observation: 0.5 },
          clientResponse: {
            text: 'Ja. Met haar. Meer... vragen?',
            context: 'Erik knikt kort en wacht.',
          },
          emotion: 'neutral',
          fatigueDelta: 0,
          delayedFeedback: 'Je kreeg een feit, maar niet hoe communicatie thuis verloopt.',
          educationalRationale:
            'Woonsituatie is relevant, maar de kwaliteit van gesprekken thuis is de kern.',
        },
      ],
    },
    {
      id: 'd5-participation',
      phaseId: 'participation',
      phaseLabel: 'Participatie en doelen',
      scoredCompetencies: ['historyTakingAndGoals', 'clinicalReasoning'],
      prompt: {
        text: 'Ik wil... weer. Met de... kleinen. En... vrouw.',
        context: 'Erik maakt een wiegende beweging, als naar een kind.',
      },
      promptEmotion: 'speaking',
      options: [
        {
          id: 'd5-partial',
          text: 'We gaan vooral woorden oefenen. Benoemen is nu het belangrijkst.',
          nextNodeId: 'd6-wordfinding',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 0.5, clinicalReasoning: 0.5 },
          clientResponse: {
            text: 'Woorden... ja. Maar de kleinkinderen... ook.',
            context: 'Erik blijft naar het gebaar voor de kleinkinderen kijken.',
          },
          emotion: 'thinking',
          fatigueDelta: 0,
          delayedFeedback:
            'Stoornisgericht oefenen kan later, maar de participatiedoelen bleven onderbelicht.',
          educationalRationale:
            'Doelen komen voort uit wat de cliënt weer wil kunnen, niet alleen uit de stoornis.',
        },
        {
          id: 'd5-high',
          text: 'Met wie wilt u weer goed praten? Wat is voor u het belangrijkst?',
          nextNodeId: 'd6-wordfinding',
          quality: 'high',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 1, clinicalReasoning: 1 },
          clientResponse: {
            text: 'Vrouw. Kinderen. Kleinkinderen. Voorlezen... lukt niet. Dat wil ik.',
            context: 'Erik glimlacht kort bij het woord kleinkinderen.',
          },
          emotion: 'reassured',
          fatigueDelta: 0,
          delayedFeedback:
            'Je vroeg naar eigen prioriteiten en hoorde een concreet participatiedoel: voorlezen.',
          educationalRationale:
            'Cliëntgerichte doelen maken de behandeling betekenisvol en toetsbaar.',
          flags: { exploredParticipation: true },
        },
        {
          id: 'd5-low',
          text: 'Het doel is dat u weer gaat werken als chauffeur. Daar beginnen we mee.',
          nextNodeId: 'd6-wordfinding',
          quality: 'inappropriate',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 0, clinicalReasoning: 0 },
          clientResponse: {
            text: 'Werk... weet ik niet. Eerst thuis. U zegt... te veel.',
            context: 'Erik schudt langzaam nee.',
          },
          emotion: 'confused',
          fatigueDelta: 1,
          delayedFeedback:
            'Je zette een doel voor hem. Dat is een aanname, geen gedeelde beslissing.',
          educationalRationale:
            'Doelen zonder toetsing bij de cliënt zijn interpretatie, geen observatie.',
          flags: { usedAssumptions: true },
        },
      ],
    },
    {
      id: 'd6-wordfinding',
      phaseId: 'word-finding',
      phaseLabel: 'Woordvinding',
      scoredCompetencies: ['adaptedCommunication', 'empathyAndProfessionalBehaviour'],
      prompt: {
        text: 'Ik wil de... eh... ding... voor... eh...',
        context: 'Erik gebaart een open boek en zoekt zichtbaar naar het woord.',
      },
      promptEmotion: 'thinking',
      options: [
        {
          id: 'd6-low',
          text: 'Zeg gewoon boek. Kom op, dat weet u best.',
          nextNodeId: 'd7-fatigue',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { adaptedCommunication: 0, empathyAndProfessionalBehaviour: 0 },
          clientResponse: {
            text: 'Niet duwen. Lukt niet... zo.',
            context: 'Erik laat zijn hand zakken.',
          },
          emotion: 'frustrated',
          fatigueDelta: 1,
          delayedFeedback:
            'Aansporen onder druk vergroot faalangst. Woordvinding vraagt tijd, geen dwang.',
          educationalRationale:
            'Druk en correctie op het moment van zoeken onderbreken het woordvindingsproces.',
        },
        {
          id: 'd6-partial',
          text: 'Voorlezen. U bedoelt een boek, toch?',
          nextNodeId: 'd7-fatigue',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 0.5, empathyAndProfessionalBehaviour: 0.5 },
          clientResponse: {
            text: 'Ja. Boek. U zei het... snel.',
            context: 'Erik knikt, maar de zoekpoging is afgebroken.',
          },
          emotion: 'neutral',
          fatigueDelta: 0,
          delayedFeedback: 'Het woord klopte, maar je nam de beurt over voordat Erik kon afronden.',
          educationalRationale:
            'Invullen kan soms helpen, na een pauze en bij voorkeur met toestemming.',
          flags: { finishedSentences: true },
        },
        {
          id: 'd6-high',
          text: 'Neem de tijd. U mag het aanwijzen of omschrijven, als u wilt.',
          nextNodeId: 'd7-fatigue',
          quality: 'high',
          unsafe: false,
          competencyAwards: { adaptedCommunication: 1, empathyAndProfessionalBehaviour: 1 },
          clientResponse: {
            text: 'Boek. Voorlezen. Voor Tom. Kleinzoon.',
            context: 'Erik glimlacht nadat hij het woord zelf heeft gevonden.',
          },
          emotion: 'reassured',
          fatigueDelta: 0,
          delayedFeedback: 'Je bood multimodale steun zonder het woord af te pakken.',
          educationalRationale:
            'Omschrijven, aanwijzen en tijd zijn passende ondersteuning bij expressieve afasie.',
          flags: { gaveResponseTime: true, offeredCommunicationSupport: true },
        },
      ],
    },
    {
      id: 'd7-fatigue',
      phaseId: 'fatigue',
      phaseLabel: 'Frustratie en vermoeidheid',
      scoredCompetencies: ['empathyAndProfessionalBehaviour', 'observation'],
      prompt: {
        text: 'Stop. Hoofd... vol. Bah. Ik kan dit niet.',
        context: 'Erik zucht, wrijft in zijn ogen en zakt iets in zijn stoel.',
      },
      promptEmotion: 'frustrated',
      options: [
        {
          id: 'd7-high',
          text: 'Dit is vermoeiend, dat merkt u. Zal ik kort pauzeren, of nog één vraag?',
          nextNodeId: 'd8-summary',
          quality: 'high',
          unsafe: false,
          competencyAwards: { empathyAndProfessionalBehaviour: 1, observation: 1 },
          clientResponse: {
            text: 'Pauze... kort. Dan verder. Dank u.',
            context: 'Erik ademt uit en knikt.',
          },
          emotion: 'reassured',
          fatigueDelta: -1,
          delayedFeedback: 'Je benoemde de frustratie, bood een pauze aan en gaf Erik de regie.',
          educationalRationale:
            'Erkennen van belasting en samen doseren hoort bij professionele intake.',
          flags: { acknowledgedFrustration: true },
        },
        {
          id: 'd7-low',
          text: 'We moeten nu afronden, anders is de tijd weg. Wat kunt u slikken en rekenen?',
          nextNodeId: 'd8-summary',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { empathyAndProfessionalBehaviour: 0, observation: 0 },
          clientResponse: {
            text: 'Nee. Klaar. Te veel.',
            context: 'Erik sluit kort de ogen en zakt verder weg.',
          },
          emotion: 'frustrated',
          fatigueDelta: 2,
          delayedFeedback:
            'Doorgaan ondanks duidelijke overbelasting is onveilig en niet cliëntgericht.',
          educationalRationale:
            'Vermoeidheid is een observatie die tot aanpassing van het gesprek moet leiden.',
        },
        {
          id: 'd7-partial',
          text: 'U doet het al knap. Nog even volhouden, dan zijn we klaar.',
          nextNodeId: 'd8-summary',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { empathyAndProfessionalBehaviour: 0.5, observation: 0.5 },
          clientResponse: {
            text: 'Knap... ja. Maar moe. Oké... kort.',
            context: 'Erik probeert mee te gaan, maar blijft hangend zitten.',
          },
          emotion: 'neutral',
          fatigueDelta: 1,
          delayedFeedback:
            'Aanmoediging was vriendelijk, maar de vermoeidheid werd niet echt ontlast.',
          educationalRationale: 'Positieve feedback vervangt geen pauze of keuze om te stoppen.',
        },
      ],
    },
    {
      id: 'd8-summary',
      phaseId: 'summary',
      phaseLabel: 'Samenvatting en vervolg',
      scoredCompetencies: [
        'clinicalReasoning',
        'adaptedCommunication',
        'empathyAndProfessionalBehaviour',
      ],
      prompt: {
        text: 'Dus... wat nu? Kort... graag.',
        context: 'Erik is nog aanwezig, maar vraagt om een korte afronding.',
      },
      promptEmotion: 'listening',
      options: [
        {
          id: 'd8-partial',
          text: 'U hebt afasie, dus we gaan trainen. Volgende week start de behandeling.',
          nextNodeId: 'conclusion',
          quality: 'partial',
          unsafe: false,
          competencyAwards: {
            clinicalReasoning: 0.5,
            adaptedCommunication: 0.5,
            empathyAndProfessionalBehaviour: 0.5,
          },
          clientResponse: {
            text: 'Afasie... ja. Training. Wat precies? Onzeker.',
            context: 'Erik knikt, maar fronst bij het ontbreken van een toetsing.',
          },
          emotion: 'neutral',
          fatigueDelta: 0,
          delayedFeedback:
            'Er is een vervolg, maar zonder samenvatting of gezamenlijke afstemming.',
          educationalRationale: 'Een vervolgstap wordt sterker als je eerst samenvat en toetst.',
        },
        {
          id: 'd8-high',
          text: 'Kort: woorden vinden is lastig, thuis knikt u veel, voorlezen is belangrijk. Klopt dat?',
          nextNodeId: 'conclusion',
          quality: 'high',
          unsafe: false,
          competencyAwards: {
            clinicalReasoning: 1,
            adaptedCommunication: 1,
            empathyAndProfessionalBehaviour: 1,
          },
          clientResponse: {
            text: 'Ja. Klopt. Dat is het.',
            context: 'Erik ontspant en maakt opnieuw oogcontact.',
          },
          emotion: 'reassured',
          fatigueDelta: 0,
          delayedFeedback: 'Je vatte accuraat samen, toetste bij Erik en bleef in korte zinnen.',
          educationalRationale:
            'Een getoetste samenvatting laat de cliënt merken dat hij begrepen is.',
        },
        {
          id: 'd8-low',
          text: 'Door het infarct functioneert u niet zelfstandig. Ik noteer ernstige globale afasie.',
          nextNodeId: 'conclusion',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: {
            clinicalReasoning: 0,
            adaptedCommunication: 0,
            empathyAndProfessionalBehaviour: 0,
          },
          clientResponse: {
            text: 'Niet globaal. Ik begrijp u. Niet zo... zwaar zeggen.',
            context: 'Erik schudt nadrukkelijk nee.',
          },
          emotion: 'frustrated',
          fatigueDelta: 1,
          delayedFeedback:
            'Je noteerde aannames als feiten en overschatte de ernst. Dat is klinisch onjuist.',
          educationalRationale:
            'Onderscheid observatie (korte uitingen, woordzoeken) van diagnose of zwaartelabel zonder onderzoek.',
          flags: { usedAssumptions: true },
        },
      ],
    },
  ],
  conclusionFields: [
    {
      id: 'primaryDifficulty',
      label: 'Voornaamste communicatieprobleem',
      help: 'Kies wat het beste past bij de observaties in dit gesprek.',
      scoredCompetencies: ['observation', 'clinicalReasoning'],
      textLabel: '',
      textRequired: false,
      choices: [
        {
          id: 'pd-high',
          text: 'Expressieve afasie met woordvindingsproblemen; begrip voor korte zinnen grotendeels intact.',
          quality: 'high',
          unsafe: false,
          competencyAwards: { observation: 1, clinicalReasoning: 1 },
          delayedFeedback:
            'Dit sluit aan bij de geobserveerde korte uitingen en het relatief behouden begrip.',
          educationalRationale: 'De voorlopige conclusie blijft binnen wat het gesprek laat zien.',
        },
        {
          id: 'pd-partial',
          text: 'Vooral een motorisch spraakprobleem; taal zelf lijkt weinig aangedaan.',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { observation: 0.5, clinicalReasoning: 0.5 },
          delayedFeedback:
            'Er kan dysartrie of apraxie meespelen, maar de woordvinding wijst op taal.',
          educationalRationale:
            'Een voorlopige conclusie mag onzekerheid benoemen, niet de taalcomponent wegstrepen.',
        },
        {
          id: 'pd-low',
          text: 'Ernstige globale afasie met nauwelijks taalbegrip.',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { observation: 0, clinicalReasoning: 0 },
          delayedFeedback:
            'Dit overschrijdt de observatie: Erik begreep korte zinnen en corrigeerde je.',
          educationalRationale: 'Een zwaarder label dan de data toelaten is een aanname.',
        },
      ],
    },
    {
      id: 'dailyLifeEffect',
      label: 'Effect op het dagelijks leven',
      help: 'Wat volgt uit het gesprek over participatie, niet uit aannames.',
      scoredCompetencies: ['historyTakingAndGoals', 'clinicalReasoning'],
      textLabel: 'Korte toelichting (verplicht, telt niet mee in de score)',
      textRequired: true,
      choices: [
        {
          id: 'dl-partial',
          text: 'Alleen de woordenschat is beperkt; het gezinsleven is verder onveranderd.',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 0.5, clinicalReasoning: 0.5 },
          delayedFeedback: 'De stoornis is herkend, de impact op gesprekken thuis is onderschat.',
          educationalRationale:
            'ICF vraagt om activiteit en participatie, niet alleen om functies.',
        },
        {
          id: 'dl-low',
          text: 'Erik kan niet meer zelfstandig wonen of beslissingen nemen.',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { historyTakingAndGoals: 0, clinicalReasoning: 0 },
          delayedFeedback:
            'Zelfstandig wonen is niet onderzocht en niet verteld. Dit is een aanname.',
          educationalRationale: 'Noteer geen zorgzwaarte die het gesprek niet onderbouwt.',
        },
        {
          id: 'dl-high',
          text: 'Gesprekken met partner en familie zijn bemoeilijkt; voorlezen aan zijn kleinzoon lukt niet.',
          quality: 'high',
          unsafe: false,
          competencyAwards: { historyTakingAndGoals: 1, clinicalReasoning: 1 },
          delayedFeedback: 'Je koppelt de taalmoeite aan concrete participatie.',
          educationalRationale:
            'Doelen worden sterker als ze in het dagelijks leven geworteld zijn.',
        },
      ],
    },
    {
      id: 'clientStrengths',
      label: 'Sterke kanten van de cliënt',
      help: 'Noem wat het gesprek wél liet zien.',
      scoredCompetencies: ['observation', 'clinicalReasoning'],
      textLabel: '',
      textRequired: false,
      choices: [
        {
          id: 'cs-high',
          text: 'Begrip voor korte zinnen, motivatie, steun van partner en duidelijke eigen doelen.',
          quality: 'high',
          unsafe: false,
          competencyAwards: { observation: 1, clinicalReasoning: 1 },
          delayedFeedback: 'Sterke kanten zijn benoemd zonder de hulpvraag weg te poetsen.',
          educationalRationale: 'Krachtgerichte observatie hoort in elke intake.',
        },
        {
          id: 'cs-partial',
          text: 'Erik is vriendelijk; verdere sterke kanten zijn nog niet te bepalen.',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { observation: 0.5, clinicalReasoning: 0.5 },
          delayedFeedback:
            'Voorzichtigheid is prima, maar begrip en motivatie waren wél zichtbaar.',
          educationalRationale: 'Onderzoek ook wat lukt, niet alleen wat faalt.',
        },
        {
          id: 'cs-low',
          text: 'Er zijn geen bruikbare sterke kanten; de communicatie is globaal uitgevallen.',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { observation: 0, clinicalReasoning: 0 },
          delayedFeedback: 'Dit dehumaniseert en is in strijd met de observaties.',
          educationalRationale:
            'Geen sterke kanten zien is zelden een klinische conclusie na één gesprek.',
        },
      ],
    },
    {
      id: 'firstObjective',
      label: 'Eerste behandeldoel',
      help: 'Kies een doel dat past bij deze fase, drie weken na de beroerte.',
      scoredCompetencies: ['clinicalReasoning'],
      textLabel: 'Korte formulering in eigen woorden (verplicht, telt niet mee in de score)',
      textRequired: true,
      choices: [
        {
          id: 'fo-low',
          text: 'Geen logopedie nodig; spontaan herstel is voldoende.',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { clinicalReasoning: 0 },
          delayedFeedback:
            'Er is een duidelijke hulpvraag. Geen behandeling voorstellen is niet passend.',
          educationalRationale: 'Een intake zonder vervolg laat de cliënt en naasten alleen.',
        },
        {
          id: 'fo-high',
          text: 'Functionele communicatie met naasten ondersteunen, met voorlezen als betekenisvol doel.',
          quality: 'high',
          unsafe: false,
          competencyAwards: { clinicalReasoning: 1 },
          delayedFeedback: 'Het doel is participatiegericht en herkenbaar voor Erik.',
          educationalRationale:
            'Start bij wat de cliënt het meest wil kunnen in het dagelijks leven.',
        },
        {
          id: 'fo-partial',
          text: 'Intensieve benoemtraining zonder koppeling aan een participatiedoel.',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { clinicalReasoning: 0.5 },
          delayedFeedback:
            'Woordvinding mag geoefend worden, maar niet los van betekenisvolle situaties.',
          educationalRationale: 'Stoornisgerichte oefening is een middel, geen doel op zich.',
        },
      ],
    },
    {
      id: 'nextStep',
      label: 'Aanbevolen vervolgstap',
      help: 'Blijf binnen de logopedische rol.',
      scoredCompetencies: ['clinicalReasoning', 'empathyAndProfessionalBehaviour'],
      textLabel: '',
      textRequired: false,
      choices: [
        {
          id: 'ns-high',
          text: 'Vervolgafspraak plannen en, met toestemming van Erik, de partner betrekken.',
          quality: 'high',
          unsafe: false,
          competencyAwards: { clinicalReasoning: 1, empathyAndProfessionalBehaviour: 1 },
          delayedFeedback: 'Een gezamenlijk vervolg respecteert autonomie en het systeem thuis.',
          educationalRationale: 'Toestemming vragen voordat je naasten betrekt is professioneel.',
        },
        {
          id: 'ns-partial',
          text: 'Alleen huiswerkoefeningen meegeven en de intake afronden zonder vervolgafspraak.',
          quality: 'partial',
          unsafe: false,
          competencyAwards: { clinicalReasoning: 0.5, empathyAndProfessionalBehaviour: 0.5 },
          delayedFeedback: 'Oefeningen kunnen helpen, maar zonder vervolg ontbreekt begeleiding.',
          educationalRationale: 'Drie weken na CVA is monitoring en afstemming nodig.',
        },
        {
          id: 'ns-low',
          text: 'Zelf een MRI aanvragen en de taaldiagnose medisch vastleggen.',
          quality: 'inappropriate',
          unsafe: true,
          competencyAwards: { clinicalReasoning: 0, empathyAndProfessionalBehaviour: 0 },
          delayedFeedback: 'Beeldvorming aanvragen valt buiten deze logopedische rol.',
          educationalRationale: 'Blijf binnen de scope: communicatie, doelen en samenwerking.',
        },
      ],
    },
  ],
};
