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
  help: 'Help', guideTitle: 'Mastering Guide', guideIntro: 'You do not need to be a mastering engineer. RQS keeps the selected destination inside a validated delivery range and explains what each control means. “Louder” is not automatically “better”.', close: 'Close', whyBlocked: 'Why is rendering blocked?', ready: 'Settings are valid and ready to render.', previewRelative: 'Preview time is relative: 00:00 means the beginning of the generated preview, not the beginning of the whole song.', previewSourceWindow: 'Source window', invalidLufs: (min, max) => `Requested loudness must stay between ${min} and ${max} LUFS for this destination.`, policyDefault: 'Recommended: use the policy default unless you have a specific delivery requirement.', currentTarget: 'Target for the selected destination',
  controls: {
    ab: { title: 'A/B comparison', short: 'Switch between the original and the current master without changing the playback position.', details: 'A/B lets you judge what mastering changed. Compare tone, punch, stereo image and unwanted artifacts. A louder signal can seem better simply because it is louder, so use A/B as a listening aid rather than a score.' },
    destination: { title: 'Destination', short: 'Chooses the delivery loudness and True Peak policy for Streaming, Club or Festival.', details: 'Different playback environments need different headroom and loudness. Streaming services commonly normalize playback, while club and festival masters can use higher loudness targets. RQS uses the backend policy for the selected destination instead of one universal number.' },
    platform: { title: 'Streaming platform', short: 'Selects the delivery policy used for the intended streaming service.', details: 'Platforms can use different normalization and codec workflows. The platform setting changes delivery limits such as target LUFS and True Peak. It does not guarantee that every listener will hear exactly that loudness because playback normalization is controlled by the platform.' },
    atmosphere: { title: 'Atmosphere', short: 'A mastering profile label. In the current validated V2 build all Atmospheres share the same compatibility DSP sound.', details: 'Thunder, Clear Sky, Sunroof and Aurora are already part of the product contract, but the currently validated V2 engine intentionally routes them through one compatibility DSP path. Distinct Atmosphere voicings require a later real-audio validation stage.' },
    intensity: { title: 'Character Intensity', short: 'Controls how strongly the validated V2 character processing is applied. 0% keeps delivery processing only.', details: '0% means delivery-only: loudness and True Peak finalization without the creative V2 character path. Higher values progressively increase the validated character processing. 100% is the full current V2 character amount; it is not automatically the best choice for every song.' },
    lufs: { title: 'LUFS loudness', short: 'LUFS measures perceived loudness. More negative values are quieter; values closer to 0 are louder.', details: 'LUFS is not a quality score. The correct value depends on the destination. RQS blocks values outside the validated range instead of assuming that “closer to zero” is better.' },
    truePeak: { title: 'True Peak (dBTP)', short: 'Estimates inter-sample peaks that can appear during playback or lossy encoding.', details: 'A master can stay below 0 dBFS at individual samples and still create higher reconstructed peaks in a DAC or codec. A negative True Peak ceiling keeps safety headroom. Closer to 0 dBTP means less headroom, not better quality.' },
    preview: { title: '15-second Preview', short: 'Renders the highlighted 15-second waveform region so you can check the settings before a full master.', details: 'Drag the highlighted region on the full-track waveform to choose the source excerpt. The Preview player uses a relative 00:00–00:15 timeline, while the source-window label shows the exact position in the complete song. Changing settings or moving the region invalidates the old Preview.' },
  },
};

const PT: MasteringEducationCopy = {
  help: 'Ajuda', guideTitle: 'Guia de Masterização', guideIntro: 'Você não precisa ser engenheiro de masterização. O RQS mantém o destino selecionado dentro de uma faixa de entrega validada e explica cada controle. “Mais alto” não significa automaticamente “melhor”.', close: 'Fechar', whyBlocked: 'Por que o render está bloqueado?', ready: 'Configuração válida e pronta para renderizar.', previewRelative: 'O tempo da prévia é relativo: 00:00 é o início da prévia gerada, não o início da música inteira.', previewSourceWindow: 'Trecho de origem', invalidLufs: (min, max) => `O loudness solicitado deve ficar entre ${min} e ${max} LUFS para este destino.`, policyDefault: 'Recomendado: use o padrão da política, a menos que exista uma exigência específica de entrega.', currentTarget: 'Alvo do destino selecionado',
  controls: {
    ab: { title: 'Comparação A/B', short: 'Alterna entre o original e o master atual sem perder a posição de reprodução.', details: 'Use A/B para ouvir mudanças de timbre, impacto, imagem estéreo e possíveis artefatos. Um sinal apenas mais alto pode parecer melhor, portanto A/B é uma ferramenta de escuta e não uma nota de qualidade.' },
    destination: { title: 'Destino', short: 'Define a política de loudness e True Peak para Streaming, Club ou Festival.', details: 'Ambientes diferentes precisam de headroom e loudness diferentes. Streaming costuma aplicar normalização; Club e Festival podem usar alvos mais altos. O RQS usa a política real do backend para cada destino.' },
    platform: { title: 'Plataforma de streaming', short: 'Seleciona a política de entrega da plataforma pretendida.', details: 'Serviços podem usar normalização e codecs diferentes. A escolha da plataforma altera limites como LUFS e True Peak, mas o volume final percebido pelo ouvinte ainda depende da reprodução e normalização do serviço.' },
    atmosphere: { title: 'Atmosphere', short: 'Rótulo de perfil. Na versão V2 validada atual, todas as Atmospheres compartilham o mesmo DSP de compatibilidade.', details: 'Thunder, Clear Sky, Sunroof e Aurora já fazem parte do contrato do produto, mas a V2 validada usa deliberadamente uma única rota DSP de compatibilidade. Perfis sonoros realmente diferentes serão uma etapa posterior com validação em áudio real.' },
    intensity: { title: 'Character Intensity', short: 'Controla quanto do processamento de caráter V2 é aplicado. 0% mantém apenas a entrega.', details: '0% executa apenas loudness e True Peak de entrega, sem o caminho criativo V2. Valores maiores aumentam progressivamente o caráter validado. 100% é a intensidade total atual, não uma garantia de que será melhor para toda música.' },
    lufs: { title: 'Loudness LUFS', short: 'LUFS mede loudness percebido. Valores mais negativos são mais baixos; mais próximos de 0 são mais altos.', details: 'LUFS não é nota de qualidade. O valor correto depende do destino, e o RQS bloqueia valores fora da faixa validada.' },
    truePeak: { title: 'True Peak (dBTP)', short: 'Estima picos entre amostras que podem aparecer na reprodução ou após codecs com perdas.', details: 'Mesmo sem samples em 0 dBFS podem surgir picos reconstruídos mais altos. Um teto negativo mantém margem de segurança. Mais perto de 0 dBTP significa menos headroom, não melhor qualidade.' },
    preview: { title: 'Prévia de 15 segundos', short: 'Renderiza a região destacada de 15 segundos da forma de onda antes do master completo.', details: 'Arraste a região destacada na forma de onda da faixa completa para escolher o trecho. O player da prévia usa uma linha do tempo relativa, enquanto o trecho de origem mostra a posição exata na música. Alterar configurações ou mover a região invalida a prévia anterior.' },
  },
};

const PL: MasteringEducationCopy = {
  help: 'Pomoc', guideTitle: 'Przewodnik po masteringu', guideIntro: 'Nie musisz znać techniki masteringu. RQS pilnuje zwalidowanego zakresu dla wybranego zastosowania i wyjaśnia znaczenie ustawień. „Głośniej” nie oznacza automatycznie „lepiej”.', close: 'Zamknij', whyBlocked: 'Dlaczego rendering jest zablokowany?', ready: 'Ustawienia są prawidłowe i gotowe do renderingu.', previewRelative: 'Czas Preview jest względny: 00:00 oznacza początek wygenerowanego fragmentu, a nie początek całego utworu.', previewSourceWindow: 'Fragment źródłowy', invalidLufs: (min, max) => `Żądana głośność musi mieścić się w zakresie ${min} do ${max} LUFS dla tego zastosowania.`, policyDefault: 'Zalecenie: pozostaw wartość domyślną, jeśli nie masz konkretnego wymagania dostarczenia.', currentTarget: 'Cel dla wybranego zastosowania',
  controls: {
    ab: { title: 'Porównanie A/B', short: 'Przełącza Oryginał i aktualny Master bez zmiany miejsca odsłuchu.', details: 'A/B służy do oceny tego, co zmienił mastering: barwy, uderzenia, stereo oraz ewentualnych artefaktów. Głośniejszy sygnał często subiektywnie wydaje się lepszy, dlatego A/B jest pomocą odsłuchową, a nie samodzielną oceną jakości.' },
    destination: { title: 'Zastosowanie / Destination', short: 'Wybiera politykę głośności i True Peak dla Streaming, Club lub Festival.', details: 'Inne warunki odsłuchu wymagają innej głośności i zapasu. RQS korzysta z polityki backendu dla konkretnego zastosowania.' },
    platform: { title: 'Platforma streamingowa', short: 'Wybiera zasady dostarczenia dla planowanej platformy.', details: 'Serwisy mogą stosować różną normalizację oraz kodowanie. Ustawienie platformy dobiera właściwy zakres LUFS i limit True Peak.' },
    atmosphere: { title: 'Atmosphere', short: 'Etykieta profilu. W obecnej zwalidowanej V2 wszystkie Atmospheres korzystają z tego samego kompatybilnego toru DSP.', details: 'Thunder, Clear Sky, Sunroof i Aurora są częścią kontraktu produktu, ale aktualna V2 celowo kieruje je przez jeden zwalidowany tor kompatybilności. Osobne charakterystyki wymagają późniejszej walidacji na realnych utworach.' },
    intensity: { title: 'Character Intensity', short: 'Określa siłę zwalidowanego charakteru V2. 0% pozostawia tylko processing dostarczeniowy.', details: 'Przy 0% działa wyłącznie finalizacja głośności i True Peak. Wyższa wartość stopniowo zwiększa zwalidowane przetwarzanie.' },
    lufs: { title: 'Głośność LUFS', short: 'LUFS opisuje odczuwaną głośność. Im bardziej ujemna liczba, tym ciszej; im bliżej 0, tym głośniej.', details: 'LUFS nie jest oceną jakości. Prawidłowa wartość zależy od zastosowania, a RQS blokuje wartości poza zwalidowanym zakresem.' },
    truePeak: { title: 'True Peak (dBTP)', short: 'Szacuje szczyty między próbkami, które mogą pojawić się przy odtwarzaniu lub kodowaniu stratnym.', details: 'Nawet gdy żadna próbka nie przekracza 0 dBFS, po rekonstrukcji mogą powstać wyższe szczyty. Ujemny limit True Peak daje zapas bezpieczeństwa.' },
    preview: { title: 'Preview 15 sekund', short: 'Renderuje podświetlony 15-sekundowy zakres waveformu przed pełnym masteringiem.', details: 'Przeciągnij podświetlony zakres na waveformie całego utworu. Player Preview pokazuje względne 00:00–00:15, a etykieta źródła dokładne miejsce w utworze.' },
  },
};

const FR: MasteringEducationCopy = {
  help: 'Aide', guideTitle: 'Guide de mastering', guideIntro: 'Vous n’avez pas besoin d’être ingénieur mastering. RQS maintient la destination choisie dans une plage de livraison validée et explique le rôle de chaque réglage. « Plus fort » ne signifie pas automatiquement « meilleur ».', close: 'Fermer', whyBlocked: 'Pourquoi le rendu est-il bloqué ?', ready: 'Les réglages sont valides et prêts pour le rendu.', previewRelative: 'Le temps du Preview est relatif : 00:00 correspond au début du Preview généré, pas au début du morceau complet.', previewSourceWindow: 'Extrait source', invalidLufs: (min, max) => `Le loudness demandé doit rester compris entre ${min} et ${max} LUFS pour cette destination.`, policyDefault: 'Recommandation : utilisez la valeur de la politique par défaut sauf exigence de livraison particulière.', currentTarget: 'Cible de la destination sélectionnée',
  controls: {
    ab: { title: 'Comparaison A/B', short: 'Passe de l’original au master actuel sans modifier la position de lecture.', details: 'La comparaison A/B permet d’évaluer les changements de timbre, d’impact, d’image stéréo et les éventuels artefacts. Un signal plus fort peut sembler meilleur uniquement parce qu’il est plus fort : utilisez A/B comme outil d’écoute, pas comme note.' },
    destination: { title: 'Destination', short: 'Choisit la politique de loudness et de True Peak pour Streaming, Club ou Festival.', details: 'Chaque environnement de lecture nécessite un headroom et un loudness adaptés. RQS applique la politique backend de la destination sélectionnée plutôt qu’une valeur universelle.' },
    platform: { title: 'Plateforme de streaming', short: 'Sélectionne la politique de livraison adaptée au service de streaming visé.', details: 'Les plateformes peuvent utiliser des processus de normalisation et des codecs différents. Ce réglage choisit les limites de livraison, notamment la cible LUFS et le True Peak.' },
    atmosphere: { title: 'Atmosphere', short: 'Libellé de profil de mastering. Dans la V2 validée actuelle, toutes les Atmospheres partagent le même traitement DSP de compatibilité.', details: 'Thunder, Clear Sky, Sunroof et Aurora font partie du contrat produit, mais la V2 actuellement validée les route volontairement vers un seul chemin DSP de compatibilité. Des signatures sonores distinctes nécessiteront une validation audio ultérieure.' },
    intensity: { title: 'Character Intensity', short: 'Contrôle l’intensité du traitement de caractère V2 validé. 0 % conserve uniquement le traitement de livraison.', details: 'À 0 %, seuls le loudness et la finalisation True Peak sont appliqués. Les valeurs supérieures augmentent progressivement le caractère V2 validé. 100 % n’est pas automatiquement le meilleur choix pour chaque morceau.' },
    lufs: { title: 'Loudness LUFS', short: 'LUFS mesure le loudness perçu. Les valeurs plus négatives sont plus faibles ; les valeurs plus proches de 0 sont plus fortes.', details: 'LUFS n’est pas une note de qualité. La valeur appropriée dépend de la destination et RQS bloque les valeurs hors de la plage validée.' },
    truePeak: { title: 'True Peak (dBTP)', short: 'Estime les pics inter-échantillons pouvant apparaître pendant la lecture ou l’encodage avec pertes.', details: 'Un master peut rester sous 0 dBFS au niveau des échantillons et produire des pics reconstruits plus élevés. Une limite True Peak négative conserve une marge de sécurité.' },
    preview: { title: 'Preview de 15 secondes', short: 'Rend la zone de 15 secondes surlignée afin de vérifier les réglages avant le master complet.', details: 'Déplacez la zone surlignée sur la waveform complète pour choisir l’extrait source. Le lecteur Preview utilise une timeline relative 00:00–00:15, tandis que l’étiquette de source indique la position exacte dans le morceau.' },
  },
};

export function masteringEducation(lang: UiLanguage): MasteringEducationCopy {
  if (lang === 'pt') return PT;
  if (lang === 'pl') return PL;
  if (lang === 'fr') return FR;
  return EN;
}
