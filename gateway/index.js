import { ApolloServer } from '@apollo/server';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { startStandaloneServer } from '@apollo/server/standalone';

const gateway = new ApolloGateway({ supergraphSdl: new IntrospectAndCompose({ subgraphs: [
  { name: 'users', url: process.env.USERS_URL || 'http://localhost:4001/graphql' },
  { name: 'products', url: process.env.PRODUCTS_URL || 'http://localhost:4002/graphql' },
  { name: 'orders', url: process.env.ORDERS_URL || 'http://localhost:4003/graphql' }
] }) });
const server = new ApolloServer({ gateway });
const { url } = await startStandaloneServer(server, { listen: { port: Number(process.env.PORT || 4000), host: '127.0.0.1' } });
console.log(`GraphQL Gateway ready at ${url}`);
