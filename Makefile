# ============================================================
# Makefile para o projeto doser (Expo/React Native)
# ============================================================

# Configurações
SHELL := /bin/bash
BUN := bun
NODE := node
EXPO := bunx expo
TSC := bunx tsc
PRETTIER := bunx prettier
ESLINT := bunx eslint
JEST := bunx jest
HUSKY := bunx husky

# Cores para output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Variáveis
APP_NAME := doser
PLATFORM := $(shell uname -s)
NODE_ENV ?= development

# ============================================================
# TARGETS PRINCIPAIS
# ============================================================

.PHONY: help
help: ## Mostra ajuda dos comandos disponíveis
	@echo "$(BLUE)📦 doser - Comandos disponíveis:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

.PHONY: install
install: ## Instala todas as dependências
	@echo "$(YELLOW)📦 Instalando dependências...$(NC)"
	$(BUN) install
	@echo "$(GREEN)✅ Dependências instaladas!$(NC)"

.PHONY: update
update: ## Atualiza todas as dependências
	@echo "$(YELLOW)🔄 Atualizando dependências...$(NC)"
	$(BUN) update
	@echo "$(GREEN)✅ Dependências atualizadas!$(NC)"

# ============================================================
# TARGETS DE DESENVOLVIMENTO
# ============================================================

.PHONY: start
start: ## Inicia o app com dev-client
	@echo "$(YELLOW)🚀 Iniciando o app com dev-client...$(NC)"
	$(BUN) run start

.PHONY: start-go
start-go: ## Inicia o app (versão simples)
	@echo "$(YELLOW)🚀 Iniciando o app...$(NC)"
	$(BUN) run start:go

.PHONY: dev
dev: ## Inicia o app em modo desenvolvimento (alias para start)
	@echo "$(YELLOW)🚀 Iniciando em modo desenvolvimento...$(NC)"
	$(BUN) run start

.PHONY: web
web: ## Inicia o app no navegador
	@echo "$(YELLOW)🌐 Iniciando versão web...$(NC)"
	$(BUN) run web

# ============================================================
# TARGETS DE BUILD
# ============================================================

.PHONY: android
android: ## Build para Android
	@echo "$(YELLOW)📱 Build para Android...$(NC)"
	$(BUN) run android

.PHONY: ios
ios: ## Build para iOS
	@echo "$(YELLOW)🍎 Build para iOS...$(NC)"
	$(BUN) run ios

.PHONY: build
build: ## Build para produção (Android e iOS)
	@echo "$(YELLOW)🔨 Build para produção...$(NC)"
	$(EXPO) build

# ============================================================
# TARGETS DE TESTE E QUALIDADE
# ============================================================

.PHONY: test
test: ## Executa testes
	@echo "$(YELLOW)🧪 Executando testes...$(NC)"
	$(BUN) run test

.PHONY: test-watch
test-watch: ## Executa testes em modo watch
	@echo "$(YELLOW)🧪 Executando testes (watch mode)...$(NC)"
	$(JEST) --watch

.PHONY: test-coverage
test-coverage: ## Executa testes com cobertura
	@echo "$(YELLOW)📊 Executando testes com cobertura...$(NC)"
	$(BUN) run test:coverage

.PHONY: lint
lint: ## Executa ESLint (escopado via expo lint, igual ao bun run lint)
	@echo "$(YELLOW)🔍 Executando lint...$(NC)"
	$(BUN) run lint

.PHONY: lint-fix
lint-fix: ## Executa ESLint e corrige automaticamente
	@echo "$(YELLOW)🔧 Corrigindo lint...$(NC)"
	$(EXPO) lint --fix

.PHONY: format
format: ## Formata código com Prettier
	@echo "$(YELLOW)✨ Formatando código...$(NC)"
	$(BUN) run format

.PHONY: format-check
format-check: ## Verifica formatação
	@echo "$(YELLOW)🔍 Verificando formatação...$(NC)"
	$(BUN) run format:check

.PHONY: typecheck
typecheck: ## Verifica tipos TypeScript
	@echo "$(YELLOW)📝 Verificando tipos TypeScript...$(NC)"
	$(BUN) run typecheck

.PHONY: quality
quality: ## Executa todos os checks de qualidade (lint, format-check, typecheck, test)
	@echo "$(YELLOW)✅ Executando todos os checks de qualidade...$(NC)"
	@$(MAKE) lint
	@$(MAKE) format-check
	@$(MAKE) typecheck
	@$(MAKE) test

# ============================================================
# TARGETS DE LIMPEZA
# ============================================================

.PHONY: clean
clean: ## Limpa arquivos temporários e caches
	@echo "$(YELLOW)🧹 Limpando arquivos...$(NC)"
	@echo "Removendo node_modules..."
	rm -rf node_modules
	@echo "Removendo caches..."
	rm -rf .expo
	rm -rf .turbo
	rm -rf dist
	rm -rf build
	rm -rf .jest
	rm -rf coverage
	rm -rf ios/Pods
	rm -rf android/.gradle
	rm -rf android/app/build
	@echo "$(GREEN)✅ Limpeza concluída!$(NC)"

.PHONY: clean-cache
clean-cache: ## Limpa apenas caches do Expo e do bun
	@echo "$(YELLOW)🧹 Limpando caches...$(NC)"
	$(EXPO) start --clear
	$(BUN) pm cache rm
	rm -rf .expo
	rm -rf .turbo
	@echo "$(GREEN)✅ Caches limpos!$(NC)"

.PHONY: clean-modules
clean-modules: ## Remove node_modules para reinstalação
	@echo "$(YELLOW)🧹 Removendo node_modules...$(NC)"
	rm -rf node_modules
	@echo "$(GREEN)✅ node_modules removido!$(NC)"

# ============================================================
# TARGETS DE SETUP
# ============================================================

.PHONY: setup
setup: ## Configuração inicial do projeto (instala dependências e husky)
	@echo "$(YELLOW)🔧 Configurando projeto...$(NC)"
	@$(MAKE) install
	@$(MAKE) husky-setup
	@$(MAKE) reset-project
	@echo "$(GREEN)✅ Projeto configurado!$(NC)"

.PHONY: reset-project
reset-project: ## Reset do projeto (script específico)
	@echo "$(YELLOW)🔄 Resetando projeto...$(NC)"
	$(BUN) run reset-project

.PHONY: husky-setup
husky-setup: ## Configura Husky
	@echo "$(YELLOW)🐕 Configurando Husky...$(NC)"
	$(BUN) run prepare

# ============================================================
# TARGETS DE DEPLOY
# ============================================================

.PHONY: deploy-android
deploy-android: ## Deploy para Play Store
	@echo "$(YELLOW)📱 Deploy para Play Store...$(NC)"
	$(EXPO) submit --platform android

.PHONY: deploy-ios
deploy-ios: ## Deploy para App Store
	@echo "$(YELLOW)🍎 Deploy para App Store...$(NC)"
	$(EXPO) submit --platform ios

.PHONY: deploy
deploy: ## Deploy para ambas as stores
	@echo "$(YELLOW)🚀 Realizando deploy...$(NC)"
	@$(MAKE) deploy-android
	@$(MAKE) deploy-ios

# ============================================================
# TARGETS DE UTILITÁRIOS
# ============================================================

.PHONY: doctor
doctor: ## Verifica ambiente Expo
	@echo "$(YELLOW)🏥 Verificando ambiente...$(NC)"
	$(EXPO) doctor

.PHONY: info
info: ## Mostra informações do projeto
	@echo "$(BLUE)📊 Informações do projeto$(NC)"
	@echo "Nome: $(APP_NAME)"
	@echo "Versão: $(shell node -p "require('./package.json').version")"
	@echo "Plataforma: $(PLATFORM)"
	@echo "Node: $(shell node --version)"
	@echo "Bun: $(shell bun --version)"
	@echo ""

.PHONY: update-deps
update-deps: ## Atualiza dependências para a versão mais recente
	@echo "$(YELLOW)🔄 Atualizando dependências...$(NC)"
	$(BUN) outdated
	@echo ""
	@read -p "Deseja atualizar tudo? (y/N) " -n 1 -r; \
	echo ""; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(BUN) update --latest; \
	fi

# ============================================================
# TARGETS DE WIDGET (módulo doser-widget)
# ============================================================

.PHONY: widget
widget: ## Build do widget
	@echo "$(YELLOW)🧩 Buildando widget...$(NC)"
	cd modules/doser-widget && $(BUN) run build || echo "Widget não encontrado"

.PHONY: widget-dev
widget-dev: ## Desenvolvimento do widget
	@echo "$(YELLOW)🧩 Desenvolvendo widget...$(NC)"
	cd modules/doser-widget && $(BUN) run dev || echo "Widget não encontrado"

# ============================================================
# TARGETS DE MONORREPO (Workspaces)
# ============================================================

.PHONY: workspaces
workspaces: ## Instala dependências em todos os workspaces
	@echo "$(YELLOW)📦 Instalando workspaces...$(NC)"
	$(BUN) install

.PHONY: workspaces-clean
workspaces-clean: ## Limpa todos os workspaces
	@echo "$(YELLOW)🧹 Limpando workspaces...$(NC)"
	$(BUN) --filter '*' run clean

# ============================================================
# TARGETS DE DEBUG
# ============================================================

.PHONY: debug
debug: ## Inicia em modo debug
	@echo "$(YELLOW)🐛 Iniciando em modo debug...$(NC)"
	$(EXPO) start --dev-client --debug

.PHONY: android-debug
android-debug: ## Build Android em modo debug
	@echo "$(YELLOW)🐛 Build Android debug...$(NC)"
	$(EXPO) run:android --variant debug

# ============================================================
# TARGETS DE PRODUÇÃO
# ============================================================

.PHONY: prod
prod: ## Executa build de produção completo (qualidade + build)
	@echo "$(YELLOW)🚀 Build de produção...$(NC)"
	@$(MAKE) quality
	@$(MAKE) build

# ============================================================
# DEFAULT TARGET
# ============================================================

.DEFAULT_GOAL := help