*This project has been created as part of the 42 curriculum

# ft_transcendence

## Description

**ft_transcendence** is a full-stack web application project focused on building a modern, real-time web platform from scratch.

The core of the project is an online multiplayer **Pong game**, combined with a complete user system that includes authentication, user profiles, matchmaking, chat, and game history. The application is designed to handle real-time interactions, persistent data storage, and secure communication between clients and the server.

The project emphasizes backend architecture, API design, real-time communication, and security, while integrating a responsive frontend and a containerized deployment workflow.

---

## Features

- User authentication and authorization
- User profiles and statistics
- Real-time multiplayer Pong game
- Matchmaking system
- Real-time chat
- Game history and leaderboard
- Secure API and protected routes
- Persistent data storage
- Dockerized development environment

---

## Architecture Overview

The application follows a clear separation of concerns:

- **Frontend**
  - Handles UI, user interactions, and real-time updates
- **Backend**
  - Exposes REST APIs
  - Manages authentication and authorization
  - Handles real-time game logic and communication
- **Database**
  - Stores users, matches, and game history
- **Real-time Layer**
  - Enables live gameplay and chat
- **Infrastructure**
  - Containerized using Docker for reproducible builds and deployment

---

## Tech Stack

- **Backend**: Fastify (Node.js)
- **Frontend**: Modern JavaScript framework (SPA)
- **Database**: SQLite
- **Real-time**: WebSockets
- **Authentication**: Token-based authentication (JWT or equivalent)
- **DevOps**: Docker, Docker Compose

---

## Installation & Running

### Prerequisites
- Docker
- Docker Compose

### Build and start the project
```bash
docker compose up --build
