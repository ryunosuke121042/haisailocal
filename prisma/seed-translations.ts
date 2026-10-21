// デモ用の掲載文の訳（韓国語・フランス語・スペイン語）。英語・中国語は seed.ts に並べて書いている。
// 翻訳サービスを使わずに、6言語すべてでデモ店舗を表示するため（キーは日本語の原文）
export const MORE: Record<string, { ko: string; fr: string; es: string }> = {
  '森田茶園 茶摘みと抹茶づくり体験': {
    ko: '모리타 차밭: 찻잎 따기와 말차 만들기 체험',
    fr: 'Ferme de thé Morita : cueillette du thé et fabrication de matcha',
    es: 'Granja de té Morita: recolección de té y elaboración de matcha',
  },
  '宇治で三代続く小さな茶農家です。茶畑で茶摘みをしたあと、石臼で抹茶をひき、自分でたてて季節の和菓子といただきます。家族だけで営んでいます。英語は少しだけですが、身ぶりで楽しく伝えます。': {
    ko: '우지에서 3대째 이어 온 작은 차 농가입니다. 차밭에서 찻잎을 딴 뒤 맷돌로 말차를 갈고, 직접 저어서 제철 화과자와 함께 즐깁니다. 가족끼리만 운영하고 있습니다. 영어는 조금밖에 못 하지만 몸짓으로 즐겁게 전해 드려요.',
    fr: "Une petite ferme de thé familiale à Uji, tenue par la troisième génération. Après la cueillette dans le champ, vous moulez le matcha à la meule de pierre, le fouettez vous-même et le dégustez avec une pâtisserie japonaise de saison. Tenue uniquement par notre famille. Nous parlons un peu anglais et vous expliquerons volontiers par gestes.",
    es: 'Una pequeña granja familiar de té en Uji, ya en su tercera generación. Tras recoger hojas de té en el campo, molerás matcha con un molino de piedra, lo batirás tú mismo y lo disfrutarás con un dulce japonés de temporada. La llevamos solo en familia. Hablamos un poco de inglés y te lo explicaremos encantados con gestos.',
  },
  '家族だけで営んでいます。英語は少しだけですが、身ぶりで楽しく伝えます。': {
    ko: '가족끼리만 운영하고 있습니다. 영어는 조금밖에 못 하지만 몸짓으로 즐겁게 전해 드려요.',
    fr: 'Tenue uniquement par notre famille. Nous parlons un peu anglais et vous expliquerons volontiers par gestes.',
    es: 'La llevamos solo en familia. Hablamos un poco de inglés y te lo explicaremos encantados con gestos.',
  },
  '汚れてもよい服と歩きやすい靴': {
    ko: '더러워져도 되는 옷과 걷기 편한 신발',
    fr: 'Des vêtements qui peuvent se salir et des chaussures confortables',
    es: 'Ropa que pueda ensuciarse y calzado cómodo',
  },
  JR宇治駅: { ko: 'JR 우지역', fr: 'Gare JR d’Uji', es: 'Estación JR de Uji' },
  '汚れてもよい服、帽子': {
    ko: '더러워져도 되는 옷, 모자',
    fr: 'Des vêtements qui peuvent se salir, et un chapeau',
    es: 'Ropa que pueda ensuciarse y un sombrero',
  },
  季節の和菓子: { ko: '제철 화과자', fr: 'Pâtisserie japonaise de saison', es: 'Dulce japonés de temporada' },
  抹茶: { ko: '말차', fr: 'Matcha', es: 'Matcha' },
  '焼き鳥 とり吉': { ko: '야키토리 도리키치', fr: 'Yakitori Torikichi', es: 'Yakitori Torikichi' },
  '河原町の路地裏にある、地元の会社員でにぎわう焼き鳥の居酒屋です。大将が炭火で一本ずつ焼きます。常連さんが多いですが、はじめての方も大歓迎です。': {
    ko: '가와라마치 뒷골목에 있는, 현지 직장인들로 북적이는 야키토리 이자카야입니다. 주인장이 숯불에 꼬치를 하나씩 굽습니다. 단골이 많지만 처음 오시는 분도 대환영입니다.',
    fr: "Un izakaya de yakitori dans une ruelle de Kawaramachi, animé par les employés du quartier. Le patron grille chaque brochette sur la braise. Beaucoup d'habitués, mais les nouveaux venus sont les bienvenus.",
    es: 'Una izakaya de yakitori en un callejón de Kawaramachi, llena de oficinistas del barrio. El dueño asa cada brocheta al carbón. Hay muchos clientes habituales, pero quienes vienen por primera vez son muy bienvenidos.',
  },
  '常連さんが多いですが、はじめての方も大歓迎です。ねぎ抜きなどもお気軽にどうぞ。': {
    ko: '단골이 많지만 처음 오시는 분도 대환영입니다. 파 빼기 같은 요청도 편하게 말씀해 주세요.',
    fr: "Beaucoup d'habitués, mais les nouveaux venus sont les bienvenus. N'hésitez pas à demander sans oignon vert, par exemple.",
    es: 'Hay muchos clientes habituales, pero quienes vienen por primera vez son muy bienvenidos. Pide sin cebolleta u otros cambios con total confianza.',
  },
  阪急京都河原町駅: { ko: '한큐 교토가와라마치역', fr: 'Gare Hankyu de Kyoto-Kawaramachi', es: 'Estación Hankyu de Kioto-Kawaramachi' },
  もも塩: { ko: '닭다리살 소금구이', fr: 'Cuisse de poulet au sel', es: 'Muslo de pollo con sal' },
  つくね: { ko: '닭고기 완자', fr: 'Boulette de poulet', es: 'Albóndiga de pollo' },
  だし巻き: { ko: '다시마키 달걀말이', fr: 'Omelette roulée au dashi', es: 'Tortilla enrollada con dashi' },
  '酒蔵の町・伏見を歩く朝さんぽ': {
    ko: '술도가의 마을 후시미를 걷는 아침 산책',
    fr: 'Promenade matinale à Fushimi, la ville des brasseries de saké',
    es: 'Paseo matutino por Fushimi, la ciudad de las bodegas de sake',
  },
  '生まれも育ちも伏見のガイドが、観光バスが来ない路地や井戸、町の銭湯の前などを案内します。最後に地元の酒蔵の売店に寄ります（試飲は任意）。': {
    ko: '후시미에서 나고 자란 가이드가 관광버스가 오지 않는 골목길과 우물, 동네 목욕탕 앞 등을 안내합니다. 마지막에는 현지 술도가의 매점에 들릅니다(시음은 선택).',
    fr: "Un guide né et élevé à Fushimi vous montre les ruelles, les puits et le bain public du quartier, là où les cars de touristes ne vont jamais. Nous terminons à la boutique d'une brasserie de saké locale (dégustation facultative).",
    es: 'Un guía nacido y criado en Fushimi te muestra callejones, pozos y el baño público del barrio, donde nunca llegan los autobuses turísticos. Terminamos en la tienda de una bodega de sake local (la cata es opcional).',
  },
  歩きやすい靴: { ko: '걷기 편한 신발', fr: 'Des chaussures de marche confortables', es: 'Calzado cómodo para caminar' },
  京阪中書島駅: { ko: '게이한 주쇼지마역', fr: 'Gare Keihan de Chushojima', es: 'Estación Keihan de Chushojima' },
  京阪中書島駅の改札前: {
    ko: '게이한 주쇼지마역 개찰구 앞',
    fr: 'Devant les portiques de la gare Keihan de Chushojima',
    es: 'Frente a los torniquetes de la estación Keihan de Chushojima',
  },
  '駅 → 運河沿いの道 → 井戸 → 銭湯 → 酒蔵の売店': {
    ko: '역 → 운하 옆길 → 우물 → 대중목욕탕 → 술도가 매점',
    fr: 'Gare → chemin le long du canal → vieux puits → bain public → boutique de la brasserie de saké',
    es: 'Estación → camino junto al canal → pozo antiguo → baño público → tienda de la bodega de sake',
  },
  喫茶ナジム: { ko: '킷사 나짐(카페)', fr: 'Kissa Najm (café)', es: 'Kissa Najm (cafetería)' },
  '大阪・中崎町の古い長屋で営む小さな喫茶店です。予約は受けていないので、来る前に何でもチャットで聞いてください。': {
    ko: '오사카 나카자키초의 오래된 나가야에서 운영하는 작은 카페입니다. 예약은 받지 않으니 오시기 전에 궁금한 점은 채팅으로 물어봐 주세요.',
    fr: "Un petit café installé dans une vieille maison en rangée à Nakazakicho, Osaka. Nous ne prenons pas de réservations : posez-nous toutes vos questions dans la messagerie avant de venir.",
    es: 'Una pequeña cafetería en una antigua casa adosada de Nakazakicho, Osaka. No aceptamos reservas, así que pregúntanos lo que quieras por el chat antes de venir.',
  },
  '豚肉を使っていません。アルコールも出していません。': {
    ko: '돼지고기를 사용하지 않습니다. 술도 제공하지 않습니다.',
    fr: "Nous n'utilisons pas de porc. Nous ne servons pas non plus d'alcool.",
    es: 'No usamos cerdo. Tampoco servimos alcohol.',
  },
  大阪メトロ中崎町駅: { ko: '오사카 메트로 나카자키초역', fr: 'Gare de Nakazakicho (métro d’Osaka)', es: 'Estación Nakazakicho (metro de Osaka)' },
  'はい、スニーカーで大丈夫です。畑は少しぬかるむことがあります。': {
    ko: '네, 운동화로 괜찮습니다. 밭이 조금 질척할 수 있어요.',
    fr: 'Oui, des baskets conviennent. Le champ peut être un peu boueux.',
    es: 'Sí, las zapatillas están bien. El campo puede estar un poco embarrado.',
  },
};
