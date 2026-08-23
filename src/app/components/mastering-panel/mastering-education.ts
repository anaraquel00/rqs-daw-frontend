import { UiLanguage } from '../../services/language.service';

export type MasteringHelpTopic =
  | 'ab'
  | 'destination'
  | 'platform'
  | 'atmosphere'
  | 'intensity'
  | 'lufs'
  | 'truePeak'
  | 'preview';

export interface MasteringHelpEntry {
  title: string;
  short: string;
  details: string;
}

export interface MasteringEducationCopy {
  help: string;
  guideTitle: string;
  guideIntro: string;
  close: string;
  whyBlocked: string;
  ready: string;
  previewRelative: string;
  previewSourceWindow: string;
  invalidLufs: (min: number, max: number) => string;
  policyDefault: string;
  currentTarget: string;
  controls: Record<MasteringHelpTopic, MasteringHelpEntry>;
}

const EN: MasteringEducationCopy = {
  help: 'Help',
  guideTitle: 'Mastering Guide',
  guideIntro:
    'You do not need to be a mastering engineer. RQS keeps the selected destination inside a validated delivery range and explains what each control means. “Louder” is not automatically “better”.',
  close: 'Close',
  whyBlocked: 'Why is rendering blocked?',
  ready: 'Settings are valid and ready to render.',
  previewRelative: 'Preview time is relative: 00:00 means the beginning of the generated preview, not the beginning of the whole song.',
  previewSourceWindow: 'Source window',
  invalidLufs: (min, max) => `Requested loudness must stay between ${min} and ${max} LUFS for this destination.`,
  policyDefault: 'Recommended: use the policy default unless you have a specific delivery requirement.',
  currentTarget: 'Target for the selected destination',
  controls: {
    ab: {
      title: 'A/B comparison',
      short: 'Switch between the original and the current master without changing the playback position.',
      details:
        'A/B lets you judge what mastering changed. Compare tone, punch, stereo image and unwanted artifacts. A louder signal can seem better simply because it is louder, so use A/B as a listening aid rather than a score.',
    },
    destination: {
      title: 'Destination',
      short: 'Chooses the delivery loudness and True Peak policy for Streaming, Club or Festival.',
      details:
        'Different playback environments need different headroom and loudness. Streaming services commonly normalize playback, while club and festival masters can use higher loudness targets. RQS uses the backend policy for the selected destination instead of one universal number.',
    },
    platform: {
      title: 'Streaming platform',
      short: 'Selects the delivery policy used for the intended streaming service.',
      details:
        'Platforms can use different normalization and codec workflows. The platform setting changes delivery limits such as target LUFS and True Peak. It does not guarantee that every listener will hear exactly that loudness because playback normalization is controlled by the platform.',
    },
    atmosphere: {
      title: 'Atmosphere',
      short: 'A mastering profile label. In the current validated V2 build all Atmospheres share the same compatibility DSP sound.',
      details:
        'Thunder, Clear Sky, Sunroof and Aurora are already part of the product contract, but the currently validated V2 engine intentionally routes them through one compatibility DSP path. Do not interpret the labels as four different sonic processors yet. Distinct Atmosphere voicings require a later real-audio validation stage.',
    },
    intensity: {
      title: 'Character Intensity',
      short: 'Controls how strongly the validated V2 character processing is applied. 0% keeps delivery processing only.',
      details:
        '0% means delivery-only: loudness and True Peak finalization without the creative V2 character path. Higher values progressively increase the validated character processing. 100% is the full current V2 character amount; it is not automatically the best choice for every song.',
    },
    lufs: {
      title: 'LUFS loudness',
      short: 'LUFS measures perceived loudness. More negative values are quieter; values closer to 0 are louder.',
      details:
        'LUFS is not a quality score. For example, -20 LUFS is relatively quiet, -14 LUFS is a common streaming-scale target, and -1 LUFS would be extremely loud and usually unsuitable for music delivery. The correct value depends on the destination. RQS blocks values outside the validated range instead of assuming that “closer to zero” is better.',
    },
    truePeak: {
      title: 'True Peak (dBTP)',
      short: 'Estimates inter-sample peaks that can appear during playback or lossy encoding.',
      details:
        'A master can stay below 0 dBFS at individual samples and still create higher reconstructed peaks in a DAC or codec. A negative True Peak ceiling such as -1.0 dBTP keeps safety headroom. Closer to 0 dBTP means less headroom, not better quality.',
    },
    preview: {
      title: '15-second Preview',
      short: 'Renders the highlighted 15-second waveform region so you can check the settings before a full master.',
      details:
        'Drag the highlighted region on the full-track waveform to choose the source excerpt. The Preview player uses a relative 00:00–00:15 timeline, while the source-window label shows the exact position in the complete song. Changing settings or moving the region invalidates the old Preview so you never compare against stale settings.',
    },
  },
};

const PT: MasteringEducationCopy = {
  help: 'Ajuda',
  guideTitle: 'Guia de Masterização',
  guideIntro:
    'Você não precisa ser engenheiro de masterização. O RQS mantém o destino selecionado dentro de uma faixa de entrega validada e explica cada controle. “Mais alto” não significa automaticamente “melhor”.',
  close: 'Fechar',
  whyBlocked: 'Por que o render está bloqueado?',
  ready: 'Configuração válida e pronta para renderizar.',
  previewRelative: 'O tempo da prévia é relativo: 00:00 é o início da prévia gerada, não o início da música inteira.',
  previewSourceWindow: 'Trecho de origem',
  invalidLufs: (min, max) => `O loudness solicitado deve ficar entre ${min} e ${max} LUFS para este destino.`,
  policyDefault: 'Recomendado: use o padrão da política, a menos que exista uma exigência específica de entrega.',
  currentTarget: 'Alvo do destino selecionado',
  controls: {
    ab: {
      title: 'Comparação A/B',
      short: 'Alterna entre o original e o master atual sem perder a posição de reprodução.',
      details:
        'Use A/B para ouvir mudanças de timbre, impacto, imagem estéreo e possíveis artefatos. Um sinal apenas mais alto pode parecer melhor, portanto A/B é uma ferramenta de escuta e não uma nota de qualidade.',
    },
    destination: {
      title: 'Destino',
      short: 'Define a política de loudness e True Peak para Streaming, Club ou Festival.',
      details:
        'Ambientes diferentes precisam de headroom e loudness diferentes. Streaming costuma aplicar normalização; Club e Festival podem usar alvos mais altos. O RQS usa a política real do backend para cada destino.',
    },
    platform: {
      title: 'Plataforma de streaming',
      short: 'Seleciona a política de entrega da plataforma pretendida.',
      details:
        'Serviços podem usar normalização e codecs diferentes. A escolha da plataforma altera limites como LUFS e True Peak, mas o volume final percebido pelo ouvinte ainda depende da reprodução e normalização do serviço.',
    },
    atmosphere: {
      title: 'Atmosphere',
      short: 'Rótulo de perfil. Na versão V2 validada atual, todas as Atmospheres compartilham o mesmo DSP de compatibilidade.',
      details:
        'Thunder, Clear Sky, Sunroof e Aurora já fazem parte do contrato do produto, mas a V2 validada usa deliberadamente uma única rota DSP de compatibilidade. Perfis sonoros realmente diferentes serão uma etapa posterior com validação em áudio real.',
    },
    intensity: {
      title: 'Character Intensity',
      short: 'Controla quanto do processamento de caráter V2 é aplicado. 0% mantém apenas a entrega.',
      details:
        '0% executa apenas loudness e True Peak de entrega, sem o caminho criativo V2. Valores maiores aumentam progressivamente o caráter validado. 100% é a intensidade total atual, não uma garantia de que será melhor para toda música.',
    },
    lufs: {
      title: 'Loudness LUFS',
      short: 'LUFS mede loudness percebido. Valores mais negativos são mais baixos; mais próximos de 0 são mais altos.',
      details:
        'LUFS não é nota de qualidade. -20 LUFS é relativamente baixo, -14 LUFS é uma referência comum de streaming e -1 LUFS seria extremamente alto e normalmente inadequado para entrega musical. O valor correto depende do destino.',
    },
    truePeak: {
      title: 'True Peak (dBTP)',
      short: 'Estima picos entre amostras que podem aparecer na reprodução ou após codecs com perdas.',
      details:
        'Mesmo sem samples em 0 dBFS podem surgir picos reconstruídos mais altos. Um teto como -1.0 dBTP mantém margem de segurança. Mais perto de 0 dBTP significa menos headroom, não melhor qualidade.',
    },
    preview: {
      title: 'Prévia de 15 segundos',
      short: 'Renderiza a região destacada de 15 segundos da forma de onda antes do master completo.',
      details:
        'Arraste a região destacada na forma de onda da faixa completa para escolher o trecho. O player da prévia usa uma linha do tempo relativa de 00:00 a 00:15, enquanto o trecho de origem mostra a posição exata na música. Alterar configurações ou mover a região invalida a prévia anterior.',
    },
  },
};

const PL: MasteringEducationCopy = {
  help: 'Pomoc',
  guideTitle: 'Przewodnik po masteringu',
  guideIntro:
    'Nie musisz znać techniki masteringu. RQS pilnuje zwalidowanego zakresu dla wybranego zastosowania i wyjaśnia znaczenie ustawień. „Głośniej” nie oznacza automatycznie „lepiej”.',
  close: 'Zamknij',
  whyBlocked: 'Dlaczego rendering jest zablokowany?',
  ready: 'Ustawienia są prawidłowe i gotowe do renderingu.',
  previewRelative: 'Czas Preview jest względny: 00:00 oznacza początek wygenerowanego fragmentu, a nie początek całego utworu.',
  previewSourceWindow: 'Fragment źródłowy',
  invalidLufs: (min, max) => `Żądana głośność musi mieścić się w zakresie ${min} do ${max} LUFS dla tego zastosowania.`,
  policyDefault: 'Zalecenie: pozostaw wartość domyślną, jeśli nie masz konkretnego wymagania dostarczenia.',
  currentTarget: 'Cel dla wybranego zastosowania',
  controls: {
    ab: {
      title: 'Porównanie A/B',
      short: 'Przełącza Oryginał i aktualny Master bez zmiany miejsca odsłuchu.',
      details:
        'A/B służy do oceny tego, co zmienił mastering: barwy, uderzenia, stereo oraz ewentualnych artefaktów. Głośniejszy sygnał często subiektywnie wydaje się lepszy, dlatego A/B jest pomocą odsłuchową, a nie samodzielną oceną jakości.',
    },
    destination: {
      title: 'Zastosowanie / Destination',
      short: 'Wybiera politykę głośności i True Peak dla Streaming, Club lub Festival.',
      details:
        'Inne warunki odsłuchu wymagają innej głośności i zapasu. Streaming zwykle stosuje normalizację odtwarzania, a materiał klubowy i festiwalowy może mieć wyższe cele głośności. RQS korzysta z polityki backendu dla konkretnego zastosowania.',
    },
    platform: {
      title: 'Platforma streamingowa',
      short: 'Wybiera zasady dostarczenia dla planowanej platformy.',
      details:
        'Serwisy mogą stosować różną normalizację oraz kodowanie. Ustawienie platformy dobiera właściwy zakres LUFS i limit True Peak. Nie oznacza to, że każdy słuchacz usłyszy dokładnie taką głośność, ponieważ platforma może ją później znormalizować.',
    },
    atmosphere: {
      title: 'Atmosphere',
      short: 'Etykieta profilu. W obecnej zwalidowanej V2 wszystkie Atmospheres korzystają z tego samego kompatybilnego toru DSP.',
      details:
        'Thunder, Clear Sky, Sunroof i Aurora są już częścią kontraktu produktu, ale aktualna V2 celowo kieruje je przez jeden zwalidowany tor kompatybilności. Na tym etapie nie należy traktować nazw jako czterech różnych brzmień. Osobne charakterystyki będą wymagały późniejszej walidacji na wielu realnych utworach.',
    },
    intensity: {
      title: 'Character Intensity',
      short: 'Określa siłę zwalidowanego charakteru V2. 0% pozostawia tylko processing dostarczeniowy.',
      details:
        'Przy 0% działa wyłącznie finalizacja głośności i True Peak, bez kreatywnego charakteru V2. Wyższa wartość stopniowo zwiększa zwalidowane przetwarzanie. 100% oznacza pełną obecną intensywność, ale nie musi być najlepsze dla każdego utworu.',
    },
    lufs: {
      title: 'Głośność LUFS',
      short: 'LUFS opisuje odczuwaną głośność. Im bardziej ujemna liczba, tym ciszej; im bliżej 0, tym głośniej.',
      details:
        'LUFS nie jest oceną jakości. Przykładowo -20 LUFS jest stosunkowo ciche, -14 LUFS to częsta skala dla streamingu, a -1 LUFS byłoby ekstremalnie głośne i zwykle nieodpowiednie dla masteru muzycznego. Dlatego -1 nie jest „lepsze” od -14. Prawidłowa wartość zależy od zastosowania, a RQS blokuje wartości poza zwalidowanym zakresem.',
    },
    truePeak: {
      title: 'True Peak (dBTP)',
      short: 'Szacuje szczyty między próbkami, które mogą pojawić się przy odtwarzaniu lub kodowaniu stratnym.',
      details:
        'Nawet gdy żadna próbka nie przekracza 0 dBFS, po rekonstrukcji mogą powstać wyższe szczyty. Limit np. -1.0 dBTP daje zapas bezpieczeństwa. Wartość bliżej 0 oznacza mniejszy zapas, a nie wyższą jakość.',
    },
    preview: {
      title: 'Preview 15 sekund',
      short: 'Renderuje podświetlony 15-sekundowy zakres waveformu przed pełnym masteringiem.',
      details:
        'Przeciągnij podświetlony zakres na waveformie całego utworu, aby wybrać fragment. Player Preview pokazuje względne 00:00–00:15, a etykieta fragmentu źródłowego pokazuje dokładne miejsce w utworze. Zmiana ustawień lub przesunięcie zakresu unieważnia poprzedni Preview.',
    },
  },
};


const FR: MasteringEducationCopy = {
  help: 'Aide',
  guideTitle: 'Guide de mastering',
  guideIntro:
    'Vous n’avez pas besoin d’être ingénieur de mastering. RQS maintient la destination sélectionnée dans une plage de livraison validée et explique la fonction de chaque contrôle. « Plus fort » ne signifie pas automatiquement « meilleur ».',
  close: 'Fermer',
  whyBlocked: 'Pourquoi le rendu est-il bloqué ?',
  ready: 'Les réglages sont valides et prêts pour le rendu.',
  previewRelative: 'Le temps de la prévisualisation est relatif : 00:00 correspond au début de la prévisualisation générée, et non au début de la chanson complète.',
  previewSourceWindow: 'Extrait source',
  invalidLufs: (min, max) => `Le loudness demandé doit rester entre ${min} et ${max} LUFS pour cette destination.`,
  policyDefault: 'Recommandation : utilisez la valeur par défaut de la politique sauf si vous avez une exigence de livraison spécifique.',
  currentTarget: 'Cible pour la destination sélectionnée',
  controls: {
    ab: {
      title: 'Comparaison A/B',
      short: 'Bascule entre l’original et le master actuel sans modifier la position de lecture.',
      details:
        'La comparaison A/B permet d’évaluer ce que le mastering a modifié. Comparez la tonalité, l’impact, l’image stéréo et les éventuels artefacts. Un signal plus fort peut sembler meilleur simplement parce qu’il est plus fort ; utilisez donc l’A/B comme outil d’écoute, et non comme note de qualité.',
    },
    destination: {
      title: 'Destination',
      short: 'Définit la politique de loudness de livraison et de True Peak pour le Streaming, le Club ou le Festival.',
      details:
        'Les différents environnements de lecture nécessitent des marges de headroom et des niveaux de loudness différents. Les services de streaming normalisent généralement la lecture, tandis que les masters destinés au Club ou au Festival peuvent utiliser des cibles de loudness plus élevées. RQS applique la politique du backend correspondant à la destination sélectionnée au lieu d’utiliser une valeur universelle.',
    },
    platform: {
      title: 'Plateforme de streaming',
      short: 'Sélectionne la politique de livraison utilisée pour le service de streaming visé.',
      details:
        'Les plateformes peuvent utiliser des workflows de normalisation et de codec différents. Le choix de la plateforme modifie les limites de livraison, comme la cible LUFS et le True Peak. Cela ne garantit pas que chaque auditeur percevra exactement ce niveau de loudness, car la normalisation de lecture est contrôlée par la plateforme.',
    },
    atmosphere: {
      title: 'Atmosphere',
      short: 'Nom de profil de mastering. Dans la version V2 actuellement validée, toutes les Atmospheres partagent le même son DSP de compatibilité.',
      details:
        'Thunder, Clear Sky, Sunroof et Aurora font déjà partie du contrat produit, mais le moteur V2 actuellement validé les achemine volontairement vers un seul chemin DSP de compatibilité. À ce stade, il ne faut pas interpréter ces noms comme quatre processeurs sonores distincts. Des voicings Atmosphere réellement différents nécessiteront une étape ultérieure de validation sur de l’audio réel.',
    },
    intensity: {
      title: 'Intensité du caractère',
      short: 'Contrôle l’intensité avec laquelle le traitement de caractère V2 validé est appliqué. 0 % conserve uniquement le traitement de livraison.',
      details:
        '0 % signifie livraison uniquement : finalisation du loudness et du True Peak sans le chemin créatif de caractère V2. Des valeurs plus élevées augmentent progressivement le traitement de caractère validé. 100 % correspond à l’intensité complète actuelle de V2 ; ce n’est pas automatiquement le meilleur choix pour chaque morceau.',
    },
    lufs: {
      title: 'Loudness LUFS',
      short: 'Le LUFS mesure le loudness perçu. Les valeurs plus négatives sont plus faibles ; les valeurs plus proches de 0 sont plus fortes.',
      details:
        'Le LUFS n’est pas une note de qualité. Par exemple, -20 LUFS est relativement faible, -14 LUFS est une cible courante à l’échelle du streaming et -1 LUFS serait extrêmement fort et généralement inadapté à une livraison musicale. La valeur correcte dépend de la destination. RQS bloque les valeurs hors de la plage validée au lieu de supposer que « plus proche de zéro » signifie « meilleur ».',
    },
    truePeak: {
      title: 'True Peak (dBTP)',
      short: 'Estime les pics inter-échantillons pouvant apparaître pendant la lecture ou après un encodage avec pertes.',
      details:
        'Un master peut rester sous 0 dBFS au niveau des échantillons individuels et produire malgré tout des pics reconstruits plus élevés dans un DAC ou un codec. Un plafond de True Peak négatif, par exemple -1.0 dBTP, conserve une marge de sécurité. Une valeur plus proche de 0 dBTP signifie moins de headroom, et non une meilleure qualité.',
    },
    preview: {
      title: 'Prévisualisation de 15 secondes',
      short: 'Effectue le rendu de la région de 15 secondes mise en évidence dans la forme d’onde afin de vérifier les réglages avant un master complet.',
      details:
        'Faites glisser la région mise en évidence sur la forme d’onde de la piste complète pour choisir l’extrait source. Le lecteur de prévisualisation utilise une timeline relative de 00:00 à 00:15, tandis que l’étiquette de l’extrait source indique la position exacte dans la chanson complète. Toute modification des réglages ou déplacement de la région invalide l’ancienne prévisualisation afin d’éviter toute comparaison avec des paramètres obsolètes.',
    },
  },
};

export function masteringEducation(lang: UiLanguage): MasteringEducationCopy {
  if (lang === 'pt') return PT;
  if (lang === 'pl') return PL;
  if (lang === 'fr') return FR;
  return EN;
}
