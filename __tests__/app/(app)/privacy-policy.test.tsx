import React from 'react';
import { render, screen } from '@testing-library/react-native';
import PrivacyPolicyScreen from '@/app/(app)/privacy-policy';

describe('PrivacyPolicyScreen', () => {
  it('renderiza o título e a data de atualização', () => {
    render(<PrivacyPolicyScreen />);

    expect(screen.getByText('Política de Privacidade')).toBeTruthy();
    expect(screen.getByText('Última atualização: 12 de junho de 2026')).toBeTruthy();
  });

  it('renderiza o resumo em destaque', () => {
    render(<PrivacyPolicyScreen />);

    expect(screen.getByText('Em resumo')).toBeTruthy();
    expect(screen.getByText(/Não vendemos seus/)).toBeTruthy();
  });

  it('renderiza todas as 11 seções da política', () => {
    render(<PrivacyPolicyScreen />);

    expect(screen.getByText('1. Quem somos')).toBeTruthy();
    expect(screen.getByText('2. Dados armazenados localmente')).toBeTruthy();
    expect(screen.getByText('3. Sincronização na nuvem (opcional)')).toBeTruthy();
    expect(screen.getByText('4. Leitura de receitas com IA')).toBeTruthy();
    expect(screen.getByText('5. Notificações')).toBeTruthy();
    expect(screen.getByText('6. Câmera e galeria')).toBeTruthy();
    expect(screen.getByText('7. Dados que NÃO coletamos')).toBeTruthy();
    expect(screen.getByText('8. Seus direitos')).toBeTruthy();
    expect(screen.getByText('9. Segurança')).toBeTruthy();
    expect(screen.getByText('10. Alterações nesta política')).toBeTruthy();
    expect(screen.getByText('11. Contato')).toBeTruthy();
  });

  it('exibe o e-mail de contato', () => {
    render(<PrivacyPolicyScreen />);

    expect(screen.getAllByText(/mv\.maycon\.araujo\.santos@gmail\.com/).length).toBeGreaterThan(0);
  });
});
