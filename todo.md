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
- [ ] Criar `lib/supabase.ts`
- [ ] Criar `lib/auth.ts`
- [ ] Criar `lib/sync.ts`
- [ ] Criar `app/auth.tsx`
- [ ] Criar `app/auth-callback.tsx`
- [ ] Criar `.env.example`
- [ ] Atualizar `app.json` para auth/deep link, se necessário
- [ ] Adicionar dependências do Supabase
- [ ] Integrar autenticação com o fluxo do app
- [ ] Implementar sincronização entre SQLite local e Supabase

## Widget
- [ ] Adicionar config plugin no `app.json`
- [ ] Criar bridge de dados entre app e widget
- [ ] Implementar Android AppWidget
- [ ] Implementar iOS WidgetKit extension
- [ ] Definir payload/estado exibido no widget
- [ ] Validar atualização do widget após mudanças no app
