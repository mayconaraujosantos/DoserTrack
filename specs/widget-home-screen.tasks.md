# Tasks: Widget de Tela Inicial

**Derivado de:** `specs/widget-home-screen.md`  
**Status:** Pendente  
**Engineer:** —

---

## Pré-requisitos

- [ ] Ler a spec completa (`specs/widget-home-screen.md`) antes de iniciar
- [ ] Verificar se `expo-notifications` e `expo-constants` estão atualizados
- [ ] Confirmar versão mínima de Expo SDK suportada pelo plugin de widget

---

## Setup e Infraestrutura

- [ ] Instalar e configurar config plugin de widget para Expo (ex: `@bam.tech/react-native-make` ou solução nativa)
- [ ] Adicionar config plugin no `app.json` para Android AppWidget e iOS WidgetKit
- [ ] Criar módulo de bridge `lib/widget-bridge.ts` para escrita do payload compartilhado
- [ ] Definir tipo `WidgetPayload` em `types/index.ts`:
  ```typescript
  interface WidgetPayload {
    profileId: number;
    profileName: string;
    date: string; // YYYY-MM-DD
    doses: Array<{ id: number; medicineName: string; scheduledTime: string; status: DoseStatus }>;
    updatedAt: string;
  }
  ```

---

## Bridge de Dados (CA-13, CA-14, CA-15)

- [ ] Implementar `writeWidgetPayload(payload: WidgetPayload)` em `lib/widget-bridge.ts`
  - Android: usar `SharedPreferences` via módulo nativo ou `expo-modules-core`
  - iOS: usar `App Groups` UserDefaults via módulo nativo
- [ ] Chamar `writeWidgetPayload` após cada atualização de status de dose (`updateDoseStatus` em `lib/database.ts`)
- [ ] Chamar `writeWidgetPayload` ao trocar de perfil ativo
- [ ] Escrever testes para `lib/widget-bridge.ts` (mock do módulo nativo)

---

## Android AppWidget (CA-01 a CA-06)

- [ ] Criar layout XML do widget em `android/app/src/main/res/layout/widget_layout.xml`
- [ ] Implementar `DoserWidgetProvider extends AppWidgetProvider` em Kotlin
- [ ] Configurar `appwidget-provider` metadata com tamanhos 2x1 e 4x2
- [ ] Ler payload do `SharedPreferences` no `onUpdate`
- [ ] Renderizar lista de doses (máx 5) com nome, horário e ícone de status
- [ ] Implementar intent de abertura do app ao tocar no widget (deep link para Home)
- [ ] Aplicar tema light/dark baseado em `UiModeManager`
- [ ] Exibir "Nenhuma dose para hoje" quando lista vazia
- [ ] Exibir "+N mais" quando doses > 5

---

## iOS WidgetKit (CA-07 a CA-12)

- [ ] Criar Widget Extension no Xcode (`DoserWidget`)
- [ ] Implementar `DoserWidgetEntry` com dados de doses
- [ ] Implementar `DoserWidgetProvider: TimelineProvider`
  - `getSnapshot`: retorna entry com dados atuais
  - `getTimeline`: retorna entries com `refreshAfter = .atEnd` para reload a cada 15min
- [ ] Ler payload do `UserDefaults` do App Group compartilhado
- [ ] Criar views SwiftUI para tamanhos `small`, `medium` e `large`
- [ ] Implementar `widgetURL` para deep link ao tocar
- [ ] Suportar `colorScheme` do ambiente (light/dark automático)
- [ ] Chamar `WidgetCenter.shared.reloadAllTimelines()` do lado React Native após atualizar payload

---

## Integração com o App React Native (CA-04, CA-10)

- [ ] Configurar deep link `doser://home` no `app.json` (scheme já deve existir)
- [ ] Verificar que `app/index.tsx` trata o deep link `doser://home` e navega para `/(app)/(tabs)`

---

## Testes

- [ ] Teste unitário: `writeWidgetPayload` serializa corretamente o `WidgetPayload`
- [ ] Teste unitário: payload filtrado por `profile_id` ativo (CA-15)
- [ ] Teste de integração: marcar dose atualiza o payload do widget (CA-13)
- [ ] Teste manual (Android): widget aparece na home screen e exibe doses corretamente
- [ ] Teste manual (iOS): widget aparece na galeria e exibe doses corretamente
- [ ] Teste manual: tocar no widget abre o app na Home

---

## Critérios de Conclusão (Review Agent)

- Todos os CAs de `specs/widget-home-screen.md` marcados como `[x]`
- Testes unitários passando (`bun run test`)
- Cobertura do `lib/widget-bridge.ts` ≥ 80%
- Widget testado manualmente em Android emulador e dispositivo iOS físico
- Review Agent aprova sem divergências entre spec e implementação
