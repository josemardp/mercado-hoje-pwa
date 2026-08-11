// Dicionário de produtos da lista de Compras: cada entrada carrega o
// emoji E a categoria do produto, e a lista de termos que apontam pra ela.
//
// Separado de classifyCategory.ts de propósito: lá fica o MOTOR (como o
// nome digitado vira uma entrada daqui), aqui fica só o DADO, que cresce
// sem parar. Quem quiser ensinar um produto novo ao app mexe só neste
// arquivo.
//
// Regras pra manter a qualidade ao adicionar termos:
//
// 1. Termo é escrito sem acento e em minúscula (o motor normaliza os dois
//    lados, mas assim o arquivo fica consistente e fácil de conferir).
// 2. Termo de UMA palavra deve ser inequívoco no contexto de compras. Se
//    a palavra também é outra coisa ("creme", "prata", "galo"), cadastre a
//    expressão inteira ("creme de leite", "banana prata") — a expressão
//    mais longa sempre vence a palavra solta.
// 3. Não repita um termo em duas entradas: a primeira do arquivo vence, e
//    a duplicata vira uma surpresa silenciosa. O teste de integridade do
//    dicionário reprova duplicata.
// 4. O emoji não precisa ser único. Existem ~130 emojis de comida no
//    Unicode, então dezenas de produtos dividem o mesmo desenho. O que não
//    pode é o produto cair no genérico 📦.

export type CategoryKey = 'frutas' | 'bebidas' | 'mercearia' | 'casa' | 'outros';

export interface ProductEntry {
  emoji: string;
  /** Nome legível do que o emoji representa (usado em mensagens). */
  label: string;
  category: CategoryKey;
  /**
   * Entrada de MARCA. Marca diz quem fabricou, não o que é: em
   * "Camil feijão" quem manda é "feijão", não "Camil" (que é marca de
   * arroz). O motor usa isso pra desempatar quando os dois aparecem no
   * mesmo nome — ver findProduct em classifyCategory.ts.
   */
  brand?: boolean;
  /** Sinônimos, variações e marcas que apontam pra esta entrada. */
  terms: string[];
}

// Emoji de último recurso, por categoria — só chega aqui o que o
// dicionário não reconheceu mas alguma pista genérica classificou.
export const CATEGORY_FALLBACK: Record<CategoryKey, { emoji: string; label: string }> = {
  frutas: { emoji: '🍎', label: 'hortifrúti' },
  bebidas: { emoji: '🥤', label: 'bebida' },
  mercearia: { emoji: '🛒', label: 'mercearia' },
  casa: { emoji: '🧴', label: 'casa e higiene' },
  outros: { emoji: '📦', label: 'item' },
};

export const PRODUCTS: ProductEntry[] = [
  // ═══════════════════════════════════════════════════════════════════
  // HORTIFRÚTI — frutas
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🍌', label: 'banana', category: 'frutas', terms: ['banana', 'banana prata', 'banana nanica', 'banana da terra', 'banana maca', 'banana ouro', 'banana caturra', 'banana passa'] },
  { emoji: '🍎', label: 'maçã', category: 'frutas', terms: ['maca', 'maca fuji', 'maca gala', 'maca verde', 'maca argentina', 'maca red'] },
  { emoji: '🍊', label: 'laranja', category: 'frutas', terms: ['laranja', 'laranja lima', 'laranja pera', 'laranja bahia', 'laranja seleta', 'mexerica', 'tangerina', 'bergamota', 'poncan', 'ponkan', 'mimosa', 'murcote', 'clementina'] },
  { emoji: '🍋', label: 'limão', category: 'frutas', terms: ['limao', 'limao taiti', 'limao siciliano', 'limao galego', 'limao cravo', 'lima da persia'] },
  { emoji: '🍇', label: 'uva', category: 'frutas', terms: ['uva', 'uva verde', 'uva roxa', 'uva thompson', 'uva niagara', 'uva italia', 'uva rubi', 'uva benitaka'] },
  { emoji: '🍓', label: 'morango', category: 'frutas', terms: ['morango'] },
  { emoji: '🍍', label: 'abacaxi', category: 'frutas', terms: ['abacaxi', 'abacaxi perola', 'ananas'] },
  { emoji: '🍉', label: 'melancia', category: 'frutas', terms: ['melancia'] },
  { emoji: '🍈', label: 'melão', category: 'frutas', terms: ['melao', 'melao amarelo', 'melao cantaloupe', 'melao orange'] },
  { emoji: '🥭', label: 'manga', category: 'frutas', terms: ['manga', 'manga palmer', 'manga tommy', 'manga rosa', 'manga espada', 'manga haden', 'manga coquinho'] },
  { emoji: '🍐', label: 'pera', category: 'frutas', terms: ['pera', 'pera williams', 'pera portuguesa', 'pera asiatica'] },
  { emoji: '🍑', label: 'pêssego', category: 'frutas', terms: ['pessego', 'ameixa', 'ameixa preta', 'nectarina', 'damasco'] },
  { emoji: '🥑', label: 'abacate', category: 'frutas', terms: ['abacate', 'avocado'] },
  { emoji: '🥝', label: 'kiwi', category: 'frutas', terms: ['kiwi'] },
  { emoji: '🥥', label: 'coco', category: 'frutas', terms: ['coco', 'coco seco', 'coco verde', 'coco ralado'] },
  { emoji: '🍒', label: 'cereja', category: 'frutas', terms: ['cereja', 'acerola', 'pitanga', 'grumixama'] },
  { emoji: '🫐', label: 'frutas vermelhas', category: 'frutas', terms: ['amora', 'framboesa', 'mirtilo', 'blueberry', 'jabuticaba', 'frutas vermelhas', 'cranberry', 'physalis'] },
  { emoji: '🍈', label: 'mamão', category: 'frutas', terms: ['mamao', 'mamao papaia', 'papaia', 'mamao formosa'] },
  // Frutas brasileiras e regionais: o classificador anterior não conhecia
  // nenhuma delas e jogava tudo em "Outros" com 📦 — foi o caso de
  // "atemoia" que o usuário reportou.
  { emoji: '🍈', label: 'fruta tropical', category: 'frutas', terms: [
    'atemoia', 'pinha', 'fruta do conde', 'condessa', 'biriba', 'graviola', 'cherimoia',
    'goiaba', 'goiaba vermelha', 'goiaba branca', 'araca', 'guabiroba', 'uvaia', 'cambuci',
    'caju', 'cajarana', 'caja', 'cajazinho', 'seriguela', 'siriguela', 'umbu', 'imbu',
    'maracuja', 'maracuja azedo', 'maracuja doce', 'jaca', 'jaca dura', 'jaca mole',
    'jambo', 'jenipapo', 'sapoti', 'sapota', 'abiu', 'mangaba', 'murici', 'bacuri',
    'pequi', 'buriti', 'tucuma', 'bacaba', 'pupunha', 'cupuacu', 'acai', 'jucara',
    'carambola', 'pitaya', 'pitanga roxa', 'tamarindo', 'lichia', 'longan', 'mangostim',
    'rambutan', 'kinkan', 'kumquat', 'nespera', 'ameixa amarela', 'fruta pao',
    'melancia amarela', 'noni', 'graviolinha', 'guarana fruta',
  ] },
  { emoji: '🍎', label: 'romã', category: 'frutas', terms: ['roma', 'figo', 'figo fresco', 'caqui', 'caqui chocolate', 'caqui fuyu', 'marmelo'] },
  { emoji: '🍎', label: 'fruta', category: 'frutas', terms: ['fruta', 'frutas', 'salada de frutas', 'fruta da estacao'] },

  // ═══════════════════════════════════════════════════════════════════
  // HORTIFRÚTI — verduras, legumes, raízes e ervas
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🍅', label: 'tomate', category: 'frutas', terms: ['tomate', 'tomate cereja', 'tomate italiano', 'tomate caqui', 'tomate grape', 'tomate seco'] },
  { emoji: '🥬', label: 'folhas', category: 'frutas', terms: [
    'alface', 'alface americana', 'alface crespa', 'alface lisa', 'alface roxa',
    'couve', 'couve manteiga', 'couve chinesa', 'rucula', 'agriao', 'espinafre',
    'acelga', 'repolho', 'repolho roxo', 'almeirao', 'escarola', 'chicoria', 'radite',
    'mostarda folha', 'catalonha', 'taioba', 'ora pro nobis', 'bertalha', 'serralha',
    'verdura', 'verduras', 'legume', 'legumes', 'hortifruti', 'folhas', 'folhagem',
    'beterraba', 'rabanete', 'nabo', 'quiabo', 'vagem', 'ervilha', 'ervilha fresca',
    'ervilha torta', 'palmito', 'broto de feijao', 'broto de alfafa', 'jilo', 'maxixe',
    'pepino japones', 'pimenta biquinho', 'aspargo', 'alcachofra', 'endivia',
    'couve de bruxelas', 'nabo japones', 'chuchu recheado',
  ] },
  { emoji: '🥗', label: 'salada', category: 'frutas', terms: ['salada', 'salada pronta', 'mix de folhas', 'salada de folhas'] },
  { emoji: '🥕', label: 'cenoura', category: 'frutas', terms: ['cenoura', 'cenoura baby'] },
  { emoji: '🧅', label: 'cebola', category: 'frutas', terms: ['cebola', 'cebola roxa', 'cebola branca', 'cebola pera', 'alho poro', 'chalota', 'cebolinha branca'] },
  { emoji: '🧄', label: 'alho', category: 'frutas', terms: ['alho', 'alho descascado', 'alho roxo', 'dente de alho'] },
  { emoji: '🥔', label: 'batata', category: 'frutas', terms: ['batata', 'batata inglesa', 'batata asterix', 'batata bolinha', 'mandioca', 'aipim', 'macaxeira', 'inhame', 'mandioquinha', 'batata baroa', 'cara', 'yacon'] },
  { emoji: '🍠', label: 'batata doce', category: 'frutas', terms: ['batata doce', 'batata roxa'] },
  { emoji: '🌽', label: 'milho', category: 'frutas', terms: ['milho', 'milho verde', 'espiga de milho', 'milho na espiga'] },
  { emoji: '🥦', label: 'brócolis', category: 'frutas', terms: ['brocolis', 'brocolis ninja', 'couve flor', 'couveflor'] },
  { emoji: '🥒', label: 'pepino', category: 'frutas', terms: ['pepino', 'abobrinha', 'abobrinha italiana', 'chuchu'] },
  { emoji: '🍆', label: 'berinjela', category: 'frutas', terms: ['berinjela'] },
  { emoji: '🫑', label: 'pimentão', category: 'frutas', terms: ['pimentao', 'pimentao verde', 'pimentao amarelo', 'pimentao vermelho'] },
  { emoji: '🌶️', label: 'pimenta', category: 'frutas', terms: ['pimenta dedo de moca', 'pimenta malagueta', 'pimenta fresca'] },
  { emoji: '🎃', label: 'abóbora', category: 'frutas', terms: ['abobora', 'jerimum', 'moranga', 'abobora cabotia', 'abobora japonesa'] },
  { emoji: '🍄', label: 'cogumelo', category: 'frutas', terms: ['cogumelo', 'champignon', 'shitake', 'shimeji', 'funghi', 'portobello'] },
  { emoji: '🌿', label: 'cheiro verde', category: 'frutas', terms: [
    'salsa', 'salsinha', 'cebolinha', 'coentro', 'cheiro verde', 'hortela', 'manjericao',
    'alecrim', 'tomilho', 'gengibre', 'erva', 'ervas', 'ervas finas', 'louro fresco',
    'capim santo', 'erva doce fresca', 'sagu de ervas', 'endro', 'dill', 'estragao',
    'oregano fresco', 'salvia', 'curcuma fresca', 'acafrao fresco',
  ] },
  { emoji: '🫒', label: 'azeitona', category: 'frutas', terms: ['azeitona', 'azeitona verde', 'azeitona preta'] },
  { emoji: '🌱', label: 'muda e semente', category: 'frutas', terms: ['muda', 'semente para plantar', 'temperos frescos'] },

  // ═══════════════════════════════════════════════════════════════════
  // BEBIDAS
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '💧', label: 'água', category: 'bebidas', terms: ['agua', 'agua mineral', 'agua com gas', 'agua sem gas', 'galao de agua', 'agua tonica'] },
  { emoji: '🥥', label: 'água de coco', category: 'bebidas', terms: ['agua de coco'] },
  { emoji: '🧃', label: 'suco', category: 'bebidas', terms: ['suco', 'suco de laranja', 'suco de uva', 'suco de manga', 'suco de caju', 'nectar', 'refresco', 'suco em po', 'suco concentrado', 'suco integral', 'polpa de fruta'] },
  { emoji: '🥤', label: 'refrigerante', category: 'bebidas', terms: ['refrigerante', 'refri', 'soda', 'soda limonada', 'guarana', 'refrigerante zero', 'refrigerante diet'] },
  { emoji: '⚡', label: 'energético', category: 'bebidas', terms: ['energetico', 'isotonico', 'bebida energetica'] },
  { emoji: '🍺', label: 'cerveja', category: 'bebidas', terms: ['cerveja', 'chopp', 'cerveja lata', 'cerveja long neck', 'breja'] },
  { emoji: '🍷', label: 'vinho', category: 'bebidas', terms: ['vinho', 'vinho tinto', 'vinho branco', 'vinho rose', 'vinho suave', 'sangria'] },
  { emoji: '🍾', label: 'espumante', category: 'bebidas', terms: ['espumante', 'champagne', 'champanhe', 'prosecco', 'sidra'] },
  { emoji: '🥃', label: 'destilado', category: 'bebidas', terms: ['cachaca', 'pinga', 'whisky', 'uisque', 'rum', 'conhaque', 'licor', 'tequila', 'aguardente', 'catuaba', 'vermute'] },
  { emoji: '🍸', label: 'destilado', category: 'bebidas', terms: ['vodka', 'gin', 'saque', 'aperitivo', 'drink pronto'] },
  { emoji: '☕', label: 'café', category: 'bebidas', terms: ['cafe', 'cafe em po', 'po de cafe', 'cafe soluvel', 'cafe em capsula', 'capsula de cafe', 'capuccino', 'cappuccino', 'cafe em graos', 'filtro de cafe', 'coador de cafe'] },
  { emoji: '🍵', label: 'chá', category: 'bebidas', terms: ['cha', 'cha mate', 'mate', 'cha verde', 'cha de camomila', 'cha de boldo', 'cha de hibisco', 'matte', 'cha gelado', 'infusao'] },
  { emoji: '🥛', label: 'leite', category: 'bebidas', terms: ['leite', 'leite integral', 'leite desnatado', 'leite semidesnatado', 'leite zero lactose', 'leite de amendoas', 'leite vegetal', 'leite de castanha', 'leite de aveia', 'bebida de soja', 'leite de soja'] },
  { emoji: '🥥', label: 'leite de coco', category: 'bebidas', terms: ['leite de coco'] },
  { emoji: '🍫', label: 'achocolatado', category: 'bebidas', terms: ['achocolatado', 'chocolate em po', 'cacau em po', 'chocolate quente'] },

  // ═══════════════════════════════════════════════════════════════════
  // MERCEARIA — básicos
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🍚', label: 'arroz', category: 'mercearia', terms: ['arroz', 'arroz branco', 'arroz integral', 'arroz parboilizado', 'arroz agulhinha', 'arroz arboreo', 'arroz japones', 'arroz negro', 'arroz sete cereais'] },
  { emoji: '🫘', label: 'feijão', category: 'mercearia', terms: ['feijao', 'feijao carioca', 'feijao preto', 'feijao branco', 'feijao fradinho', 'feijao vermelho', 'lentilha', 'grao de bico', 'soja', 'ervilha seca', 'feijao de corda'] },
  { emoji: '🍝', label: 'macarrão', category: 'mercearia', terms: ['macarrao', 'massa', 'espaguete', 'talharim', 'penne', 'parafuso', 'lasanha', 'nhoque', 'macarrao instantaneo', 'miojo', 'massa fresca', 'capeletti', 'ravioli', 'conchinha', 'ave maria', 'cabelo de anjo'] },
  { emoji: '🌾', label: 'farinha', category: 'mercearia', terms: ['farinha', 'farinha de trigo', 'farinha de mandioca', 'farinha de rosca', 'farofa', 'trigo', 'amido de milho', 'maizena', 'tapioca', 'goma', 'aveia', 'quinoa', 'linhaca', 'chia', 'farelo', 'gergelim', 'trigo para quibe', 'farinha integral', 'farinha de amendoa'] },
  { emoji: '🌽', label: 'fubá', category: 'mercearia', terms: ['fuba', 'polenta', 'cuscuz', 'canjica', 'milho para pipoca', 'milho de pipoca', 'flocao', 'flocos de milho'] },
  { emoji: '🥣', label: 'cereal', category: 'mercearia', terms: ['cereal', 'granola', 'sucrilhos', 'mingau', 'mucilon', 'cereal matinal', 'aveia em flocos'] },
  { emoji: '🍬', label: 'açúcar e doces', category: 'mercearia', terms: ['acucar', 'acucar refinado', 'acucar demerara', 'acucar mascavo', 'acucar de confeiteiro', 'adocante', 'bala', 'chiclete', 'doce', 'pacoca', 'pe de moleque', 'rapadura', 'cocada', 'maria mole', 'marshmallow', 'pirulito'] },
  { emoji: '🧂', label: 'sal e temperos', category: 'mercearia', terms: ['sal', 'sal grosso', 'sal rosa', 'tempero', 'temperos', 'condimento', 'caldo', 'caldo de galinha', 'caldo de carne', 'pimenta do reino', 'pimenta', 'oregano', 'canela', 'cominho', 'colorau', 'acafrao', 'louro', 'noz moscada', 'curry', 'pimenta calabresa', 'cravo', 'erva doce', 'chimichurri', 'lemon pepper', 'alho e sal', 'tempero baiano'] },
  { emoji: '🫒', label: 'azeite', category: 'mercearia', terms: ['azeite', 'azeite de oliva', 'azeite extra virgem'] },
  { emoji: '🛢️', label: 'óleo', category: 'mercearia', terms: ['oleo', 'oleo de soja', 'oleo de girassol', 'oleo de canola', 'oleo de milho', 'oleo de coco', 'banha', 'gordura vegetal'] },
  { emoji: '🍶', label: 'vinagre', category: 'mercearia', terms: ['vinagre', 'vinagre de maca', 'vinagre balsamico', 'vinagre de vinho', 'vinagre de alcool', 'shoyu', 'molho de soja', 'saque culinario'] },
  { emoji: '🥫', label: 'molho e enlatado', category: 'mercearia', terms: ['molho', 'molho de tomate', 'extrato de tomate', 'massa de tomate', 'passata', 'polpa de tomate', 'ketchup', 'catchup', 'maionese', 'mostarda', 'barbecue', 'conserva', 'milho em conserva', 'ervilha em conserva', 'seleta', 'creme de cebola', 'molho branco', 'molho pesto', 'molho ingles', 'molho de pimenta', 'palmito em conserva', 'cogumelo em conserva'] },
  { emoji: '🍯', label: 'mel e geleia', category: 'mercearia', terms: ['mel', 'geleia', 'melado', 'doce de leite', 'doce de frutas', 'goiabada', 'bananada', 'marmelada', 'melaco'] },

  // ═══════════════════════════════════════════════════════════════════
  // MERCEARIA — laticínios, ovos e frios
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🧀', label: 'queijo', category: 'mercearia', terms: ['queijo', 'mussarela', 'mucarela', 'parmesao', 'ricota', 'cheddar', 'catupiry', 'queijo ralado', 'queijo minas', 'coalho', 'requeijao', 'cream cheese', 'pao de queijo', 'provolone', 'gorgonzola', 'brie', 'queijo prato', 'queijo processado'] },
  { emoji: '🧈', label: 'manteiga', category: 'mercearia', terms: ['manteiga', 'margarina', 'manteiga de garrafa', 'creme vegetal'] },
  { emoji: '🥛', label: 'iogurte', category: 'mercearia', terms: ['iogurte', 'leite fermentado', 'coalhada', 'iogurte grego', 'iogurte natural', 'bebida lactea', 'kefir'] },
  { emoji: '🥛', label: 'leite condensado', category: 'mercearia', terms: ['leite condensado', 'creme de leite', 'leite em po', 'nata', 'chantilly', 'leite de castanha em po'] },
  { emoji: '🥚', label: 'ovo', category: 'mercearia', terms: ['ovo', 'ovo caipira', 'ovo branco', 'ovo vermelho', 'ovo de codorna', 'clara pasteurizada'] },
  { emoji: '🥓', label: 'frios', category: 'mercearia', terms: ['bacon', 'presunto', 'mortadela', 'salame', 'peito de peru', 'apresuntado', 'copa', 'torresmo', 'frios', 'blanquet', 'lombo canadense', 'pepperoni'] },

  // ═══════════════════════════════════════════════════════════════════
  // MERCEARIA — padaria, biscoitos e sobremesas
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🍞', label: 'pão', category: 'mercearia', terms: ['pao', 'pao frances', 'pao de forma', 'pao integral', 'bisnaguinha', 'baguete', 'torrada', 'pao sirio', 'pao de alho', 'pao doce', 'pao de hamburguer', 'pao de hot dog', 'pao australiano', 'brioche', 'croissant', 'sonho', 'rosca'] },
  { emoji: '🍪', label: 'biscoito', category: 'mercearia', terms: ['biscoito', 'bolacha', 'cream cracker', 'agua e sal', 'recheado', 'wafer', 'rosquinha', 'maria', 'maisena', 'biscoito de polvilho', 'sequilho', 'amanteigado', 'cookie'] },
  { emoji: '🍰', label: 'bolo', category: 'mercearia', terms: ['bolo', 'mistura para bolo', 'panetone', 'torta', 'rocambole', 'bolo de pote', 'cobertura para bolo', 'confeito'] },
  { emoji: '🍫', label: 'chocolate', category: 'mercearia', terms: ['chocolate', 'bombom', 'brigadeiro', 'barra de cereal', 'creme de avela', 'chocotone', 'trufa', 'ovo de pascoa', 'granulado'] },
  { emoji: '🍮', label: 'sobremesa', category: 'mercearia', terms: ['gelatina', 'pudim', 'flan', 'sobremesa', 'manjar', 'mousse'] },
  { emoji: '🍨', label: 'sorvete', category: 'mercearia', terms: ['sorvete', 'picole', 'acai congelado', 'sundae'] },

  // ═══════════════════════════════════════════════════════════════════
  // MERCEARIA — carnes e pescados
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🥩', label: 'carne', category: 'mercearia', terms: [
    'carne', 'carne moida', 'carne bovina', 'bife', 'picanha', 'alcatra', 'patinho',
    'coxao mole', 'coxao duro', 'acem', 'maminha', 'cupim', 'fraldinha', 'contra file',
    'file mignon', 'musculo', 'costela', 'costelinha', 'lombo', 'pernil', 'bisteca',
    'carne de porco', 'carne suina', 'churrasco', 'carne seca', 'charque', 'carne de sol',
    'paleta', 'peito bovino', 'ossobuco', 'figado', 'coracao', 'linguica de porco',
    'panceta', 'costela suina', 'bife ancho', 'chorizo', 'carne para cozido',
  ] },
  { emoji: '🍗', label: 'frango', category: 'mercearia', terms: ['frango', 'peito de frango', 'coxa', 'sobrecoxa', 'asa de frango', 'coxinha da asa', 'file de frango', 'galinha', 'nuggets', 'empanado', 'frango a passarinho', 'frango inteiro', 'coracao de frango', 'figado de frango'] },
  { emoji: '🦃', label: 'peru', category: 'mercearia', terms: ['peru', 'chester', 'tender'] },
  { emoji: '🐟', label: 'peixe', category: 'mercearia', terms: ['peixe', 'tilapia', 'salmao', 'merluza', 'bacalhau', 'sardinha', 'atum', 'pescada', 'file de peixe', 'tainha', 'corvina', 'pintado', 'traira', 'cacao', 'anchova'] },
  { emoji: '🍤', label: 'frutos do mar', category: 'mercearia', terms: ['camarao', 'frutos do mar', 'lula', 'polvo', 'marisco', 'mexilhao', 'siri', 'caranguejo'] },
  { emoji: '🍖', label: 'linguiça', category: 'mercearia', terms: ['linguica', 'calabresa', 'almondega', 'kafta', 'pernil temperado', 'linguica toscana', 'linguica fina', 'paio'] },
  { emoji: '🌭', label: 'salsicha', category: 'mercearia', terms: ['salsicha', 'hot dog', 'cachorro quente'] },
  { emoji: '🍔', label: 'hambúrguer', category: 'mercearia', terms: ['hamburguer', 'hamburgue', 'burger', 'carne de hamburguer'] },

  // ═══════════════════════════════════════════════════════════════════
  // MERCEARIA — congelados, prontos e snacks
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🍕', label: 'pizza', category: 'mercearia', terms: ['pizza', 'esfiha', 'empada', 'pastel', 'massa de pizza', 'massa de pastel', 'coxinha', 'salgado congelado', 'kibe'] },
  { emoji: '🍟', label: 'batata congelada', category: 'mercearia', terms: ['batata frita', 'batata palha', 'batata congelada', 'batata rustica'] },
  { emoji: '🍲', label: 'pronto', category: 'mercearia', terms: ['sopa', 'caldo pronto', 'comida congelada', 'lasanha congelada', 'marmita', 'escondidinho', 'strogonoff', 'feijoada pronta'] },
  { emoji: '🍿', label: 'salgadinho', category: 'mercearia', terms: ['pipoca', 'salgadinho', 'chips', 'pipoca de micro ondas', 'batata chips', 'amendoim japones'] },
  { emoji: '🥜', label: 'castanhas', category: 'mercearia', terms: ['amendoim', 'castanha', 'castanha de caju', 'castanha do para', 'nozes', 'amendoa', 'avela', 'pistache', 'uva passa', 'frutas secas', 'damasco seco', 'tamara', 'banana desidratada', 'manga desidratada', 'fruta desidratada', 'macadamia', 'pinhao', 'semente de girassol', 'semente de abobora'] },

  // ═══════════════════════════════════════════════════════════════════
  // CASA — limpeza
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🧼', label: 'sabão', category: 'casa', terms: ['sabao', 'sabao em po', 'sabao liquido', 'sabao de coco', 'sabao neutro', 'sabao em barra', 'sabao para roupa'] },
  { emoji: '🧴', label: 'produto de limpeza', category: 'casa', terms: [
    'detergente', 'amaciante', 'agua sanitaria', 'alvejante', 'desinfetante',
    'limpador', 'multiuso', 'lustra moveis', 'limpa vidro', 'tira manchas', 'cloro',
    'sapolio', 'removedor', 'desengordurante', 'limpa alumino', 'limpa pedra',
    'lava roupas', 'lava loucas', 'tira limo', 'silicone para moveis', 'cera liquida',
    'limpador de piso', 'agua de lavanda', 'alcool de limpeza',
  ] },
  { emoji: '🧽', label: 'esponja e panos', category: 'casa', terms: ['esponja', 'esponja de aco', 'palha de aco', 'pano de prato', 'pano de chao', 'flanela', 'pano multiuso', 'esfregao', 'fibra de limpeza'] },
  { emoji: '🧹', label: 'vassoura', category: 'casa', terms: ['vassoura', 'rodo', 'escova de limpeza', 'espanador', 'pa de lixo', 'mop', 'vassoura de pelo'] },
  { emoji: '🪣', label: 'balde', category: 'casa', terms: ['balde', 'bacia', 'cesto de roupa', 'varal', 'prendedor de roupa', 'cabide'] },
  { emoji: '🗑️', label: 'lixo', category: 'casa', terms: ['saco de lixo', 'saco plastico', 'lixo', 'lixeira'] },
  { emoji: '🧻', label: 'papel', category: 'casa', terms: ['papel higienico', 'papel toalha', 'guardanapo', 'lenco', 'lenco de papel', 'papel aluminio', 'filme plastico', 'papel manteiga', 'saco para freezer', 'absorvente', 'papel', 'papel de seda'] },
  { emoji: '🦟', label: 'inseticida', category: 'casa', terms: ['inseticida', 'repelente', 'veneno de barata', 'mata mosquito', 'naftalina', 'raticida', 'armadilha para insetos'] },
  { emoji: '🌸', label: 'aromatizante', category: 'casa', terms: ['aromatizante', 'odorizador', 'ambientador', 'desodorizador', 'difusor', 'sache perfumado'] },
  { emoji: '🕯️', label: 'vela', category: 'casa', terms: ['vela', 'fosforo', 'isqueiro'] },
  { emoji: '🔋', label: 'pilha', category: 'casa', terms: ['pilha', 'bateria'] },
  { emoji: '💡', label: 'lâmpada', category: 'casa', terms: ['lampada', 'lampada led', 'luminaria'] },
  { emoji: '🧤', label: 'luva', category: 'casa', terms: ['luva', 'luva de borracha', 'luva descartavel'] },

  // ═══════════════════════════════════════════════════════════════════
  // CASA — higiene pessoal e farmácia
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🧼', label: 'sabonete', category: 'casa', terms: ['sabonete', 'sabonete liquido', 'sabonete intimo', 'sabonete infantil'] },
  { emoji: '🧴', label: 'cabelo e pele', category: 'casa', terms: [
    'shampoo', 'xampu', 'condicionador', 'creme de cabelo', 'creme para pentear',
    'hidratante', 'creme hidratante', 'protetor solar', 'oleo corporal', 'gel de cabelo',
    'tintura de cabelo', 'desodorante', 'antitranspirante', 'perfume', 'colonia',
    'creme', 'mascara capilar', 'leave in', 'finalizador', 'agua micelar', 'demaquilante',
    'esfoliante', 'protetor labial', 'pos barba', 'locao', 'oleo capilar',
  ] },
  { emoji: '🪥', label: 'higiene bucal', category: 'casa', terms: ['creme dental', 'pasta de dente', 'escova de dente', 'enxaguante bucal', 'antisseptico bucal', 'escova interdental', 'fixador de dentadura'] },
  { emoji: '🦷', label: 'fio dental', category: 'casa', terms: ['fio dental'] },
  { emoji: '🪒', label: 'barbear', category: 'casa', terms: ['aparelho de barbear', 'lamina de barbear', 'barbeador', 'espuma de barbear', 'depilador', 'cera depilatoria', 'gel de barbear'] },
  { emoji: '👶', label: 'bebê', category: 'casa', terms: ['fralda', 'lenco umedecido', 'pomada para assadura', 'talco', 'mamadeira', 'chupeta', 'fralda de pano', 'bico de mamadeira'] },
  { emoji: '💊', label: 'remédio', category: 'casa', terms: ['remedio', 'medicamento', 'dipirona', 'paracetamol', 'ibuprofeno', 'analgesico', 'antialergico', 'vitamina', 'suplemento', 'whey', 'omeprazol', 'antiacido', 'soro fisiologico', 'colirio', 'xarope', 'pastilha para garganta', 'anti inflamatorio', 'creatina', 'colageno'] },
  { emoji: '🩹', label: 'primeiros socorros', category: 'casa', terms: ['band aid', 'curativo', 'esparadrapo', 'gaze', 'algodao', 'cotonete', 'agua oxigenada', 'iodo', 'atadura', 'termometro', 'mascara descartavel'] },
  { emoji: '🧴', label: 'álcool', category: 'casa', terms: ['alcool', 'alcool em gel', 'alcool 70'] },
  { emoji: '🐾', label: 'pet', category: 'casa', terms: ['racao', 'racao de cachorro', 'racao de gato', 'petisco', 'areia de gato', 'areia higienica', 'shampoo de cachorro', 'antipulgas', 'osso para cachorro', 'sache para gato', 'tapete higienico', 'coleira', 'brinquedo para pet'] },

  // ═══════════════════════════════════════════════════════════════════
  // OUTROS
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🖊️', label: 'papelaria', category: 'outros', terms: ['caneta', 'lapis', 'caderno', 'borracha', 'papel sulfite', 'cola', 'grampeador', 'clipe', 'fita adesiva', 'durex', 'marca texto', 'apontador', 'regua', 'envelope', 'etiqueta', 'pasta de documento'] },
  { emoji: '✂️', label: 'tesoura e alicate', category: 'outros', terms: ['tesoura', 'alicate', 'alicate de unha', 'cortador de unha', 'pinca', 'lixa de unha', 'estilete'] },
  { emoji: '🎁', label: 'presente', category: 'outros', terms: ['presente', 'lembrancinha', 'embrulho', 'cartao de aniversario', 'papel de presente', 'laco', 'vela de aniversario'] },
  { emoji: '💐', label: 'flores', category: 'outros', terms: ['flor', 'flores', 'buque', 'planta', 'vaso', 'terra para planta', 'adubo'] },
  { emoji: '🧊', label: 'gelo', category: 'outros', terms: ['gelo', 'gelo de coco', 'gelo seco'] },
  { emoji: '🔥', label: 'carvão e gás', category: 'outros', terms: ['carvao', 'acendedor', 'gas de cozinha', 'botijao'] },
  { emoji: '🍽️', label: 'utensílio', category: 'outros', terms: ['prato', 'copo', 'talher', 'garfo', 'faca', 'colher', 'panela', 'frigideira', 'copo descartavel', 'prato descartavel', 'canudo', 'tabua de corte', 'escorredor', 'forma de bolo', 'potes', 'marmiteira', 'abridor'] },
  { emoji: '🧦', label: 'vestuário', category: 'outros', terms: ['meia', 'cueca', 'calcinha', 'camiseta', 'blusa', 'pijama', 'sutia'] },
  { emoji: '🩴', label: 'chinelo', category: 'outros', terms: ['chinelo', 'sandalia'] },
  { emoji: '🧺', label: 'toalha e cama', category: 'outros', terms: ['toalha', 'toalha de banho', 'pano de banho', 'lencol', 'fronha', 'cobertor', 'travesseiro'] },
  { emoji: '☂️', label: 'guarda-chuva', category: 'outros', terms: ['guarda chuva', 'sombrinha', 'capa de chuva'] },

  // ═══════════════════════════════════════════════════════════════════
  // MARCAS
  //
  // Na prática ninguém escreve "refrigerante de cola": escreve "coca",
  // "H2OH", "Omo". Sem marca no dicionário, o produto mais comum da
  // gôndola cai em "Outros" com 📦 — foi o caso do H2OH reportado.
  //
  // Marca que também é palavra comum do português fica DE FORA quando
  // sozinha ("original", "quero", "sol", "prata"): o prejuízo de sequestrar
  // um nome legítimo é maior que o ganho. Nesses casos vale só a expressão
  // inteira ("guarana antarctica", "cerveja antarctica").
  // ═══════════════════════════════════════════════════════════════════

  // ── Bebidas ──
  { emoji: '🥤', label: 'refrigerante', category: 'bebidas', brand: true, terms: [
    'coca', 'coca cola', 'coca zero', 'pepsi', 'pepsi black', 'guarana antarctica',
    'fanta', 'sprite', 'schweppes', 'sukita', 'kuat', 'itubaina', 'tubaina', 'dolly',
    'guaracamp', 'guarana jesus', 'mineirinho', 'schin', 'nova schin', 'bare',
  ] },
  { emoji: '💧', label: 'água saborizada', category: 'bebidas', brand: true, terms: [
    'h2oh', 'h2o', 'aquarius', 'levite', 'crystal', 'bonafont', 'minalba', 'indaia',
    'lindoya', 'sao lourenco', 'agua da pedra', 'perrier',
  ] },
  { emoji: '🧃', label: 'suco', category: 'bebidas', brand: true, terms: [
    'del valle', 'ades', 'tang', 'maguary', 'tial', 'dafruta', 'camp', 'fruthos',
    'suco prats', 'natural one', 'do bem', 'greenpeople',
  ] },
  { emoji: '⚡', label: 'energético', category: 'bebidas', brand: true, terms: [
    'red bull', 'monster', 'tnt', 'baly', 'fusion', 'burn', 'flying horse',
    'gatorade', 'powerade', 'sport drink',
  ] },
  { emoji: '🍺', label: 'cerveja', category: 'bebidas', brand: true, terms: [
    'skol', 'brahma', 'cerveja antarctica', 'bohemia', 'itaipava', 'petra', 'amstel',
    'heineken', 'budweiser', 'stella artois', 'spaten', 'eisenbahn', 'corona',
    'devassa', 'serramalte', 'therezopolis', 'baden baden', 'colorado', 'patagonia',
    'kaiser', 'bavaria', 'proibida', 'imperio',
  ] },
  { emoji: '🥃', label: 'destilado', category: 'bebidas', brand: true, terms: [
    'red label', 'black label', 'jack daniels', 'ballantines', 'chivas', 'old parr',
    'natu nobilis', 'passaporte', 'velho barreiro', 'pitu', 'ypioca',
    'smirnoff', 'absolut', 'orloff', 'askov', 'tanqueray', 'beefeater', 'bacardi',
    'campari', 'martini', 'cynar', 'jurupinga',
  ] },
  { emoji: '☕', label: 'café', category: 'bebidas', brand: true, terms: [
    'nescafe', 'melitta', 'pilao', 'tres coracoes', 'do ponto', 'caboclo',
    'utam', 'iguacu', 'cafe brasileiro', 'santa clara cafe', 'dolce gusto', 'nespresso',
  ] },
  { emoji: '🍵', label: 'chá', category: 'bebidas', brand: true, terms: ['matte leao', 'leao', 'lipton', 'twinings', 'dr oetker cha'] },
  { emoji: '🥛', label: 'leite', category: 'bebidas', brand: true, terms: [
    'italac', 'piracanjuba', 'parmalat', 'elege', 'tirol', 'shefa', 'ccgl', 'ninho',
    'molico', 'itambe', 'betania', 'lider leite', 'camponesa', 'jussara leite',
  ] },
  { emoji: '🍫', label: 'achocolatado', category: 'bebidas', brand: true, terms: ['nescau', 'toddy', 'toddynho', 'ovomaltine', 'chocolate italac'] },

  // ── Alimentos ──
  { emoji: '🥛', label: 'iogurte', category: 'mercearia', brand: true, terms: [
    'danone', 'activia', 'vigor', 'batavo', 'yakult', 'chambinho', 'chamyto',
    'danoninho', 'nesfit iogurte', 'paulista',
  ] },
  { emoji: '🧈', label: 'margarina', category: 'mercearia', brand: true, terms: ['qualy', 'becel', 'delicia', 'doriana', 'primor', 'claybom'] },
  { emoji: '🧀', label: 'queijo', category: 'mercearia', brand: true, terms: ['polenghi', 'president', 'tirolez', 'scala', 'faixa azul', 'philadelphia'] },
  { emoji: '🥓', label: 'frios', category: 'mercearia', brand: true, terms: ['sadia', 'perdigao', 'seara', 'aurora', 'rezende', 'pif paf', 'frimesa', 'marba'] },
  { emoji: '🥩', label: 'carne', category: 'mercearia', brand: true, terms: ['friboi', 'swift', 'maturatta', 'montana', 'bassi'] },
  { emoji: '🍚', label: 'arroz', category: 'mercearia', brand: true, terms: ['tio joao', 'camil', 'prato fino', 'kicaldo', 'broto legal', 'coamo', 'ruzene', 'urbano', 'blue ville', 'solito'] },
  { emoji: '🍝', label: 'macarrão', category: 'mercearia', brand: true, terms: ['renata', 'adria', 'barilla', 'petybon', 'isabela', 'santa amalia', 'basilar'] },
  { emoji: '🍜', label: 'miojo', category: 'mercearia', brand: true, terms: ['nissin', 'cup noodles', 'lamen'] },
  { emoji: '🥫', label: 'molho e enlatado', category: 'mercearia', brand: true, terms: [
    'fugini', 'heinz', 'hellmanns', 'arisco', 'knorr', 'maggi', 'sazon', 'ajinomoto',
    'kitano', 'pomarola', 'elefante', 'tarantella', 'predilecta', 'cepera', 'bonare',
    'quero molho', 'linea molho',
  ] },
  { emoji: '🍬', label: 'açúcar', category: 'mercearia', brand: true, terms: ['uniao', 'guarani', 'da barra', 'caravelas', 'alto alegre', 'doce menor'] },
  { emoji: '🌾', label: 'farinha', category: 'mercearia', brand: true, terms: ['dona benta', 'anaconda', 'rosa branca', 'yoki', 'vilma', 'venturelli', 'sinha'] },
  { emoji: '🛢️', label: 'óleo', category: 'mercearia', brand: true, terms: ['liza', 'soya', 'concordia oleo', 'coamo oleo'] },
  { emoji: '🍪', label: 'biscoito', category: 'mercearia', brand: true, terms: [
    'bauducco', 'marilan', 'vitarella', 'piraque', 'club social', 'trakinas', 'bono',
    'passatempo', 'negresco', 'oreo', 'tortuguita', 'nesfit', 'aymore', 'richester',
  ] },
  { emoji: '🍫', label: 'chocolate', category: 'mercearia', brand: true, terms: [
    'lacta', 'garoto', 'talento', 'bis', 'sonho de valsa', 'ouro branco', 'diamante negro',
    'baton', 'kitkat', 'milka', 'ferrero', 'nutella', 'prestigio', 'charge', 'twix',
    'snickers', 'tablete de chocolate',
  ] },
  { emoji: '🍿', label: 'salgadinho', category: 'mercearia', brand: true, terms: [
    'doritos', 'cheetos', 'ruffles', 'fandangos', 'elma chips', 'pringles', 'torcida',
    'baconzitos', 'fofura', 'skiny', 'pipoca microondas',
  ] },
  { emoji: '🍨', label: 'sorvete', category: 'mercearia', brand: true, terms: ['kibon', 'nestle sorvete', 'magnum', 'cornetto', 'fruttare', 'jundia'] },

  // ── Limpeza ──
  { emoji: '🧼', label: 'sabão', category: 'casa', brand: true, terms: ['omo', 'ariel', 'tixan', 'brilhante', 'surf', 'minuano', 'ype sabao', 'bem te vi', 'invicto'] },
  { emoji: '🧴', label: 'produto de limpeza', category: 'casa', brand: true, terms: [
    'ype', 'limpol', 'veja', 'cif', 'mr musculo', 'pato', 'harpic', 'vanish', 'comfort',
    'downy', 'fofo', 'pinho sol', 'qboa', 'candida', 'sanol', 'lysoform', 'girando sol',
    'audaz', 'dragao', 'kalipto', 'azulim', 'destac', 'urca',
  ] },
  { emoji: '🧽', label: 'esponja', category: 'casa', brand: true, terms: ['bombril', 'assolan', 'scotch brite', 'perfex', 'esponja 3m'] },
  { emoji: '🦟', label: 'inseticida', category: 'casa', brand: true, terms: ['raid', 'sbp', 'baygon', 'jimo', 'exodus'] },
  { emoji: '🌸', label: 'aromatizante', category: 'casa', brand: true, terms: ['bom ar', 'glade', 'ar puro', 'via aroma'] },

  // ── Higiene e farmácia ──
  { emoji: '🪥', label: 'higiene bucal', category: 'casa', brand: true, terms: ['colgate', 'sorriso', 'close up', 'oral b', 'sensodyne', 'listerine', 'tandy', 'even'] },
  { emoji: '🧼', label: 'sabonete', category: 'casa', brand: true, terms: ['dove', 'lux', 'protex', 'palmolive', 'nivea sabonete', 'granado', 'phebo', 'francis', 'giby'] },
  { emoji: '🧴', label: 'cabelo e pele', category: 'casa', brand: true, terms: [
    'rexona', 'nivea', 'monange', 'seda', 'pantene', 'elseve', 'tresemme', 'clear',
    'head shoulders', 'johnsons', 'natura', 'avon', 'oboticario', 'boticario', 'garnier',
    'loreal', 'wella', 'salon line', 'skala', 'lola', 'dove shampoo', 'sundown', 'nutriv',
  ] },
  { emoji: '🪒', label: 'barbear', category: 'casa', brand: true, terms: ['gillette', 'prestobarba', 'bic barbear', 'veet', 'depil bella'] },
  { emoji: '👶', label: 'bebê', category: 'casa', brand: true, terms: ['pampers', 'huggies', 'mamypoko', 'turma da monica fralda', 'babysec', 'pom pom'] },
  { emoji: '🧻', label: 'absorvente', category: 'casa', brand: true, terms: ['always', 'intimus', 'sempre livre', 'carefree'] },
  { emoji: '💊', label: 'remédio', category: 'casa', brand: true, terms: ['dorflex', 'novalgina', 'tylenol', 'advil', 'neosaldina', 'buscopan', 'engov', 'eno', 'sonrisal', 'centrum', 'redoxon'] },

  // ── Pet ──
  { emoji: '🐾', label: 'pet', category: 'casa', brand: true, terms: ['pedigree', 'whiskas', 'golden racao', 'premier racao', 'friskies', 'dog chow', 'cat chow', 'fostex', 'baby cat'] },

  // ═══════════════════════════════════════════════════════════════════
  // CASA E BAZAR — o que se compra no supermercado e não é comida
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '💇', label: 'cuidado com cabelo', category: 'casa', terms: [
    'pente', 'escova de cabelo', 'secador de cabelo', 'chapinha', 'elastico de cabelo',
    'presilha', 'tiara', 'grampo de cabelo', 'touca', 'rede de cabelo', 'escova progressiva',
  ] },
  { emoji: '💅', label: 'unhas', category: 'casa', terms: ['esmalte', 'acetona', 'removedor de esmalte', 'base para unha', 'palito de unha', 'kit manicure'] },
  { emoji: '💄', label: 'maquiagem', category: 'casa', terms: ['maquiagem', 'batom', 'rimel', 'corretivo', 'po compacto', 'delineador', 'lapis de olho', 'blush', 'sombra', 'primer', 'gloss'] },
  { emoji: '🪞', label: 'espelho', category: 'casa', terms: ['espelho', 'espelho de bolsa'] },
  { emoji: '🚿', label: 'banho', category: 'casa', terms: ['esponja de banho', 'bucha vegetal', 'chuveiro', 'ducha', 'mangueira', 'cortina de box', 'tapete de banheiro'] },
  { emoji: '🩺', label: 'saúde', category: 'casa', terms: [
    'aparelho de pressao', 'medidor de glicose', 'glicosimetro', 'seringa', 'agulha',
    'preservativo', 'camisinha', 'teste de gravidez', 'absorvente interno', 'protetor diario',
    'coletor menstrual', 'fralda geriatrica', 'oximetro',
  ] },
  { emoji: '🔌', label: 'elétrica', category: 'casa', terms: [
    'extensao', 'adaptador', 'tomada', 'benjamin', 'filtro de linha', 'interruptor',
    'carregador', 'cabo usb', 'fone de ouvido', 'pen drive', 'cartao de memoria',
  ] },
  { emoji: '🔧', label: 'ferramenta', category: 'casa', terms: [
    'martelo', 'chave de fenda', 'chave philips', 'prego', 'bucha de parede',
    'fita isolante', 'veda rosca', 'trena', 'furadeira', 'serrote', 'lixa de parede',
    'cola instantanea', 'silicone', 'massa corrida',
  ] },
  { emoji: '🎨', label: 'pintura', category: 'casa', terms: ['tinta', 'pincel', 'rolo de pintura', 'thinner', 'verniz', 'fita crepe'] },
  { emoji: '🔑', label: 'chave e cadeado', category: 'casa', terms: ['cadeado', 'fechadura', 'copia de chave', 'corrente'] },
  { emoji: '🚰', label: 'filtro de água', category: 'casa', terms: ['filtro de agua', 'refil de filtro', 'vela de filtro', 'purificador'] },
  { emoji: '🛍️', label: 'sacola', category: 'casa', terms: ['sacola', 'sacola retornavel', 'ecobag', 'carrinho de feira'] },
  { emoji: '🧸', label: 'brinquedo', category: 'outros', terms: ['brinquedo', 'boneca', 'carrinho de brinquedo', 'quebra cabeca', 'jogo de tabuleiro', 'bola'] },
  { emoji: '🎈', label: 'festa', category: 'outros', terms: ['balao', 'bexiga', 'chapeu de festa', 'toalha de mesa descartavel', 'forminha de doce', 'confete'] },
  { emoji: '🎒', label: 'escolar', category: 'outros', terms: ['mochila', 'estojo', 'calculadora', 'lancheira', 'garrafinha', 'squeeze'] },

  // ═══════════════════════════════════════════════════════════════════
  // MERCEARIA — o resto da despensa brasileira
  // ═══════════════════════════════════════════════════════════════════
  { emoji: '🧁', label: 'confeitaria', category: 'mercearia', terms: [
    'fermento', 'fermento em po', 'fermento biologico', 'bicarbonato', 'essencia',
    'corante alimenticio', 'granulado colorido', 'chocolate granulado', 'raspas de chocolate',
    'coco ralado para bolo', 'papel para cupcake', 'cobertura de chocolate', 'chocolate em barra culinario',
    'leite ninho em po', 'acucar cristal',
  ] },
  { emoji: '🥣', label: 'saudável', category: 'mercearia', terms: [
    'pasta de amendoim', 'tofu', 'proteina de soja', 'carne de soja', 'psyllium',
    'barra de proteina', 'acucar de coco', 'oleo de linhaca', 'levedura nutricional',
    'sementes', 'mix de sementes', 'farelo de aveia', 'fibra alimentar',
  ] },
  { emoji: '🍲', label: 'prato brasileiro', category: 'mercearia', terms: [
    'canjiquinha', 'mungunza', 'baiao de dois', 'virado a paulista', 'tutu de feijao',
    'feijao tropeiro', 'vaca atolada', 'dobradinha', 'buchada', 'sarapatel', 'tucupi',
    'jambu', 'camarao seco', 'farinha d agua', 'pacoca de carne',
    'caldo verde', 'canja',
  ] },
  { emoji: '🥫', label: 'patê e conserva', category: 'mercearia', terms: [
    'pate', 'pate de atum', 'pate de frango', 'salsicha em conserva', 'pepino em conserva',
    'cebola em conserva', 'antepasto', 'geleia de pimenta', 'chucrute',
  ] },
  { emoji: '🧊', label: 'congelado', category: 'mercearia', terms: [
    'brocolis congelado', 'ervilha congelada', 'legumes congelados', 'polpa congelada',
    'massa folhada', 'massa de pastel congelada', 'pao de queijo congelado',
  ] },
  { emoji: '🍼', label: 'alimentação infantil', category: 'mercearia', terms: [
    'papinha', 'formula infantil', 'cereal infantil', 'leite infantil', 'suco infantil',
    'biscoito de bebe', 'nan', 'aptamil',
  ] },
  { emoji: '🧂', label: 'especiaria', category: 'mercearia', terms: [
    'paprica', 'gengibre em po', 'canela em pau', 'alho em po', 'cebola em po',
    'mix de pimentas', 'sal de ervas', 'tempero para churrasco', 'tempero para peixe',
    'molho de alho', 'raiz forte', 'wasabi',
  ] },
];

// Pistas genéricas: valem só quando nenhum produto do dicionário bateu.
// São checadas por palavra inteira, na ordem, e servem pra não jogar em
// "Outros" um nome descritivo que a lista ainda não conhece
// ("desengordurante forte", "bebida de soja", "corte bovino").
export const HINTS: { terms: string[]; category: CategoryKey; emoji: string; label: string }[] = [
  { terms: ['limpeza', 'limpa', 'higiene', 'perfumaria', 'lavanderia', 'desentupidor'], category: 'casa', emoji: '🧴', label: 'produto de limpeza' },
  { terms: ['bovino', 'suino', 'bovina', 'suina', 'file', 'corte'], category: 'mercearia', emoji: '🥩', label: 'carne' },
  { terms: ['congelado', 'congelada'], category: 'mercearia', emoji: '🧊', label: 'congelado' },
  { terms: ['integral', 'diet', 'light', 'zero'], category: 'mercearia', emoji: '🛒', label: 'mercearia' },
  { terms: ['bebida', 'drink'], category: 'bebidas', emoji: '🥤', label: 'bebida' },
];
