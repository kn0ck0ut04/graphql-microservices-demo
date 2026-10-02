import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Database from 'better-sqlite3';
import { gql } from 'graphql-tag';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 4003);
const dbFile = resolve(process.env.DATA_DIR || dirname(fileURLToPath(import.meta.url)), 'data/orders.db');
mkdirSync(dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.exec(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), status TEXT NOT NULL DEFAULT 'NEW')`);
const all = db.prepare('SELECT id, user_id AS userId, product_id AS productId, quantity, status FROM orders ORDER BY id');
const byId = db.prepare('SELECT id, user_id AS userId, product_id AS productId, quantity, status FROM orders WHERE id = ?');
const schema = gql`
  type User @key(fields: "id") { id: ID! }
  type Product @key(fields: "id") { id: ID! }
  type Order @key(fields: "id") { id: ID! user: User! product: Product! quantity: Int! status: String! }
  type Query { orders: [Order!]! order(id: ID!): Order }
  type Mutation { createOrder(userId: ID!, productId: ID!, quantity: Int!): Order! updateOrder(id: ID!, quantity: Int, status: String): Order! deleteOrder(id: ID!): Boolean! }
`;
const server = new ApolloServer({ schema: buildSubgraphSchema([{ typeDefs: schema, resolvers: {
  Query: { orders: () => all.all(), order: (_, { id }) => byId.get(id) || null },
  Mutation: {
    createOrder: (_, { userId, productId, quantity }) => { const result = db.prepare('INSERT INTO orders (user_id,product_id,quantity) VALUES (?,?,?)').run(userId, productId, quantity); return byId.get(result.lastInsertRowid); },
    updateOrder: (_, { id, quantity, status }) => { const current = byId.get(id); if (!current) throw new Error('Заказ не найден'); db.prepare('UPDATE orders SET quantity=?, status=? WHERE id=?').run(quantity ?? current.quantity, status ?? current.status, id); return byId.get(id); },
    deleteOrder: (_, { id }) => db.prepare('DELETE FROM orders WHERE id=?').run(id).changes > 0
  },
  Order: { user: (order) => ({ __typename: 'User', id: order.userId }), product: (order) => ({ __typename: 'Product', id: order.productId }) }
} }]) });
const { url } = await startStandaloneServer(server, { listen: { port, host: '127.0.0.1' } });
console.log(`Orders subgraph ready at ${url}`);
