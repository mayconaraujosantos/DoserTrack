# Update Todos

## Export PDF

- [x] Instalar `expo-print`
- [x] Instalar `expo-sharing`
- [x] Criar `lib/report.ts`
- [x] Implementar geração do HTML do relatório em `lib/report.ts`
- [x] Implementar query de dados por período em `lib/database.ts`
- [x] Preparar imports de exportação em `app/(tabs)/history.tsx`
- [x] Adicionar botão de exportar PDF em `app/(tabs)/history.tsx`
- [x] Implementar handler com `Print.printToFileAsync`
- [x] Implementar compartilhamento com `Sharing.shareAsync`
- [x] Conectar estado `exporting` com loading/erro na UI

## Múltiplos perfis

- [x] Criar migração/tabela de perfis no banco
- [x] Adicionar `Profile` nos tipos
- [x] Adicionar `profileId` nas entidades relacionadas
- [x] Atualizar `lib/store.ts` para controlar perfil ativo
- [x] Criar `app/profiles.tsx`
- [x] Implementar lógica de perfil ativo em `app/_layout.tsx`
- [x] Filtrar queries e operações do banco por perfil

## Supabase

- [x] Criar `lib/supabase.ts`
- [x] Criar `lib/auth.ts`
- [x] Criar `lib/sync.ts`
- [x] Criar `app/auth.tsx`
- [x] Criar `app/auth-callback.tsx`
- [x] Criar `.env.example`
- [x] Atualizar `app.json` para auth/deep link, se necessário
- [x] Adicionar dependências do Supabase
- [x] Integrar autenticação com o fluxo do app
- [x] Implementar sincronização entre SQLite local e Supabase

## Widget

- [ ] Adicionar config plugin no `app.json`
- [ ] Criar bridge de dados entre app e widget
- [ ] Implementar Android AppWidget
- [ ] Implementar iOS WidgetKit extension
- [ ] Definir payload/estado exibido no widget
- [ ] Validar atualização do widget após mudanças no app
