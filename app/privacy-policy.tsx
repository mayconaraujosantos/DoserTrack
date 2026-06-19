import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  const C = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="title" style={styles.sectionTitle}>
        {title}
      </Text>
      <Text variant="body" color={C.sub} style={styles.sectionBody}>
        {children}
      </Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text variant="heading" style={styles.heading}>
        Política de Privacidade
      </Text>
      <Text variant="caption" color={C.sub} style={styles.updated}>
        Última atualização: 12 de junho de 2026
      </Text>

      <Card variant="default" style={styles.summaryCard}>
        <Text variant="label">Em resumo</Text>
        <Text variant="body" color={C.sub} style={styles.summaryText}>
          O Doser armazena seus dados de medicamentos diretamente no seu aparelho. Não vendemos seus
          dados. Não exibimos anúncios. A sincronização na nuvem é opcional e requer login
          explícito.
        </Text>
      </Card>

      <Section title="1. Quem somos">
        {`O Doser é um aplicativo de gerenciamento de medicamentos desenvolvido por Maycon Araujo Santos (CNPJ/CPF do desenvolvedor), disponível na Google Play Store sob o pacote com.mayconaraujosantos.doser.\n\nContato: mv.maycon.araujo.santos@gmail.com`}
      </Section>

      <Section title="2. Dados armazenados localmente">
        {`O Doser armazena no seu próprio aparelho (banco de dados SQLite local, sem acesso externo):\n\n• Nomes e tipos de medicamentos cadastrados\n• Horários e frequências de doses\n• Histórico de doses tomadas, puladas e adiadas\n• Fotos de medicamentos (se você optar por adicionar)\n• Nomes de perfis criados por você\n• Configurações de biometria e preferências\n\nEsses dados nunca saem do aparelho sem ação explícita sua.`}
      </Section>

      <Section title="3. Sincronização na nuvem (opcional)">
        {`Se você fizer login com seu e-mail, seus dados serão sincronizados com servidores seguros da Supabase (infraestrutura com certificação SOC 2) para possibilitar:\n\n• Acesso em múltiplos aparelhos\n• Backup automático\n\nA sincronização é totalmente opcional. O aplicativo funciona normalmente sem login. Ao sair da conta (logout), a sincronização é interrompida. Você pode solicitar a exclusão de todos os seus dados na nuvem pelo e-mail de contato.`}
      </Section>

      <Section title="4. Leitura de receitas com IA">
        {`A função "Escanear Receita" envia a imagem da receita para nosso servidor seguro, que utiliza a API Gemini do Google para extrair as informações dos medicamentos.\n\n• A imagem é processada somente para extração de dados e não é armazenada em nossos servidores após o processamento.\n• O resultado é retornado ao seu aparelho e salvo localmente.\n• Esta funcionalidade requer conta ativa no Doser.\n\nPolítica de privacidade do Google AI: https://policies.google.com/privacy`}
      </Section>

      <Section title="5. Notificações">
        {`O Doser agenda notificações locais no próprio aparelho para lembretes de dose. Não utilizamos serviços externos de push notification para lembretes de medicamentos. As notificações podem ser desativadas a qualquer momento nas configurações do sistema.`}
      </Section>

      <Section title="6. Câmera e galeria">
        {`O acesso à câmera e galeria de fotos é usado exclusivamente para:\n\n• Adicionar foto ao cadastro de um medicamento\n• Fotografar uma receita para análise por IA\n\nAs imagens não são coletadas automaticamente nem enviadas sem sua ação.`}
      </Section>

      <Section title="7. Dados que NÃO coletamos">
        {`• Não coletamos dados de localização\n• Não exibimos anúncios nem compartilhamos dados com redes publicitárias\n• Não coletamos dados de uso para fins comerciais\n• Não vendemos qualquer dado pessoal a terceiros`}
      </Section>

      <Section title="8. Seus direitos">
        {`Você pode, a qualquer momento:\n\n• Excluir todos os dados locais desinstalando o aplicativo\n• Solicitar a exclusão de dados na nuvem pelo e-mail: mv.maycon.araujo.santos@gmail.com\n• Exportar seu histórico em PDF pela tela de Histórico\n• Revogar acesso à câmera, galeria e notificações nas configurações do sistema`}
      </Section>

      <Section title="9. Segurança">
        {`• Dados locais são protegidos pelo sistema de arquivos do Android (sandbox de aplicativo)\n• Dados em nuvem são transmitidos via HTTPS e armazenados com criptografia em repouso\n• Senhas não são armazenadas — usamos Magic Link (link por e-mail) como método de autenticação`}
      </Section>

      <Section title="10. Alterações nesta política">
        {`Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas dentro do aplicativo. O uso contínuo do Doser após a publicação de alterações constitui aceitação da nova versão.`}
      </Section>

      <Section title="11. Contato">
        {`Dúvidas, solicitações de exclusão de dados ou reclamações:\n\nmv.maycon.araujo.santos@gmail.com\n\nResponderemos em até 5 dias úteis.`}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 0 },
  heading: { marginBottom: 4 },
  updated: { marginBottom: 20 },
  summaryCard: { marginBottom: 24, gap: 8 },
  summaryText: { lineHeight: 22 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 8 },
  sectionBody: { lineHeight: 22 },
});
