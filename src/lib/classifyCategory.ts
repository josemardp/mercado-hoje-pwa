// Classificação local (sem rede, sem IA) do que o usuário digita na lista
// de Compras: devolve a categoria E o emoji do produto.
//
// Duas decisões de desenho que resolvem os problemas da versão anterior:
//
// 1. Categoria e emoji saem da MESMA entrada do dicionário. Antes o emoji
//    vinha de uma tabela por categoria, então todo item de mercearia era
//    🛒, todo item de casa era 🧻 e todo desconhecido era 📦 — nenhum
//    produto tinha cara própria na lista.
//
// 2. O casamento é por PALAVRA INTEIRA e a expressão mais específica
//    vence. Antes era `nome.includes(palavra)`, que classificava
//    "salsicha" como bebida (contém "cha"), "luva" como fruta (contém
//    "uva"), "aromatizante" como fruta (contém "roma") e "creme de leite"
//    como produto de limpeza (contém "creme").

export type CategoryKey = 'frutas' | 'bebidas' | 'mercearia' | 'casa' | 'outros';

export interface ClassificationResult {
  category: string;
  emoji: string;
  emojiName: string;
}

interface Entry {
  emoji: string;
  /** Nome legível do que o emoji representa (usado em mensagens). */
  label: string;
  category: CategoryKey;
  /** Sinônimos e variações que apontam pra esta entrada. */
  terms: string[];
}

// Emoji de último recurso, por categoria — só chega aqui o que o
// dicionário não reconheceu mas alguma pista genérica classificou.
const CATEGORY_FALLBACK: Record<CategoryKey, { emoji: string; label: string }> = {
  frutas: { emoji: '🍎', label: 'hortifrúti' },
  bebidas: { emoji: '🥤', label: 'bebida' },
  mercearia: { emoji: '🛒', label: 'mercearia' },
  casa: { emoji: '🧴', label: 'casa e higiene' },
  outros: { emoji: '📦', label: 'item' },
};

// ─────────────────────────────────────────────────────────────────────
// Normalização
// ─────────────────────────────────────────────────────────────────────

// Palavras que não ajudam a identificar o produto e atrapalham o
// casamento por expressão ("creme de leite" vs "creme leite").
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'para', 'pra', 'pro',
  'a', 'o', 'as', 'os', 'um', 'uma', 'em', 'no', 'na', 'ao', 'tipo', 'sabor',
]);

// Embalagem e medida: "arroz 5kg tipo 1", "2 caixas de leite", "cerveja lata".
const UNITS = new Set([
  'kg', 'g', 'gr', 'grama', 'gramas', 'quilo', 'quilos', 'ml', 'l', 'lt',
  'litro', 'litros', 'un', 'und', 'unid', 'unidade', 'unidades', 'duzia',
  'pct', 'pacote', 'pacotes', 'cx', 'caixa', 'caixas', 'lata', 'latas',
  'garrafa', 'garrafas', 'saco', 'sacos', 'fardo', 'bandeja', 'pote', 'potes',
  'frasco', 'tubo', 'refil', 'sache', 'saches', 'rolo', 'rolos', 'dz',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Plural pt-BR no que basta pra uma lista de compras: "bananas" → "banana",
// "limoes" → "limao", "papeis" → "papel", "ovos" → "ovo".
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('oes')) return `${word.slice(0, -3)}ao`;
  if (word.endsWith('aes')) return `${word.slice(0, -3)}ao`;
  if (word.endsWith('ais')) return `${word.slice(0, -3)}al`;
  if (word.endsWith('eis')) return `${word.slice(0, -3)}el`;
  if (word.endsWith('ns')) return `${word.slice(0, -2)}m`;
  if (word.endsWith('res') || word.endsWith('zes') || word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): string[] {
  const raw = normalize(text).split(' ').filter(Boolean);
  const meaningful = raw.filter(w => !STOPWORDS.has(w) && !UNITS.has(w) && !/^\d+$/.test(w));
  // "2 caixas" e afins não podem esvaziar a busca: se sobrou nada, volta
  // pro texto original sem as palavras de ligação.
  const base = meaningful.length > 0 ? meaningful : raw.filter(w => !STOPWORDS.has(w));
  // "5kg", "500ml" grudados no número também são ruído.
  return base.map(w => w.replace(/^\d+(kg|g|ml|l|lt|un)$/, '')).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────
// Dicionário: cada entrada carrega emoji + categoria.
// Termos com mais de uma palavra vencem os de uma só (ver classifyLocal),
// então "creme de leite" nunca cai na entrada "creme".
// ─────────────────────────────────────────────────────────────────────

const ITEMS: Entry[] = [
  // ── Hortifrúti: frutas ──
  { emoji: '🍌', label: 'banana', category: 'frutas', terms: ['banana', 'banana prata', 'banana nanica', 'banana da terra'] },
  { emoji: '🍎', label: 'maçã', category: 'frutas', terms: ['maca', 'maca fuji', 'maca gala', 'maca verde'] },
  { emoji: '🍊', label: 'laranja', category: 'frutas', terms: ['laranja', 'laranja lima', 'laranja pera', 'mexerica', 'tangerina', 'bergamota', 'poncan', 'ponkan'] },
  { emoji: '🍋', label: 'limão', category: 'frutas', terms: ['limao', 'limao taiti', 'limao siciliano'] },
  { emoji: '🍇', label: 'uva', category: 'frutas', terms: ['uva', 'uva verde', 'uva roxa', 'uva thompson'] },
  { emoji: '🍓', label: 'morango', category: 'frutas', terms: ['morango'] },
  { emoji: '🍍', label: 'abacaxi', category: 'frutas', terms: ['abacaxi'] },
  { emoji: '🍉', label: 'melancia', category: 'frutas', terms: ['melancia'] },
  { emoji: '🍈', label: 'melão', category: 'frutas', terms: ['melao', 'mamao', 'papaia', 'goiaba', 'caju', 'maracuja', 'graviola', 'pitaya', 'carambola', 'jaca', 'siriguela', 'cupuacu'] },
  { emoji: '🥭', label: 'manga', category: 'frutas', terms: ['manga'] },
  { emoji: '🍐', label: 'pera', category: 'frutas', terms: ['pera'] },
  { emoji: '🍑', label: 'pêssego', category: 'frutas', terms: ['pessego', 'ameixa', 'nectarina', 'damasco'] },
  { emoji: '🥑', label: 'abacate', category: 'frutas', terms: ['abacate'] },
  { emoji: '🥝', label: 'kiwi', category: 'frutas', terms: ['kiwi'] },
  { emoji: '🥥', label: 'coco', category: 'frutas', terms: ['coco', 'coco seco', 'coco verde'] },
  { emoji: '🍒', label: 'cereja', category: 'frutas', terms: ['cereja', 'acerola', 'pitanga'] },
  { emoji: '🫐', label: 'frutas vermelhas', category: 'frutas', terms: ['amora', 'framboesa', 'mirtilo', 'blueberry', 'jabuticaba', 'frutas vermelhas'] },
  { emoji: '🍎', label: 'fruta', category: 'frutas', terms: ['fruta', 'romã', 'roma', 'figo', 'kiwi amarelo'] },

  // ── Hortifrúti: verduras e legumes ──
  { emoji: '🍅', label: 'tomate', category: 'frutas', terms: ['tomate', 'tomate cereja', 'tomate italiano'] },
  { emoji: '🥬', label: 'folhas', category: 'frutas', terms: ['alface', 'couve', 'rucula', 'agriao', 'espinafre', 'acelga', 'repolho', 'almeirao', 'escarola', 'chicoria', 'verdura', 'verduras', 'legume', 'legumes', 'hortifruti', 'folhas', 'beterraba', 'rabanete', 'nabo', 'quiabo', 'vagem', 'ervilha', 'ervilha fresca', 'palmito', 'broto de feijao'] },
  { emoji: '🥗', label: 'salada', category: 'frutas', terms: ['salada', 'salada pronta', 'mix de folhas'] },
  { emoji: '🥕', label: 'cenoura', category: 'frutas', terms: ['cenoura'] },
  { emoji: '🧅', label: 'cebola', category: 'frutas', terms: ['cebola', 'cebola roxa', 'alho poro'] },
  { emoji: '🧄', label: 'alho', category: 'frutas', terms: ['alho'] },
  { emoji: '🥔', label: 'batata', category: 'frutas', terms: ['batata', 'batata inglesa', 'mandioca', 'aipim', 'macaxeira', 'inhame', 'mandioquinha', 'batata baroa', 'cara'] },
  { emoji: '🍠', label: 'batata doce', category: 'frutas', terms: ['batata doce'] },
  { emoji: '🌽', label: 'milho', category: 'frutas', terms: ['milho', 'milho verde', 'espiga de milho'] },
  { emoji: '🥦', label: 'brócolis', category: 'frutas', terms: ['brocolis', 'couve flor', 'couveflor'] },
  { emoji: '🥒', label: 'pepino', category: 'frutas', terms: ['pepino', 'abobrinha', 'chuchu'] },
  { emoji: '🍆', label: 'berinjela', category: 'frutas', terms: ['berinjela'] },
  { emoji: '🫑', label: 'pimentão', category: 'frutas', terms: ['pimentao'] },
  { emoji: '🎃', label: 'abóbora', category: 'frutas', terms: ['abobora', 'jerimum', 'moranga'] },
  { emoji: '🍄', label: 'cogumelo', category: 'frutas', terms: ['cogumelo', 'champignon', 'shitake', 'shimeji'] },
  { emoji: '🌿', label: 'cheiro verde', category: 'frutas', terms: ['salsa', 'salsinha', 'cebolinha', 'coentro', 'cheiro verde', 'hortela', 'manjericao', 'alecrim', 'tomilho', 'gengibre', 'erva'] },
  { emoji: '🫒', label: 'azeitona', category: 'frutas', terms: ['azeitona'] },

  // ── Bebidas ──
  { emoji: '💧', label: 'água', category: 'bebidas', terms: ['agua', 'agua mineral', 'agua com gas', 'galao de agua'] },
  { emoji: '🥥', label: 'água de coco', category: 'bebidas', terms: ['agua de coco'] },
  { emoji: '🧃', label: 'suco', category: 'bebidas', terms: ['suco', 'suco de laranja', 'suco de uva', 'nectar', 'refresco', 'suco em po', 'tang', 'del valle', 'ades'] },
  { emoji: '🥤', label: 'refrigerante', category: 'bebidas', terms: ['refrigerante', 'refri', 'coca', 'coca cola', 'guarana', 'fanta', 'sprite', 'pepsi', 'soda', 'tonica', 'energetico', 'red bull', 'isotonico', 'gatorade', 'powerade'] },
  { emoji: '🍺', label: 'cerveja', category: 'bebidas', terms: ['cerveja', 'chopp', 'brahma', 'skol', 'heineken', 'itaipava', 'budweiser'] },
  { emoji: '🍷', label: 'vinho', category: 'bebidas', terms: ['vinho', 'vinho tinto', 'vinho branco'] },
  { emoji: '🍾', label: 'espumante', category: 'bebidas', terms: ['espumante', 'champagne', 'champanhe', 'prosecco', 'sidra'] },
  { emoji: '🥃', label: 'destilado', category: 'bebidas', terms: ['cachaca', 'pinga', 'whisky', 'uisque', 'rum', 'conhaque', 'licor', 'tequila'] },
  { emoji: '🍸', label: 'destilado', category: 'bebidas', terms: ['vodka', 'gin', 'saque'] },
  { emoji: '☕', label: 'café', category: 'bebidas', terms: ['cafe', 'cafe em po', 'po de cafe', 'cafe soluvel', 'capuccino', 'cappuccino', 'nescafe', 'melitta', 'pilao', 'tres coracoes'] },
  { emoji: '🍵', label: 'chá', category: 'bebidas', terms: ['cha', 'cha mate', 'mate', 'cha verde', 'cha de camomila', 'matte'] },
  { emoji: '🥛', label: 'leite', category: 'bebidas', terms: ['leite', 'leite integral', 'leite desnatado', 'leite semidesnatado', 'leite zero lactose', 'leite de amendoas', 'leite vegetal', 'leite de castanha', 'italac', 'piracanjuba'] },
  { emoji: '🥥', label: 'leite de coco', category: 'bebidas', terms: ['leite de coco'] },
  { emoji: '🍫', label: 'achocolatado', category: 'bebidas', terms: ['achocolatado', 'nescau', 'toddy', 'chocolate em po', 'cacau em po'] },

  // ── Mercearia: básicos ──
  { emoji: '🍚', label: 'arroz', category: 'mercearia', terms: ['arroz', 'arroz branco', 'arroz integral', 'arroz parboilizado'] },
  { emoji: '🫘', label: 'feijão', category: 'mercearia', terms: ['feijao', 'feijao carioca', 'feijao preto', 'lentilha', 'grao de bico', 'soja', 'ervilha seca'] },
  { emoji: '🍝', label: 'macarrão', category: 'mercearia', terms: ['macarrao', 'massa', 'espaguete', 'talharim', 'penne', 'parafuso', 'lasanha', 'nhoque', 'macarrao instantaneo', 'miojo'] },
  { emoji: '🌾', label: 'farinha', category: 'mercearia', terms: ['farinha', 'farinha de trigo', 'farinha de mandioca', 'farinha de rosca', 'farofa', 'trigo', 'amido de milho', 'maizena', 'tapioca', 'goma', 'aveia', 'quinoa', 'linhaca', 'chia'] },
  { emoji: '🌽', label: 'fubá', category: 'mercearia', terms: ['fuba', 'polenta', 'cuscuz', 'canjica', 'pipoca de milho'] },
  { emoji: '🥣', label: 'cereal', category: 'mercearia', terms: ['cereal', 'granola', 'sucrilhos', 'mingau', 'mucilon'] },
  { emoji: '🍬', label: 'açúcar', category: 'mercearia', terms: ['acucar', 'acucar refinado', 'acucar demerara', 'acucar mascavo', 'adocante', 'bala', 'chiclete', 'doce', 'paçoca', 'pacoca'] },
  { emoji: '🧂', label: 'sal e temperos', category: 'mercearia', terms: ['sal', 'sal grosso', 'tempero', 'temperos', 'condimento', 'caldo', 'caldo de galinha', 'knorr', 'sazon', 'pimenta do reino', 'pimenta', 'oregano', 'canela', 'cominho', 'colorau', 'acafrao', 'louro', 'noz moscada', 'curry', 'pimenta calabresa'] },
  { emoji: '🫒', label: 'azeite', category: 'mercearia', terms: ['azeite', 'azeite de oliva'] },
  { emoji: '🛢️', label: 'óleo', category: 'mercearia', terms: ['oleo', 'oleo de soja', 'oleo de girassol', 'oleo de canola', 'banha'] },
  { emoji: '🍶', label: 'vinagre', category: 'mercearia', terms: ['vinagre', 'vinagre de maca', 'vinagre balsamico', 'shoyu', 'molho de soja'] },
  { emoji: '🥫', label: 'molho e enlatado', category: 'mercearia', terms: ['molho', 'molho de tomate', 'extrato de tomate', 'massa de tomate', 'passata', 'ketchup', 'catchup', 'maionese', 'mostarda', 'barbecue', 'conserva', 'milho em conserva', 'ervilha em conserva', 'seleta', 'creme de cebola'] },
  { emoji: '🍯', label: 'mel e geleia', category: 'mercearia', terms: ['mel', 'geleia', 'melado', 'doce de leite'] },

  // ── Mercearia: laticínios, ovos e frios ──
  { emoji: '🧀', label: 'queijo', category: 'mercearia', terms: ['queijo', 'mussarela', 'mucarela', 'muçarela', 'parmesao', 'ricota', 'cheddar', 'catupiry', 'queijo ralado', 'queijo minas', 'coalho', 'requeijao', 'cream cheese', 'pao de queijo'] },
  { emoji: '🧈', label: 'manteiga', category: 'mercearia', terms: ['manteiga', 'margarina', 'qualy', 'becel'] },
  { emoji: '🥛', label: 'iogurte', category: 'mercearia', terms: ['iogurte', 'danone', 'yakult', 'leite fermentado', 'coalhada'] },
  { emoji: '🥛', label: 'leite condensado', category: 'mercearia', terms: ['leite condensado', 'creme de leite', 'leite em po', 'nata', 'chantilly', 'ninho'] },
  { emoji: '🥚', label: 'ovo', category: 'mercearia', terms: ['ovo', 'ovo caipira', 'ovo branco', 'ovo vermelho'] },
  { emoji: '🥓', label: 'frios', category: 'mercearia', terms: ['bacon', 'presunto', 'mortadela', 'salame', 'peito de peru', 'apresuntado', 'copa', 'torresmo', 'frios'] },

  // ── Mercearia: padaria e doces ──
  { emoji: '🍞', label: 'pão', category: 'mercearia', terms: ['pao', 'pao frances', 'pao de forma', 'pao integral', 'bisnaguinha', 'baguete', 'torrada', 'pao sirio', 'pao de alho', 'pao doce'] },
  { emoji: '🍪', label: 'biscoito', category: 'mercearia', terms: ['biscoito', 'bolacha', 'cream cracker', 'agua e sal', 'recheado', 'wafer', 'rosquinha', 'oreo', 'maria', 'maisena'] },
  { emoji: '🍰', label: 'bolo', category: 'mercearia', terms: ['bolo', 'mistura para bolo', 'panetone', 'torta', 'rocambole'] },
  { emoji: '🍫', label: 'chocolate', category: 'mercearia', terms: ['chocolate', 'bombom', 'brigadeiro', 'barra de cereal', 'nutella', 'creme de avela'] },
  { emoji: '🍮', label: 'sobremesa', category: 'mercearia', terms: ['gelatina', 'pudim', 'flan', 'sobremesa'] },
  { emoji: '🍨', label: 'sorvete', category: 'mercearia', terms: ['sorvete', 'picole', 'acai'] },

  // ── Mercearia: carnes e pescados ──
  { emoji: '🥩', label: 'carne', category: 'mercearia', terms: ['carne', 'carne moida', 'carne bovina', 'bife', 'picanha', 'alcatra', 'patinho', 'coxao mole', 'coxao duro', 'acem', 'maminha', 'cupim', 'fraldinha', 'contra file', 'file mignon', 'musculo', 'costela', 'costelinha', 'lombo', 'pernil', 'bisteca', 'carne de porco', 'carne suina', 'churrasco'] },
  { emoji: '🍗', label: 'frango', category: 'mercearia', terms: ['frango', 'peito de frango', 'coxa', 'sobrecoxa', 'asa de frango', 'coxinha da asa', 'file de frango', 'galinha', 'nuggets', 'empanado'] },
  { emoji: '🦃', label: 'peru', category: 'mercearia', terms: ['peru', 'chester'] },
  { emoji: '🐟', label: 'peixe', category: 'mercearia', terms: ['peixe', 'tilapia', 'salmao', 'merluza', 'bacalhau', 'sardinha', 'atum', 'pescada'] },
  { emoji: '🍤', label: 'camarão', category: 'mercearia', terms: ['camarao', 'frutos do mar', 'lula'] },
  { emoji: '🍖', label: 'linguiça', category: 'mercearia', terms: ['linguica', 'calabresa', 'almondega', 'kafta', 'pernil temperado'] },
  { emoji: '🌭', label: 'salsicha', category: 'mercearia', terms: ['salsicha', 'hot dog', 'cachorro quente'] },
  { emoji: '🍔', label: 'hambúrguer', category: 'mercearia', terms: ['hamburguer', 'hamburgue', 'burger'] },

  // ── Mercearia: congelados, prontos e snacks ──
  { emoji: '🍕', label: 'pizza', category: 'mercearia', terms: ['pizza', 'esfiha', 'empada', 'pastel'] },
  { emoji: '🍟', label: 'batata congelada', category: 'mercearia', terms: ['batata frita', 'batata palha', 'batata congelada'] },
  { emoji: '🍲', label: 'pronto', category: 'mercearia', terms: ['sopa', 'caldo pronto', 'comida congelada', 'lasanha congelada', 'marmita'] },
  { emoji: '🍿', label: 'salgadinho', category: 'mercearia', terms: ['pipoca', 'salgadinho', 'chips', 'doritos', 'cheetos', 'ruffles'] },
  { emoji: '🥜', label: 'castanhas', category: 'mercearia', terms: ['amendoim', 'castanha', 'castanha de caju', 'castanha do para', 'nozes', 'amendoa', 'avela', 'pistache', 'uva passa', 'frutas secas', 'damasco seco', 'tamara'] },

  // ── Casa: limpeza ──
  { emoji: '🧼', label: 'sabão', category: 'casa', terms: ['sabao', 'sabao em po', 'sabao liquido', 'sabao de coco', 'sabao neutro', 'omo', 'ariel', 'brilhante', 'tixan'] },
  { emoji: '🧴', label: 'produto de limpeza', category: 'casa', terms: ['detergente', 'amaciante', 'downy', 'comfort', 'agua sanitaria', 'candida', 'qboa', 'alvejante', 'desinfetante', 'pinho sol', 'limpador', 'multiuso', 'veja', 'ype', 'lustra moveis', 'limpa vidro', 'tira manchas', 'vanish', 'cloro', 'sapolio', 'removedor'] },
  { emoji: '🧽', label: 'esponja e panos', category: 'casa', terms: ['esponja', 'esponja de aco', 'bombril', 'palha de aco', 'pano de prato', 'pano de chao', 'flanela', 'pano multiuso', 'perfex'] },
  { emoji: '🧹', label: 'vassoura', category: 'casa', terms: ['vassoura', 'rodo', 'escova de limpeza', 'espanador'] },
  { emoji: '🪣', label: 'balde', category: 'casa', terms: ['balde', 'bacia'] },
  { emoji: '🗑️', label: 'lixo', category: 'casa', terms: ['saco de lixo', 'saco plastico', 'lixo', 'lixeira'] },
  { emoji: '🧻', label: 'papel', category: 'casa', terms: ['papel higienico', 'papel toalha', 'guardanapo', 'lenco', 'lenco de papel', 'papel aluminio', 'filme plastico', 'papel manteiga', 'saco para freezer', 'absorvente', 'papel'] },
  { emoji: '🦟', label: 'inseticida', category: 'casa', terms: ['inseticida', 'repelente', 'raid', 'sbp', 'veneno de barata', 'mata mosquito', 'naftalina'] },
  { emoji: '🌸', label: 'aromatizante', category: 'casa', terms: ['aromatizante', 'odorizador', 'ambientador', 'bom ar', 'desodorizador'] },
  { emoji: '🕯️', label: 'vela', category: 'casa', terms: ['vela', 'fosforo', 'isqueiro'] },
  { emoji: '🔋', label: 'pilha', category: 'casa', terms: ['pilha', 'bateria'] },
  { emoji: '💡', label: 'lâmpada', category: 'casa', terms: ['lampada'] },
  { emoji: '🧤', label: 'luva', category: 'casa', terms: ['luva', 'luva de borracha'] },

  // ── Casa: higiene pessoal e farmácia ──
  { emoji: '🧼', label: 'sabonete', category: 'casa', terms: ['sabonete', 'sabonete liquido', 'dove', 'lux', 'protex'] },
  { emoji: '🧴', label: 'cabelo e pele', category: 'casa', terms: ['shampoo', 'xampu', 'condicionador', 'creme de cabelo', 'creme para pentear', 'hidratante', 'creme hidratante', 'protetor solar', 'oleo corporal', 'gel de cabelo', 'tintura de cabelo', 'desodorante', 'antitranspirante', 'perfume', 'colonia', 'seda', 'pantene', 'nivea', 'creme'] },
  { emoji: '🪥', label: 'higiene bucal', category: 'casa', terms: ['creme dental', 'pasta de dente', 'escova de dente', 'colgate', 'sorriso', 'oral b', 'enxaguante bucal', 'listerine'] },
  { emoji: '🦷', label: 'fio dental', category: 'casa', terms: ['fio dental'] },
  { emoji: '🪒', label: 'barbear', category: 'casa', terms: ['aparelho de barbear', 'lamina de barbear', 'gilete', 'barbeador', 'espuma de barbear', 'depilador', 'cera depilatoria'] },
  { emoji: '👶', label: 'bebê', category: 'casa', terms: ['fralda', 'lenco umedecido', 'pomada para assadura', 'talco', 'mamadeira', 'chupeta'] },
  { emoji: '💊', label: 'remédio', category: 'casa', terms: ['remedio', 'medicamento', 'dipirona', 'paracetamol', 'ibuprofeno', 'analgesico', 'antialergico', 'vitamina', 'suplemento', 'whey', 'omeprazol', 'buscopan', 'engov'] },
  { emoji: '🩹', label: 'primeiros socorros', category: 'casa', terms: ['band aid', 'curativo', 'esparadrapo', 'gaze', 'algodao', 'cotonete', 'agua oxigenada', 'iodo'] },
  { emoji: '🧴', label: 'álcool', category: 'casa', terms: ['alcool', 'alcool em gel', 'alcool 70'] },
  { emoji: '🐾', label: 'pet', category: 'casa', terms: ['racao', 'racao de cachorro', 'racao de gato', 'petisco', 'areia de gato', 'areia higienica', 'shampoo de cachorro', 'antipulgas', 'osso para cachorro'] },

  // ── Outros ──
  { emoji: '🖊️', label: 'papelaria', category: 'outros', terms: ['caneta', 'lapis', 'caderno', 'borracha', 'papel sulfite', 'cola', 'grampeador', 'clipe', 'fita adesiva', 'durex', 'tesoura', 'marca texto'] },
  { emoji: '🎁', label: 'presente', category: 'outros', terms: ['presente', 'lembrancinha', 'embrulho', 'cartao de aniversario'] },
  { emoji: '💐', label: 'flores', category: 'outros', terms: ['flor', 'flores', 'buque', 'planta', 'vaso'] },
  { emoji: '🧊', label: 'gelo', category: 'outros', terms: ['gelo', 'gelo de coco'] },
  { emoji: '🔥', label: 'carvão', category: 'outros', terms: ['carvao', 'acendedor', 'gas de cozinha', 'botijao'] },
  { emoji: '🍽️', label: 'utensílio', category: 'outros', terms: ['prato', 'copo', 'talher', 'garfo', 'faca', 'colher', 'panela', 'frigideira', 'copo descartavel', 'prato descartavel', 'canudo'] },
  { emoji: '🧦', label: 'vestuário', category: 'outros', terms: ['meia', 'meias', 'cueca', 'calcinha', 'camiseta', 'blusa', 'pijama'] },
  { emoji: '🩴', label: 'chinelo', category: 'outros', terms: ['chinelo', 'sandalia'] },
  { emoji: '🧺', label: 'toalha', category: 'outros', terms: ['toalha', 'toalha de banho', 'pano de banho', 'lencol', 'fronha'] },
  { emoji: '☂️', label: 'guarda-chuva', category: 'outros', terms: ['guarda chuva', 'sombrinha', 'capa de chuva'] },
];

// Pistas genéricas: valem só quando nenhum produto do dicionário bateu.
// São checadas por palavra inteira, na ordem, e servem pra não jogar em
// "Outros" um nome descritivo que a lista ainda não conhece
// ("desengordurante forte", "bebida de soja", "corte bovino").
const HINTS: { terms: string[]; category: CategoryKey; emoji: string; label: string }[] = [
  { terms: ['limpeza', 'limpa', 'desengordurante', 'higiene', 'perfumaria', 'lavanderia'], category: 'casa', emoji: '🧴', label: 'produto de limpeza' },
  { terms: ['bovino', 'suino', 'bovina', 'suina', 'file', 'corte'], category: 'mercearia', emoji: '🥩', label: 'carne' },
  { terms: ['congelado', 'congelada'], category: 'mercearia', emoji: '🧊', label: 'congelado' },
  { terms: ['integral', 'diet', 'light', 'zero'], category: 'mercearia', emoji: '🛒', label: 'mercearia' },
  { terms: ['bebida', 'drink', 'garrafa'], category: 'bebidas', emoji: '🥤', label: 'bebida' },
];

// ─────────────────────────────────────────────────────────────────────
// Índice e busca
// ─────────────────────────────────────────────────────────────────────

interface IndexedTerm { entry: Entry; words: string[] }

// Termo normalizado (sem acento, sem palavra de ligação, no singular) →
// entrada. Montado uma vez, no primeiro uso.
const TERM_INDEX = new Map<string, IndexedTerm>();
const HINT_INDEX = new Map<string, { category: CategoryKey; emoji: string; label: string }>();
let MAX_TERM_WORDS = 1;

function indexKey(term: string): { key: string; words: string[] } {
  const words = normalize(term)
    .split(' ')
    .filter(w => w && !STOPWORDS.has(w))
    .map(singularize);
  return { key: words.join(' '), words };
}

function buildIndex(): void {
  if (TERM_INDEX.size > 0) return;
  for (const entry of ITEMS) {
    for (const term of entry.terms) {
      const { key, words } = indexKey(term);
      if (!key) continue;
      // Primeira entrada a registrar o termo vence: a ordem do dicionário
      // é a regra de desempate, então um termo repetido não muda de
      // categoria dependendo de onde foi lido.
      if (!TERM_INDEX.has(key)) TERM_INDEX.set(key, { entry, words });
      if (words.length > MAX_TERM_WORDS) MAX_TERM_WORDS = words.length;
    }
  }
  for (const hint of HINTS) {
    for (const term of hint.terms) {
      const { key } = indexKey(term);
      if (key && !HINT_INDEX.has(key)) HINT_INDEX.set(key, hint);
    }
  }
}

function classifyLocal(name: string): ClassificationResult {
  buildIndex();

  const words = tokenize(name).map(singularize);
  if (words.length === 0) {
    const fb = CATEGORY_FALLBACK.outros;
    return { category: 'outros', emoji: fb.emoji, emojiName: fb.label };
  }

  // Do trecho mais longo pro mais curto: "creme de leite" (3 palavras,
  // vira "creme leite") é testado antes de "creme" sozinho, então a
  // expressão mais específica sempre ganha.
  const maxWindow = Math.min(MAX_TERM_WORDS, words.length);
  for (let size = maxWindow; size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const gram = words.slice(start, start + size).join(' ');
      const hit = TERM_INDEX.get(gram);
      if (hit) {
        return { category: hit.entry.category, emoji: hit.entry.emoji, emojiName: hit.entry.label };
      }
    }
  }

  for (const word of words) {
    const hint = HINT_INDEX.get(word);
    if (hint) {
      return { category: hint.category, emoji: hint.emoji, emojiName: hint.label };
    }
  }

  const fb = CATEGORY_FALLBACK.outros;
  return { category: 'outros', emoji: fb.emoji, emojiName: fb.label };
}

/**
 * Classifica um item pelo nome. Síncrona de propósito: é só busca em
 * memória, sem rede.
 */
export function classifyItemSync(itemName: string): ClassificationResult {
  return classifyLocal(itemName);
}

/**
 * `true` quando o nome bateu com algo de verdade no dicionário, e não
 * caiu no "Outros" por falta de correspondência. Quem faz correção
 * automática de itens antigos usa isso pra não mexer no que não conhece.
 */
export function isConfidentClassification(result: ClassificationResult): boolean {
  return result.category !== 'outros' || result.emoji !== CATEGORY_FALLBACK.outros.emoji;
}

/** Emoji genérico de uma categoria, pra quando o produto é desconhecido. */
export function fallbackEmojiForCategory(category: string): string {
  return (CATEGORY_FALLBACK[category as CategoryKey] || CATEGORY_FALLBACK.outros).emoji;
}

/** Todos os emojis genéricos — o que um item ganha quando não é reconhecido. */
export function isGenericEmoji(emoji: string | undefined): boolean {
  if (!emoji) return true;
  return Object.values(CATEGORY_FALLBACK).some(fb => fb.emoji === emoji);
}

/**
 * Reclassifica um item que já está no catálogo do usuário e devolve só o
 * que vale a pena corrigir — ou `null` quando não há nada a fazer.
 *
 * Existe porque a lista dele já tem itens gravados pela versão antiga,
 * todos com o emoji genérico da categoria (🛒/🧻/📦). Sem isso, só item
 * novo ganharia emoji próprio.
 *
 * Duas travas para nunca desfazer escolha do usuário:
 * - o emoji só é trocado quando o atual é um dos genéricos; emoji
 *   específico (inclusive os itens de exemplo da conta nova) fica como
 *   está;
 * - a categoria só muda quando o item está em "Outros", ou seja, quando
 *   o classificador antigo não reconheceu nada. Categoria que o usuário
 *   corrigiu à mão nunca é revista.
 */
export function upgradeItemClassification(item: { name: string; emoji?: string; category: string }): { emoji?: string; category?: string } | null {
  const result = classifyLocal(item.name);
  if (!isConfidentClassification(result)) return null;

  const upgrade: { emoji?: string; category?: string } = {};
  if (isGenericEmoji(item.emoji) && result.emoji !== item.emoji) {
    upgrade.emoji = result.emoji;
  }
  if (item.category === 'outros' && result.category !== 'outros') {
    upgrade.category = result.category;
  }

  return upgrade.emoji || upgrade.category ? upgrade : null;
}

// Mantida assíncrona porque App.tsx a consome com await desde a versão
// que chamava uma API externa; hoje resolve na hora.
export async function classifyItem(itemName: string): Promise<ClassificationResult> {
  return classifyLocal(itemName);
}
