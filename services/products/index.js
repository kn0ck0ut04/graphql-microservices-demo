import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Database from 'better-sqlite3';
import { gql } from 'graphql-tag';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 4002);
const dbFile = resolve(process.env.DATA_DIR || dirname(fileURLToPath(import.meta.url)), 'data/products.db');
mkdirSync(dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0))`);
const all = db.prepare('SELECT id, name, price, stock FROM products ORDER BY id');
const byId = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?');
const schema = gql`
  type Product @key(fields: "id") { id: ID! name: String! price: Float! stock: Int! }
  type Query { products: [Product!]! product(id: ID!): Product }
  type Mutation { createProduct(name: String!, price: Float!, stock: Int!): Product! updateProduct(id: ID!, name: String, price: Float, stock: Int): Product! deleteProduct(id: ID!): Boolean! }
`;
const server = new ApolloServer({ schema: buildSubgraphSchema([{ typeDefs: schema, resolvers: {
  Query: { products: () => all.all(), product: (_, { id }) => byId.get(id) || null },
  Mutation: {
    createProduct: (_, input) => { const result = db.prepare('INSERT INTO products (name,price,stock) VALUES (?,?,?)').run(input.name, input.price, input.stock); return byId.get(result.lastInsertRowid); },
    updateProduct: (_, { id, name, price, stock }) => { const current = byId.get(id); if (!current) throw new Error('Товар не найден'); db.prepare('UPDATE products SET name=?, price=?, stock=? WHERE id=?').run(name ?? current.name, price ?? current.price, stock ?? current.stock, id); return byId.get(id); },
    deleteProduct: (_, { id }) => db.prepare('DELETE FROM products WHERE id=?').run(id).changes > 0
  },
  Product: { __resolveReference: ({ id }) => byId.get(id) || null }
} }]) });
const { url } = await startStandaloneServer(server, { listen: { port, host: '127.0.0.1' } });
console.log(`Products subgraph ready at ${url}`);
