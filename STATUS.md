# Status: Meu Diário

App pessoal, offline-first, instalável como PWA em Android e iOS, com três módulos:

## Pendências herdadas do Mentor de Projetos (importadas em 16/11/2026)

O Mentor de Projetos foi aposentado em 16/11/2026. O que estava aberto nele veio para cá. Marque `- [x]` ao concluir.

- Objetivo: Consertar a sincronização entre celular e PC e publicar a correção no ar.
- Foco na última sessão: Validar em uso real a sincronizacao entre PC e celular com a migration aplicada
- Última entrega: App publicado em dois aparelhos simulados: 0,8s do PC ao celular e 1,0s do celular ao PC, sem recarregar

### Pendências

- [ ] Testar marcação e desmarcação em uso real simultâneo no PC e no celular para validação final das ações pelo usuário. [act-005]
- [ ] Validar em uso real a sincronizacao entre PC e celular com a migration aplicada [act-007]
- [ ] Fazer categoria editada em outro aparelho chegar ao catalogo (merge de useItems so olha last_used) [act-010]
- [ ] Descobrir por que push na main nao dispara o deploy e hoje exige gh workflow run [act-011]

### Decisões recentes registradas no Mentor

- 2026-09-18: Adotar tolerância de 2 segundos no LWW local favorecendo `checked: true` em caso de empate para absorver skew de relógio entre dispositivos.
- 2026-09-18: Aplicação de migração SQL diretamente no Supabase Dashboard com permissões estritas (`REVOKE FROM PUBLIC, anon`).
- 2026-11-01: Realtime é o caminho principal; polling de 15s e foco de 2s são rede de segurança para canal caído ou publicação desfeita.
- 2026-11-01: `updated_at` segue o relógio do servidor via offset do header `Date`, respeitando a tolerância de 2s já existente no LWW.
- 2026-11-01: Eventos de `mh_items` que mudam só `use_count` não disparam recarga do catálogo.
- 2026-11-01: Manter a migration no repositório como registro do estado aplicado.
- 2026-11-01: Verificação feita por consulta ao catálogo, não por inspeção visual do dashboard.
- 2026-11-01: Aceitar que o DELETE do Realtime ignora RLS e expõe só a chave primária (D-024).
- 2026-11-01: Não reprocessar a fila no Realtime nem no polling, para falha passageira não esgotar as tentativas a cada 15s.
- 2026-11-01: Manter o filtro de `use_count`: o `old` veio completo no UPDATE em teste real, apesar da documentação.
