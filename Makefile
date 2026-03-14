.PHONY: up down build logs backend frontend

# Docker (primary workflow)
up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

rebuild:
	docker compose down && docker compose build --no-cache && docker compose up -d
