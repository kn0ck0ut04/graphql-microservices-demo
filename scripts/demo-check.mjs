const endpoint = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql';
async function run(query, variables) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (!response.ok || body.errors) throw new Error(JSON.stringify(body.errors || body));
  return body.data;
}
const user = (await run('mutation($name:String!,$email:String!){createUser(name:$name,email:$email){id name email}}', { name: 'Демо пользователь', email: `demo-${Date.now()}@example.test` })).createUser;
const product = (await run('mutation($name:String!,$price:Float!,$stock:Int!){createProduct(name:$name,price:$price,stock:$stock){id name price stock}}', { name: 'Демо товар', price: 99.9, stock: 3 })).createProduct;
const order = (await run('mutation($userId:ID!,$productId:ID!,$quantity:Int!){createOrder(userId:$userId,productId:$productId,quantity:$quantity){id quantity status}}', { userId: user.id, productId: product.id, quantity: 2 })).createOrder;
const joined = (await run('query($id:ID!){order(id:$id){id quantity user{name email} product{name price}}}', { id: order.id })).order;
if (joined.user.email !== user.email || joined.product.name !== product.name) throw new Error('Federated entity lookup failed');
const updatedUser = (await run('mutation($id:ID!,$name:String!){updateUser(id:$id,name:$name){name}}', { id: user.id, name: 'Обновлённый пользователь' })).updateUser;
const updatedProduct = (await run('mutation($id:ID!,$price:Float!){updateProduct(id:$id,price:$price){price}}', { id: product.id, price: 109.9 })).updateProduct;
const updatedOrder = (await run('mutation($id:ID!,$quantity:Int!,$status:String!){updateOrder(id:$id,quantity:$quantity,status:$status){quantity status}}', { id: order.id, quantity: 4, status: 'PAID' })).updateOrder;
if (updatedUser.name !== 'Обновлённый пользователь' || updatedProduct.price !== 109.9 || updatedOrder.quantity !== 4 || updatedOrder.status !== 'PAID') throw new Error('Update operation returned unexpected data');
const deletedOrder = (await run('mutation($id:ID!){deleteOrder(id:$id)}', { id: order.id })).deleteOrder;
const deletedProduct = (await run('mutation($id:ID!){deleteProduct(id:$id)}', { id: product.id })).deleteProduct;
const deletedUser = (await run('mutation($id:ID!){deleteUser(id:$id)}', { id: user.id })).deleteUser;
if (!deletedOrder || !deletedProduct || !deletedUser) throw new Error('Delete operation failed');
console.log('OK: Gateway CRUD for Users, Products, Orders; federated Order → User/Product lookup.');
