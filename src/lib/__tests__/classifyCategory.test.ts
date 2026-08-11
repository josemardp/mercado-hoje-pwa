import { describe, it, expect } from 'vitest';
import {
  classifyItem,
  classifyItemSync,
  upgradeItemClassification,
  isGenericEmoji,
  fallbackEmojiForCategory,
} from '../classifyCategory';

describe('classifyItem — categoria', () => {
  it('classifica fruta, verdura, bebida, mercearia e casa', () => {
    expect(classifyItemSync('Banana').category).toBe('frutas');
    expect(classifyItemSync('Alface crespa').category).toBe('frutas');
    expect(classifyItemSync('Cerveja').category).toBe('bebidas');
    expect(classifyItemSync('Arroz').category).toBe('mercearia');
    expect(classifyItemSync('Papel higiênico').category).toBe('casa');
  });

  it('cai em "outros" quando não reconhece', () => {
    expect(classifyItemSync('xyzzyplugh').category).toBe('outros');
  });

  it('ignora acento e maiúscula', () => {
    expect(classifyItemSync('acucar').category).toBe('mercearia');
    expect(classifyItemSync('AÇÚCAR').category).toBe('mercearia');
    expect(classifyItemSync('Feijão').category).toBe('mercearia');
  });

  it('entende plural', () => {
    expect(classifyItemSync('Bananas').emoji).toBe('🍌');
    expect(classifyItemSync('Ovos').emoji).toBe('🥚');
    expect(classifyItemSync('Limões').emoji).toBe('🍋');
    expect(classifyItemSync('Pães').emoji).toBe('🍞');
  });

  it('ignora quantidade, unidade e embalagem no nome', () => {
    expect(classifyItemSync('2kg de arroz branco').emoji).toBe('🍚');
    expect(classifyItemSync('Leite 1 litro').emoji).toBe('🥛');
    expect(classifyItemSync('6 latas de cerveja').emoji).toBe('🍺');
    expect(classifyItemSync('500ml de detergente').category).toBe('casa');
  });

  // ─── Regressões do classificador anterior, que casava PEDAÇO de palavra
  // com `nome.includes(palavra)` em vez de palavra inteira. Cada caso
  // abaixo era classificado errado, e a lista mostrava o item na aba
  // errada com o emoji errado.
  it('não confunde palavra com pedaço de outra palavra', () => {
    // continha "cha" (chá) e virava bebida
    expect(classifyItemSync('Salsicha').category).toBe('mercearia');
    // continha "uva" e virava fruta
    expect(classifyItemSync('Luva de borracha').category).toBe('casa');
    // continha "roma" (romã) e virava fruta
    expect(classifyItemSync('Aromatizante').category).toBe('casa');
    // continha "sal" e "cha"
    expect(classifyItemSync('Salsinha').category).toBe('frutas');
    // continha "coco" e virava fruta
    expect(classifyItemSync('Chocolate').category).toBe('mercearia');
  });

  it('expressão mais específica vence a palavra solta', () => {
    // "creme" sozinho é produto de cabelo (casa); com "de leite", não.
    expect(classifyItemSync('Creme de leite').category).toBe('mercearia');
    expect(classifyItemSync('Creme para pentear').category).toBe('casa');
    // "leite" é bebida; "leite condensado" e "leite de coco" não.
    expect(classifyItemSync('Leite').category).toBe('bebidas');
    expect(classifyItemSync('Leite condensado').category).toBe('mercearia');
    expect(classifyItemSync('Leite de coco').emoji).toBe('🥥');
    // "milho" é hortifrúti; "farinha de milho" é mercearia.
    expect(classifyItemSync('Milho verde').category).toBe('frutas');
    expect(classifyItemSync('Farinha de milho').category).toBe('mercearia');
    // "água" é bebida; "água sanitária" é limpeza.
    expect(classifyItemSync('Água mineral').category).toBe('bebidas');
    expect(classifyItemSync('Água sanitária').category).toBe('casa');
    // "batata" é hortifrúti; "batata frita" (congelada) é mercearia.
    expect(classifyItemSync('Batata').category).toBe('frutas');
    expect(classifyItemSync('Batata frita congelada').category).toBe('mercearia');
  });
});

describe('classifyItem — emoji do produto', () => {
  it('dá emoji do próprio produto, não da categoria', () => {
    expect(classifyItemSync('Vinagre de maçã').emoji).toBe('🍶');
    expect(classifyItemSync('Fio dental').emoji).toBe('🦷');
    expect(classifyItemSync('Molho de tomate').emoji).toBe('🥫');
    expect(classifyItemSync('Esponja de aço').emoji).toBe('🧽');
    expect(classifyItemSync('Café').emoji).toBe('☕');
    expect(classifyItemSync('Frango').emoji).toBe('🍗');
    expect(classifyItemSync('Cenoura').emoji).toBe('🥕');
    expect(classifyItemSync('Sabão em pó').emoji).toBe('🧼');
  });

  it('dois produtos diferentes da mesma categoria não ganham o mesmo emoji', () => {
    const arroz = classifyItemSync('Arroz');
    const carne = classifyItemSync('Picanha');
    expect(arroz.category).toBe(carne.category);
    expect(arroz.emoji).not.toBe(carne.emoji);
  });

  it('usa o emoji genérico só no que não reconhece', () => {
    expect(classifyItemSync('xyzzyplugh').emoji).toBe('📦');
    expect(isGenericEmoji('📦')).toBe(true);
    expect(isGenericEmoji('🍌')).toBe(false);
    expect(fallbackEmojiForCategory('frutas')).toBe('🍎');
  });

  it('reconhece marcas comuns de supermercado', () => {
    expect(classifyItemSync('Coca cola 2l').category).toBe('bebidas');
    expect(classifyItemSync('Omo').category).toBe('casa');
    expect(classifyItemSync('Colgate').emoji).toBe('🪥');
    expect(classifyItemSync('Nescau').category).toBe('bebidas');
  });
});

describe('upgradeItemClassification — correção de itens já salvos', () => {
  it('troca o emoji genérico pelo emoji do produto', () => {
    expect(upgradeItemClassification({ name: 'Vinagre', emoji: '🛒', category: 'mercearia' }))
      .toEqual({ emoji: '🍶' });
  });

  it('tira de "Outros" o que o classificador antigo não reconhecia', () => {
    expect(upgradeItemClassification({ name: 'Fio dental', emoji: '📦', category: 'outros' }))
      .toEqual({ emoji: '🦷', category: 'casa' });
  });

  it('não mexe em emoji específico já escolhido', () => {
    expect(upgradeItemClassification({ name: 'Chinelo', emoji: '🩴', category: 'outros' })).toBeNull();
    expect(upgradeItemClassification({ name: 'Linguiça', emoji: '🌭', category: 'mercearia' })).toBeNull();
  });

  it('não revê categoria que o usuário corrigiu à mão', () => {
    // Leite está no dicionário como bebida, mas este ficou em mercearia:
    // só o emoji genérico é corrigido, a categoria escolhida permanece.
    const upgrade = upgradeItemClassification({ name: 'Leite', emoji: '🛒', category: 'mercearia' });
    expect(upgrade).toEqual({ emoji: '🥛' });
  });

  it('não inventa nada para item desconhecido', () => {
    expect(upgradeItemClassification({ name: 'xyzzyplugh', emoji: '📦', category: 'outros' })).toBeNull();
  });
});

describe('classifyItem — contrato assíncrono usado pelo App', () => {
  it('continua resolvendo por Promise', async () => {
    const result = await classifyItem('Banana');
    expect(result).toEqual({ category: 'frutas', emoji: '🍌', emojiName: 'banana' });
  });
});
