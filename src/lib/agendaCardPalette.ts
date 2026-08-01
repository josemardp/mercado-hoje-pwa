// Shared between AgendaPlanner.tsx's normal task cards and AgendaGoMode.tsx's
// focus card, so a task keeps the same accent color whether you're looking
// at the plain list or running it through "modo Go". Cycled by position in
// the (sorted) task list, not task identity — purely decorative variety,
// not a category signal (agenda tasks are freeform).
export const CARD_PALETTE = [
  { grad: 'linear-gradient(135deg, #FF6B9D, #FFB347)', tint: 'linear-gradient(135deg, rgba(255,107,157,0.22), rgba(255,179,71,0.12))' },
  { grad: 'linear-gradient(135deg, #4FACFE, #00F2FE)', tint: 'linear-gradient(135deg, rgba(79,172,254,0.22), rgba(0,242,254,0.12))' },
  { grad: 'linear-gradient(135deg, #A78BFA, #F472B6)', tint: 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(244,114,182,0.12))' },
  { grad: 'linear-gradient(135deg, #43E97B, #38F9D7)', tint: 'linear-gradient(135deg, rgba(67,233,123,0.22), rgba(56,249,215,0.12))' },
  { grad: 'linear-gradient(135deg, #FFAA33, #FFE066)', tint: 'linear-gradient(135deg, rgba(255,170,51,0.22), rgba(255,224,102,0.12))' },
  { grad: 'linear-gradient(135deg, #6C63FF, #4FACFE)', tint: 'linear-gradient(135deg, rgba(108,99,255,0.22), rgba(79,172,254,0.12))' },
];
