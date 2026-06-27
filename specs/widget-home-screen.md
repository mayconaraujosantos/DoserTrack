# Spec: Widget de Tela Inicial

**Versão:** 1.0  
**Status:** Em implementação  
**Feature:** Widget Android/iOS mostrando doses do dia na tela inicial do dispositivo

---

## Objetivo

Exibir as doses pendentes do dia diretamente na tela inicial do dispositivo, permitindo que o usuário veja rapidamente o que precisa tomar sem abrir o app.

## Contexto

Usuários frequentemente esquecem de abrir o app para verificar suas doses. Um widget na tela inicial cria um ponto de lembrança passivo e visual, complementando as notificações ativas. O widget deve ser leve, atualizável e mostrar dados do perfil ativo.

## Requisitos Funcionais

1. O widget exibe a lista de doses do dia atual do perfil ativo
2. Cada dose no widget mostra: nome do medicamento, horário e status (pendente/tomada)
3. O widget atualiza automaticamente quando há mudança de status de dose no app
4. Tocar no widget abre o app diretamente na Home (doses do dia)
5. O widget exibe mensagem de boas-vindas quando não há doses para o dia
6. O widget suporta os tamanhos padrão do sistema (pequeno, médio, grande no iOS; 2x1, 4x2 no Android)

## Requisitos Não-Funcionais

- Widget atualiza em no máximo 15 minutos após mudança de dado no app (limitação do sistema)
- Dados do widget são lidos do SQLite local via bridge (sem chamada à internet)
- O widget deve respeitar o tema do sistema (light/dark) do dispositivo
- Tamanho do payload de dados do widget: máximo 64KB

## Regras de Negócio

- Widget exibe apenas doses do **perfil ativo** no momento da última atualização
- Doses exibidas: apenas as do dia atual (`scheduled_time` com `date = today`)
- Status exibido: `pending` (mostrar horário) e `taken` (mostrar ✓); `skipped` não é exibido
- Máximo de 5 doses exibidas no widget para não sobrecarregar o layout
- Se há mais de 5 doses, exibe as 5 mais próximas e indicador "+N mais"

## Critérios de Aceitação

**Android (AppWidget)**

- [ ] CA-01: Widget aparece na lista de widgets do Android e pode ser adicionado à home screen
- [ ] CA-02: Widget exibe doses do dia com nome do medicamento e horário
- [ ] CA-03: Dose marcada como `taken` no app aparece com ✓ no widget após atualização
- [ ] CA-04: Tocar no widget abre o app na tela Home
- [ ] CA-05: Widget sem doses exibe "Nenhuma dose para hoje"
- [ ] CA-06: Widget respeita tema light/dark do sistema

**iOS (WidgetKit)**

- [ ] CA-07: Widget aparece na galeria de widgets do iOS e pode ser adicionado à home screen
- [ ] CA-08: Widget exibe doses do dia com nome do medicamento e horário
- [ ] CA-09: Dose marcada como `taken` no app aparece com ✓ no widget após Timeline reload
- [ ] CA-10: Tocar no widget abre o app na tela Home via deep link
- [ ] CA-11: Widget sem doses exibe "Nenhuma dose para hoje"
- [ ] CA-12: Widget suporta tamanhos small, medium e large

**Bridge de dados**

- [x] CA-13: App escreve dados das doses no payload compartilhado ao marcar qualquer status
- [x] CA-14: Widget lê dados do payload local (sem internet)
- [x] CA-15: Dados do widget são filtrados pelo `profile_id` ativo

## Casos de Erro

| Situação                              | Comportamento esperado                                   |
| ------------------------------------- | -------------------------------------------------------- |
| App nunca aberto após instalar widget | Widget exibe "Abra o app para começar"                   |
| Bridge de dados corrompido            | Widget exibe última leitura válida ou estado vazio       |
| Perfil ativo removido                 | Widget exibe estado vazio até o app ser aberto novamente |

## Fora do Escopo

- Marcar doses diretamente pelo widget (sem abrir o app)
- Widget com dados de múltiplos perfis simultaneamente
- Notificações push originadas do widget
- Suporte a Expo Go (requer development build com config plugin)
