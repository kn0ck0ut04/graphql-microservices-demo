import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Database from 'better-sqlite3';
import { gql } from 'graphql-tag';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 4001);
const dbFile = resolve(process.env.DATA_DIR || dirname(fileURLToPath(import.meta.url)), 'data/users.db');
mkdirSync(dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE)`);
const all = db.prepare('SELECT id, name, email FROM users ORDER BY id');
const byId = db.prepare('SELECT id, name, email FROM users WHERE id = ?');
const schema = gql`
  type User @key(fields: "id") { id: ID! name: String! email: String! }
  type Query { users: [User!]! user(id: ID!): User }
  type Mutation { createUser(name: String!, email: String!): User! updateUser(id: ID!, name: String, email: String): User! deleteUser(id: ID!): Boolean! }
`;
const server = new ApolloServer({ schema: buildSubgraphSchema([{ typeDefs: schema, resolvers: {
  Query: { users: () => all.all(), user: (_, { id }) => byId.get(id) || null },
  Mutation: {
    createUser: (_, input) => { const result = db.prepare('INSERT INTO users (name,email) VALUES (?,?)').run(input.name, input.email); return byId.get(result.lastInsertRowid); },
    updateUser: (_, { id, name, email }) => { const current = byId.get(id); if (!current) throw new Error('Пользователь не найден'); db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(name ?? current.name, email ?? current.email, id); return byId.get(id); },
    deleteUser: (_, { id }) => db.prepare('DELETE FROM users WHERE id=?').run(id).changes > 0
  },
  User: { __resolveReference: ({ id }) => byId.get(id) || null }
} }]) });
const { url } = await startStandaloneServer(server, { listen: { port, host: '127.0.0.1' } });
console.log(`Users subgraph ready at ${url}`);
