

export interface ClassificationResult {
  category: string;
  emoji: string;
  emojiName: string;
}

const FALLBACK_EMOJIS: Record<string, { emoji: string; name: string }> = {
  frutas: { emoji: '🍎', name: 'fruta' },
  bebidas: { emoji: '🥤', name: 'bebida' },
  mercearia: { emoji: '🛒', name: 'produto' },
  casa: { emoji: '🧻', name: 'produto de casa' },
  outros: { emoji: '📦', name: 'item' },
};

// Smart local classifier - checks local dictionary
function classifyLocal(name: string): ClassificationResult {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Order matters: check specific categories first, then broad ones
  const rules: { category: string; words: string[] }[] = [
    {
      category: 'frutas',
      words: [
        'banana', 'maca', 'laranja', 'limao', 'uva', 'morango', 'abacaxi', 'melancia',
        'melao', 'manga', 'pera', 'pessego', 'pessego', 'abacate', 'acerola', 'ameixa',
        'carambola', 'caju', 'coco', 'damasco', 'figo', 'fruta', 'goiaba', 'jabuticaba',
        'kiwi', 'maracuja', 'nectarina', 'pitaya', 'roma', 'tangerina', 'verdura', 'legume',
        'tomate', 'alface', 'cenoura', 'cebola', 'alho', 'batata', 'mandioca', 'abobora',
        'berinjela', 'chuchu', 'pepino', 'brocolis', 'couve', 'espinafre', 'coentro',
        'salsinha', 'cebolinha', 'rabanete', 'beterraba', 'inhame', 'nabo', 'repolho',
        'mandioquinha', 'ervilha', 'milho', 'folhas', 'hortaliça', 'rucula', 'agriao',
      ],
    },
    {
      category: 'casa',
      words: [
        'sabao', 'sabonete', 'papel higienico', 'shampoo', 'condicionador', 'creme',
        'desodorante', 'detergente', 'amaciante', 'alvejante', 'agua sanitaria',
        'lustra movel', 'lustramovel', 'desinfetante', 'esponja', 'vassoura', 'rodo',
        'lixeira', 'lixo', 'saco plastico', 'saco de lixo', 'pilha', 'lampada',
        'papel toalha', 'lenço', 'lenco', 'sabao em po', 'sabao em pó',
        'fio dental', 'escova', 'absorvente', 'fralda', 'pomada', 'remedio',
        'medicamento', 'algodao', 'algodão', 'cotonete', 'racao', 'ração', 'areia para gato',
        'areia de gato', 'pet', 'cachorro', 'gato',
      ],
    },
    {
      category: 'bebidas',
      words: [
        'agua', 'suco', 'refri', 'refrigerante', 'cerveja', 'vinho', 'leite', 'cafe',
        'cha', 'drink', 'vodka', 'whisky', 'cachaça', 'rum', 'gin', 'champagne',
        'espumante', 'agua de coco', 'isotonico', 'energetico', 'achocolatado',
        'leite condensado', 'leite de coco', 'leite de amendoas', 'leite vegetal',
        'suco natural', 'suco de uva', 'suco de laranja', 'agua mineral',
      ],
    },
    {
      category: 'mercearia',
      words: [
        'arroz', 'feijao', 'macarrao', 'massa', 'farinha', 'acucar', 'oleo', 'azeite',
        'manteiga', 'margarina', 'queijo', 'presunto', 'mortadela', 'salame',
        'peito de peru', 'ovo', 'ovos', 'pao', 'bisnaguinha', 'bolacha', 'biscoito',
        'cereal', 'granola', 'aveia', 'mel', 'geleia', 'doce', 'catchup', 'maionese',
        'mostarda', 'molho', 'tempero', 'condimento', 'sal', 'pimenta', 'oregano',
        'cominho', 'louro', 'colorau', 'frango', 'carne', 'boi', 'porco', 'peixe',
        'linguica', 'linguica', 'bacon', 'costela', 'file', 'almôndega', 'almôndega',
        'congelado', 'congelada', 'salsicha', 'sardinha', 'atum', 'conserva', 'extrato',
        'molho de tomato', 'creme de leite', 'iogurte', 'iogurte', 'queijo ralado',
        'parmesao', 'cheddar', 'mussarela', 'muçarela', 'ricota', 'requeijao', 'requeijão',
        'pizza', 'lanche', 'sanduiche', 'sanduíche', 'snack', 'batata frita', 'chips',
        'pipoca', 'amendoim', 'castanha', 'nozes', 'frutas secas', 'uva passa',
        'figo seco', 'tamaras', 'frango', 'galinha', 'peito de frango',
        'coxa', 'coxinha', 'asa de frango', 'acem', 'patinho', 'maminha',
        'picanha', 'alcatra', 'cupim', 'costela', 'costelinha', 'bisteca',
        'linguica', 'linguiça', 'bacon', 'calabresa', 'salsicha', 'hot dog',
        'iogurte', 'iogurte natural', 'iogurte de frutas',
        'leite em pó', 'leite em po', 'pó de café', 'po de cafe',
        'açucar', 'açúcar', 'açucar refinado', 'açucar demerara',
        'farinha de trigo', 'farinha de mandioca', 'farinha de milho',
        'fermento', 'fermento biologico', 'fermento biologico',
        'massa de tomate', 'passata', 'ketchup', 'catchup',
      ],
    },
  ];

  for (const rule of rules) {
    for (const word of rule.words) {
      if (n.includes(word)) {
        const em = FALLBACK_EMOJIS[rule.category];
        return { category: rule.category, emoji: em.emoji, emojiName: em.name };
      }
    }
  }

  return { category: 'outros', emoji: '📦', emojiName: 'item' };
}

// Main entry point: only local dictionary (removed OpenAI client-side call)
export async function classifyItem(itemName: string): Promise<ClassificationResult> {
  return classifyLocal(itemName);
}
