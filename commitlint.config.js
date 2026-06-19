/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // nova funcionalidade
        'fix', // correção de bug
        'chore', // tarefas de manutenção (deps, config, build)
        'docs', // documentação
        'test', // testes
        'refactor', // refatoração sem mudar comportamento
        'style', // formatação, espaços, ponto-e-vírgula
        'perf', // melhoria de performance
        'ci', // CI/CD
        'build', // sistema de build
        'revert', // reverter commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
  },
};
