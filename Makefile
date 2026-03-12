.PHONY: help up down dev install build clean lint typecheck test db-generate db-migrate db-push db-studio

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install all dependencies"
	@echo "  make up           - Start Docker services (Redis, Postgres)"
	@echo "  make down         - Stop Docker services"
	@echo "  make dev          - Start development servers (web + api)"
	@echo "  make build        - Build all packages and apps"
	@echo "  make clean        - Clean all dependencies and build artifacts"
	@echo "  make lint         - Run linting across all packages"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo "  make test         - Run all tests"
	@echo "  make db:generate  - Generate Prisma client"
	@echo "  make db:migrate   - Run database migrations"
	@echo "  make db:push      - Push database schema changes"
	@echo "  make db:studio    - Open Prisma Studio"

# Install dependencies
install:
	pnpm install

# Docker services
up:
	docker-compose up -d
	@echo "✅ Docker services started"
	@echo "   Redis: localhost:6379"
	@echo "   Postgres: localhost:5432"

down:
	docker-compose down

# Development
dev:
	pnpm dev

# Build
build:
	pnpm build

# Clean
clean:
	pnpm clean
	docker-compose down -v

# Linting and type checking
lint:
	pnpm lint

typecheck:
	pnpm typecheck

# Testing
test:
	pnpm test

# Database commands
db:generate:
	pnpm db:generate

db:migrate:
	pnpm db:migrate

db:push:
	pnpm db:push

db:studio:
	pnpm db:studio
