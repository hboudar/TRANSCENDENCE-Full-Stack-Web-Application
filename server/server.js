import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';
import { sockethandler } from './socket.js';
import { rpsHandler } from './rps.js';
import game, { setupGameSocketIO } from './game.js';

import pino from "pino";

const logStream = pino.destination({
  dest: "/var/log/transcendence/server.log",
  mkdir: true,
});

const logger = pino(
  {
    level: "info",
    base: null,
  },
  logStream
);

const fastify = Fastify({
  logger: {
    instance: logger
  },
  bodyLimit: 1048576
});

fastify.addHook("onResponse", (req, reply, done) => {
  logger.info({
    event: "api_request",
    service: "transcendence",
    method: req.method,
    path: req.url,
    status: reply.statusCode,
  });
  done();
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

await fastify.register(cookie);

const db = new sqlite3.Database('sqlite.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite DB');
  }
});

db.serialize(() => {
	db.run(`
	  CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		email TEXT UNIQUE,
		password TEXT,
		picture TEXT,
		email_verified BOOLEAN DEFAULT 0,
		verification_token TEXT,
		games Integer DEFAULT 0,
        win INTEGER DEFAULT 0,
        lose INTEGER DEFAULT 0,
		gold INTEGER DEFAULT 0,
		rps_wins INTEGER DEFAULT 0,
		rps_losses INTEGER DEFAULT 0,
		rps_draws INTEGER DEFAULT 0,
		tounaments_won INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		receiver_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		status BOOL DEFAULT false,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (sender_id) REFERENCES users(id),
		FOREIGN KEY (receiver_id) REFERENCES users(id)
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS games (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date DATETIME NOT NULL,
		player1_id INTEGER,
		player2_id INTEGER,
		player1_score INTEGER,
		player2_score INTEGER,
		player1_gold_earned INTEGER,
		player2_gold_earned INTEGER,
		winner_id INTEGER,
		FOREIGN KEY (player1_id) REFERENCES users(id),
		FOREIGN KEY (player2_id) REFERENCES users(id),
		FOREIGN KEY (winner_id) REFERENCES users(id)
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS skins (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		price INTEGER,
		img TEXT NOT NULL,
		color TEXT NOT NULL,
		description TEXT,
		UNIQUE(name, type, img)
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS player_skins (
		player_id INTEGER,
		skin_id INTEGER,
		selected BOOLEAN NOT NULL DEFAULT 0,
		PRIMARY KEY (player_id, skin_id),
		FOREIGN KEY (player_id) REFERENCES users(id),
		FOREIGN KEY (skin_id) REFERENCES skins(id)
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		sender_id INTEGER,
		type TEXT NOT NULL,
		message TEXT NOT NULL,
		data TEXT,
		is_read BOOLEAN DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (sender_id) REFERENCES users(id)
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS blacklist_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT NOT NULL UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS password_reset_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		token TEXT NOT NULL UNIQUE,
		expires_at DATETIME NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	  );
	`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS friends (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		friend_id INTEGER NOT NULL,
		is_request BOOLEAN DEFAULT 0
		);
		`);

	db.run(`
	  CREATE TABLE IF NOT EXISTS blocks (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,
	    blocker_id INTEGER NOT NULL,
	    blocked_id INTEGER NOT NULL,
	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	    UNIQUE(blocker_id, blocked_id),
	    FOREIGN KEY (blocker_id) REFERENCES users(id),
	    FOREIGN KEY (blocked_id) REFERENCES users(id)
	  )
	`);
		
	});

const authMiddleware = (await import('./middleware/auth.js')).default;
fastify.addHook('preValidation', async (request, reply) => {
  await authMiddleware(request, reply, db);
});
	
const devRoute = (await import('./routes/devroute.js')).default;
fastify.register(devRoute, { db });

const chatRoute = (await import('./routes/chatroute.js')).default;
fastify.register(chatRoute, { db });

const authRoute = (await import('./routes/authroute.js')).default;
fastify.register(authRoute, { db });

const gameRoute = (await import('./routes/gameroute.js')).default;
fastify.register(gameRoute, { db });

const skinsRoute = (await import('./routes/skinsroute.js')).default;
fastify.register(skinsRoute, { db });

const buyRoute = (await import('./routes/buyroute.js')).default;
fastify.register(buyRoute, { db });

const shopRoute = (await import('./routes/shoproute.js')).default;
fastify.register(shopRoute, { db });

const gameApiRoute = (await import('./routes/gameapiroute.js')).default;
fastify.register(gameApiRoute, { db });

const notificationRoute = (await import('./routes/notificationroute.js')).default;
fastify.register(notificationRoute, { db });

const googleAuth = (await import('./google-auth.js')).default;
fastify.register(googleAuth, { db });
const httpServer = fastify.server;

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  }
});

sockethandler(io, db);
setupGameSocketIO(io, db);
rpsHandler(io, db);

const profileRoute = (await import('./routes/profileroute.js')).default;
await fastify.register(profileRoute, { db, io });

const friendsRoute = (await import('./routes/friendsroute.js')).default;
fastify.register(friendsRoute, { db, io });

const blockRoute = (await import('./routes/blockroute.js')).default;
fastify.register(blockRoute, { db });

const uploadRoute = (await import('./routes/uploadroute.js')).default;
fastify.register(uploadRoute, { db, io });

import client from "prom-client";

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests handled",
  labelNames: ["method", "route", "status"],
});
register.registerMetric(httpRequestsTotal);

fastify.addHook("onResponse", (request, reply, done) => {
  const route = request.routerPath || request.url;
  httpRequestsTotal.inc({ method: request.method, route, status: reply.statusCode });
  done();
});

fastify.get("/metrics", async (req, reply) => {
  reply.header("Content-Type", register.contentType);
  return register.metrics();
});
await fastify.ready();
const PORT = 4000;
httpServer.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`🚀 Server running at https://localhost:${PORT}`);
});
